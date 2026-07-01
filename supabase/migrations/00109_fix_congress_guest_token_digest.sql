-- ============================================================
-- MIGRATION 00109: Fix congress guest token digest lookup
--
-- The guest-token RPCs run as SECURITY DEFINER with an empty search_path.
-- On Supabase, pgcrypto's digest function is exposed through the extensions
-- schema, so unqualified digest(...) can fail at runtime and make fresh links
-- look expired. Qualify it explicitly in both public RPCs.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.validate_conference_guest_token(
  raw_token text
)
returns table (
  token_id        uuid,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  conference_id   uuid,
  conference_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  v_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');

  return query
  select
    t.id                                    as token_id,
    t.contact_name                          as contact_name,
    t.contact_email                         as contact_email,
    t.contact_phone                         as contact_phone,
    t.conference_id                         as conference_id,
    c.name                                  as conference_name
  from public.conference_guest_tokens t
  left join public.conferences c on c.id = t.conference_id
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now()
  limit 1;
end;
$$;

revoke all on function public.validate_conference_guest_token(text) from public;
grant execute on function public.validate_conference_guest_token(text) to anon;
grant execute on function public.validate_conference_guest_token(text) to authenticated;

create or replace function public.submit_conference_guest_form(
  p_raw_token           text,
  p_submitter_name      text,
  p_submitter_email     text,
  p_submitter_phone     text,
  p_submitter_org       text,
  p_conference_id       uuid,
  p_conference_name     text,
  p_conference_start    date,
  p_conference_end      date,
  p_conference_location text,
  p_role                text,
  p_notes               text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash        text;
  v_token_id    uuid;
  v_sub_id      uuid;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id into v_token_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  insert into public.conference_guest_submissions (
    token_id, submitter_name, submitter_email, submitter_phone,
    submitter_organisation, conference_id, conference_name,
    conference_start_date, conference_end_date, conference_location,
    role_at_conference, notes
  ) values (
    v_token_id, p_submitter_name, p_submitter_email, p_submitter_phone,
    p_submitter_org, p_conference_id, p_conference_name,
    p_conference_start, p_conference_end, p_conference_location,
    p_role, p_notes
  )
  returning id into v_sub_id;

  update public.conference_guest_tokens
  set used_count = used_count + 1
  where id = v_token_id;

  return v_sub_id;
end;
$$;

revoke all on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) from public;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) to anon;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) to authenticated;

notify pgrst, 'reload schema';
