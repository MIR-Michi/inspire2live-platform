-- ============================================================
-- MIGRATION 00166: Conference removal workflows
--
-- Adds explicit, ownership-checked removal paths for:
--   1. a guest withdrawing one conference from their own workspace
--   2. the comms team removing a tracked conference and its guest entries
--
-- Both functions return storage paths so the API/server action can remove the
-- corresponding Supabase Storage objects through the supported Storage API.
-- ============================================================

-- ── Guest withdrawal ──────────────────────────────────────────────────────────

create or replace function public.remove_guest_conference(
  p_raw_token text,
  p_sub_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_conference_id uuid;
  v_conference_name text;
  v_storage_paths jsonb := '[]'::jsonb;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select t.id
  into v_token_id
  from public.conference_guest_tokens t
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  select
    s.conference_id,
    s.conference_name,
    coalesce((
      select jsonb_agg(f.storage_path order by f.uploaded_at)
      from public.conference_guest_files f
      where f.submission_id = s.id
    ), '[]'::jsonb)
  into
    v_conference_id,
    v_conference_name,
    v_storage_paths
  from public.conference_guest_submissions s
  where s.id = p_sub_id
    and s.token_id = v_token_id;

  if not found then
    raise exception 'submission_not_found';
  end if;

  -- Access requests use ON DELETE SET NULL for submission_id, but a withdrawal
  -- should remove the related request instead of leaving an orphaned decision.
  delete from public.conference_guest_access_requests
  where submission_id = p_sub_id;

  -- Files and notes cascade from the submission.
  delete from public.conference_guest_submissions
  where id = p_sub_id
    and token_id = v_token_id;

  -- Keep the token usable for any other conferences and make sure a removed,
  -- originally-prefilled conference is not offered again automatically.
  update public.conference_guest_tokens t
  set
    used_count = (
      select count(*)::int
      from public.conference_guest_submissions s
      where s.token_id = t.id
    ),
    conference_id = case
      when t.conference_id = v_conference_id then null
      else t.conference_id
    end
  where t.id = v_token_id;

  return jsonb_build_object(
    'submissionId', p_sub_id,
    'conferenceId', v_conference_id,
    'conferenceName', v_conference_name,
    'storagePaths', v_storage_paths
  );
end;
$$;

revoke all on function public.remove_guest_conference(text, uuid) from public;
grant execute on function public.remove_guest_conference(text, uuid) to anon;
grant execute on function public.remove_guest_conference(text, uuid) to authenticated;

-- ── Team shortlist removal ────────────────────────────────────────────────────

create or replace function public.remove_conference_from_pipeline_with_guests(
  p_conference_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conference_name text;
  v_submission_ids uuid[];
  v_token_ids uuid[];
  v_recipients jsonb := '[]'::jsonb;
  v_storage_paths jsonb := '[]'::jsonb;
begin
  if not public.is_comms_team_or_admin() then
    raise exception 'not_authorized';
  end if;

  select c.name
  into v_conference_name
  from public.conferences c
  where c.id = p_conference_id;

  if not found then
    raise exception 'conference_not_found';
  end if;

  select
    array_agg(s.id),
    array_agg(distinct s.token_id)
  into
    v_submission_ids,
    v_token_ids
  from public.conference_guest_submissions s
  where s.conference_id = p_conference_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'submissionId', s.id,
    'name', coalesce(nullif(trim(s.submitter_name), ''), nullif(trim(t.contact_name), ''), 'Conference guest'),
    'email', lower(coalesce(nullif(trim(s.submitter_email), ''), nullif(trim(t.contact_email), ''))),
    'status', s.status
  ) order by s.created_at), '[]'::jsonb)
  into v_recipients
  from public.conference_guest_submissions s
  join public.conference_guest_tokens t on t.id = s.token_id
  where s.conference_id = p_conference_id
    and s.status <> 'rejected';

  select coalesce(jsonb_agg(f.storage_path order by f.uploaded_at), '[]'::jsonb)
  into v_storage_paths
  from public.conference_guest_files f
  join public.conference_guest_submissions s on s.id = f.submission_id
  where s.conference_id = p_conference_id;

  if coalesce(array_length(v_submission_ids, 1), 0) > 0 then
    delete from public.conference_guest_access_requests
    where submission_id = any(v_submission_ids);

    -- Files and notes cascade from these submissions.
    delete from public.conference_guest_submissions
    where id = any(v_submission_ids);
  end if;

  -- A scoped invitation token can still be used for other conferences, but it
  -- must not keep pre-filling a conference the team deliberately removed.
  update public.conference_guest_tokens
  set conference_id = null
  where conference_id = p_conference_id;

  if coalesce(array_length(v_token_ids, 1), 0) > 0 then
    update public.conference_guest_tokens t
    set used_count = (
      select count(*)::int
      from public.conference_guest_submissions s
      where s.token_id = t.id
    )
    where t.id = any(v_token_ids);
  end if;

  delete from public.conference_tracking
  where conference_id = p_conference_id;

  return jsonb_build_object(
    'conferenceId', p_conference_id,
    'conferenceName', v_conference_name,
    'recipients', v_recipients,
    'storagePaths', v_storage_paths,
    'removedSubmissions', coalesce(array_length(v_submission_ids, 1), 0)
  );
end;
$$;

revoke all on function public.remove_conference_from_pipeline_with_guests(uuid) from public;
grant execute on function public.remove_conference_from_pipeline_with_guests(uuid) to authenticated;

notify pgrst, 'reload schema';
