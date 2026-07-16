-- ============================================================
-- MIGRATION 00165: Conference guest access workflow
--
-- Completes the platform-access request flow for conference guests:
--   - records who reviewed a request, when, and the response message
--   - stores the requested role used when an invitation is approved
--   - prevents duplicate pending requests for the same token/submission
--   - rejects requests from people who already have a platform profile
--   - validates that the submission belongs to the supplied guest token
-- ============================================================

alter table public.conference_guest_access_requests
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists response_message text,
  add column if not exists requested_role text not null default 'PatientAdvocate';

-- Keep only the newest pending request before enforcing one active request per
-- guest/conference response. Existing production data was reset in 00164, but
-- this makes a full replay and future manual imports deterministic.
with ranked as (
  select
    id,
    row_number() over (
      partition by token_id, submission_id
      order by created_at desc, id desc
    ) as rn
  from public.conference_guest_access_requests
  where status = 'pending'
)
delete from public.conference_guest_access_requests r
using ranked x
where r.id = x.id
  and x.rn > 1;

create unique index if not exists uq_conference_guest_access_requests_pending
  on public.conference_guest_access_requests(token_id, submission_id)
  where status = 'pending';

-- Recreate the public RPC with ownership validation and existing-user detection.
drop function if exists public.request_guest_access(text, uuid, text);

create function public.request_guest_access(
  p_raw_token text,
  p_sub_id uuid,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_contact_id uuid;
  v_contact_name text;
  v_contact_email text;
  v_creator uuid;
  v_creator_email text;
  v_submission_name text;
  v_submission_email text;
  v_profile_id uuid;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select
    t.id,
    t.contact_id,
    t.contact_name,
    t.contact_email,
    t.created_by
  into
    v_token_id,
    v_contact_id,
    v_contact_name,
    v_contact_email,
    v_creator
  from public.conference_guest_tokens t
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  select s.submitter_name, s.submitter_email
  into v_submission_name, v_submission_email
  from public.conference_guest_submissions s
  where s.id = p_sub_id
    and s.token_id = v_token_id;

  if not found then
    raise exception 'invalid_token';
  end if;

  v_contact_name := coalesce(nullif(trim(v_contact_name), ''), nullif(trim(v_submission_name), ''));
  v_contact_email := lower(coalesce(nullif(trim(v_contact_email), ''), nullif(trim(v_submission_email), '')));

  if v_contact_id is not null then
    select c.profile_id
    into v_profile_id
    from public.comms_crm_contacts c
    where c.id = v_contact_id;
  end if;

  if v_profile_id is not null or exists (
    select 1
    from public.profiles p
    where lower(trim(p.email)) = v_contact_email
  ) then
    raise exception 'already_has_access';
  end if;

  if not exists (
    select 1
    from public.conference_guest_access_requests r
    where r.token_id = v_token_id
      and r.submission_id = p_sub_id
      and r.status = 'pending'
  ) then
    insert into public.conference_guest_access_requests (
      token_id,
      submission_id,
      contact_name,
      contact_email,
      message
    ) values (
      v_token_id,
      p_sub_id,
      v_contact_name,
      v_contact_email,
      nullif(trim(p_message), '')
    );
  end if;

  select u.email
  into v_creator_email
  from auth.users u
  where u.id = v_creator;

  return v_creator_email;
end;
$$;

revoke all on function public.request_guest_access(text, uuid, text) from public;
grant execute on function public.request_guest_access(text, uuid, text) to anon;
grant execute on function public.request_guest_access(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';