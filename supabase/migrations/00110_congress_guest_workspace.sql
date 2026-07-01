-- ============================================================
-- MIGRATION 00110: Congress guest workspace
--
-- (Renumbered from 00109 — the digest-fix migration merged first and already
-- occupies version 00109; this must be a distinct later version.)
--
-- All guest RPCs qualify pgcrypto's digest as extensions.digest: these are
-- SECURITY DEFINER with search_path = '', and pgcrypto is exposed through the
-- extensions schema on Supabase, so an unqualified digest(...) fails at runtime
-- and makes fresh links look expired.
--
-- Extends the guest attendance form (00108) with:
--   1. `is_registered` flag on submissions (drives conference stage)
--   2. `conference_guest_files` – photos / presentations uploaded by guests
--   3. `conference_guest_notes` – meeting summary & comments from guests
--   4. `conference_guest_access_requests` – guests asking for full access
--   5. Storage bucket `congress-guest-uploads` for the files
--   6. Updated submit RPC: upserts conference_tracking at "intended" stage
--   7. New RPCs:
--        get_guest_workspace     – workspace data for a returning token holder
--        mark_guest_registered   – checkbox → stage "registered"
--        add_guest_note          – save summary / comment
--        register_guest_file     – record an uploaded file after API upload
--        request_guest_access    – store access request + return creator email
-- ============================================================

-- pgcrypto (for digest) is exposed via the extensions schema on Supabase.
create extension if not exists pgcrypto with schema extensions;

-- Drop the old 12-param overload from 00108 (replaced by the 13-param version below).
drop function if exists public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text);

-- ── 1. Add is_registered to submissions ──────────────────────────────────────

alter table public.conference_guest_submissions
  add column if not exists is_registered boolean not null default false;

-- ── 2. Guest files ────────────────────────────────────────────────────────────

create table if not exists public.conference_guest_files (
  id            uuid        primary key default gen_random_uuid(),
  submission_id uuid        not null references public.conference_guest_submissions(id) on delete cascade,
  file_type     text        not null check (file_type in ('photo', 'presentation', 'document')),
  storage_path  text        not null,
  file_name     text        not null,
  file_size     bigint,
  public_url    text,
  uploaded_at   timestamptz not null default now()
);

alter table public.conference_guest_files enable row level security;

drop policy if exists conf_guest_files_comms on public.conference_guest_files;
create policy conf_guest_files_comms on public.conference_guest_files
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── 3. Guest notes ────────────────────────────────────────────────────────────

create table if not exists public.conference_guest_notes (
  id            uuid        primary key default gen_random_uuid(),
  submission_id uuid        not null references public.conference_guest_submissions(id) on delete cascade,
  note_type     text        not null check (note_type in ('summary', 'comment')),
  content       text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists conf_guest_notes_set_updated_at on public.conference_guest_notes;
create trigger conf_guest_notes_set_updated_at
  before update on public.conference_guest_notes
  for each row execute function public.set_updated_at();

alter table public.conference_guest_notes enable row level security;

drop policy if exists conf_guest_notes_comms on public.conference_guest_notes;
create policy conf_guest_notes_comms on public.conference_guest_notes
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── 4. Access requests ────────────────────────────────────────────────────────

create table if not exists public.conference_guest_access_requests (
  id            uuid        primary key default gen_random_uuid(),
  token_id      uuid        not null references public.conference_guest_tokens(id) on delete cascade,
  submission_id uuid        references public.conference_guest_submissions(id) on delete set null,
  contact_name  text,
  contact_email text,
  message       text,
  status        text        not null default 'pending'
    check (status in ('pending', 'granted', 'declined')),
  created_at    timestamptz not null default now()
);

alter table public.conference_guest_access_requests enable row level security;

drop policy if exists conf_guest_access_req_comms on public.conference_guest_access_requests;
create policy conf_guest_access_req_comms on public.conference_guest_access_requests
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── 5. Storage bucket ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'congress-guest-uploads',
  'congress-guest-uploads',
  true,
  52428800, -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) on conflict (id) do nothing;

-- Public read so photos/presentation links can be shared.
drop policy if exists congress_guest_uploads_read on storage.objects;
create policy congress_guest_uploads_read on storage.objects
  for select using (bucket_id = 'congress-guest-uploads');

-- Writes via the API route (service role); no direct client upload policy needed.

-- ── 6. Updated submit RPC ────────────────────────────────────────────────────
-- Replaces the 00108 version; also upserts conference_tracking at "intended"
-- (or "registered" if is_registered=true) when the conference is known.

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
  p_notes               text,
  p_is_registered       boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash        text;
  v_token_id    uuid;
  v_sub_id      uuid;
  v_creator_id  uuid;
  v_target_stage text;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id, created_by into v_token_id, v_creator_id
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
    role_at_conference, notes, is_registered
  ) values (
    v_token_id, p_submitter_name, p_submitter_email, p_submitter_phone,
    p_submitter_org, p_conference_id, p_conference_name,
    p_conference_start, p_conference_end, p_conference_location,
    p_role, p_notes, coalesce(p_is_registered, false)
  )
  returning id into v_sub_id;

  update public.conference_guest_tokens
  set used_count = used_count + 1
  where id = v_token_id;

  -- Auto-advance conference stage when the conference is known.
  if p_conference_id is not null then
    v_target_stage := case when coalesce(p_is_registered, false) then 'registered' else 'intended' end;

    insert into public.conference_tracking (conference_id, stage, added_by)
    values (p_conference_id, v_target_stage, v_creator_id)
    on conflict (conference_id) do update
      set stage = case
        -- Only advance the stage, never demote it.
        when conference_tracking.stage = 'archived' then conference_tracking.stage
        when conference_tracking.stage = 'follow_up' then conference_tracking.stage
        when conference_tracking.stage = 'ongoing' then conference_tracking.stage
        when conference_tracking.stage = 'registered' and v_target_stage = 'intended' then conference_tracking.stage
        else v_target_stage
      end,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'submissionId', v_sub_id,
    'creatorId', v_creator_id
  );
end;
$$;

-- Keep same grants as 00108.
revoke all on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) from public;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) to anon;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text,boolean) to authenticated;

-- ── 7. get_guest_workspace RPC ────────────────────────────────────────────────

create or replace function public.get_guest_workspace(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
  v_result   jsonb;
begin
  v_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');

  select id into v_token_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'token', jsonb_build_object(
      'id', t.id,
      'contactName', t.contact_name,
      'contactEmail', t.contact_email,
      'conferenceId', t.conference_id
    ),
    'submissions', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'submitterName', s.submitter_name,
          'submitterEmail', s.submitter_email,
          'conferenceName', s.conference_name,
          'conferenceId', s.conference_id,
          'conferenceStart', s.conference_start_date,
          'conferenceLocation', s.conference_location,
          'role', s.role_at_conference,
          'notes', s.notes,
          'isRegistered', s.is_registered,
          'status', s.status,
          'createdAt', s.created_at,
          'files', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', f.id, 'fileType', f.file_type, 'fileName', f.file_name,
              'publicUrl', f.public_url, 'uploadedAt', f.uploaded_at
            ) order by f.uploaded_at), '[]'::jsonb)
            from public.conference_guest_files f
            where f.submission_id = s.id
          ),
          'guestNotes', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', n.id, 'noteType', n.note_type, 'content', n.content,
              'createdAt', n.created_at
            ) order by n.created_at), '[]'::jsonb)
            from public.conference_guest_notes n
            where n.submission_id = s.id
          )
        ) order by s.created_at desc
      ),
      '[]'::jsonb
    )
  ) into v_result
  from public.conference_guest_tokens t
  left join public.conference_guest_submissions s on s.token_id = t.id
  where t.id = v_token_id
  group by t.id, t.contact_name, t.contact_email, t.conference_id;

  return v_result;
end;
$$;

revoke all on function public.get_guest_workspace(text) from public;
grant execute on function public.get_guest_workspace(text) to anon;
grant execute on function public.get_guest_workspace(text) to authenticated;

-- ── 8. mark_guest_registered RPC ──────────────────────────────────────────────

create or replace function public.mark_guest_registered(
  p_raw_token   text,
  p_sub_id      uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
  v_conf_id  uuid;
  v_creator  uuid;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id, created_by into v_token_id, v_creator
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  update public.conference_guest_submissions
  set is_registered = true
  where id = p_sub_id and token_id = v_token_id
  returning conference_id into v_conf_id;

  -- Advance conference to "registered" (if not already further along).
  if v_conf_id is not null then
    insert into public.conference_tracking (conference_id, stage, added_by)
    values (v_conf_id, 'registered', v_creator)
    on conflict (conference_id) do update
      set stage = case
        when conference_tracking.stage in ('ongoing', 'follow_up', 'archived') then conference_tracking.stage
        else 'registered'
      end,
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.mark_guest_registered(text, uuid) from public;
grant execute on function public.mark_guest_registered(text, uuid) to anon;
grant execute on function public.mark_guest_registered(text, uuid) to authenticated;

-- ── 9. add_guest_note RPC ─────────────────────────────────────────────────────

create or replace function public.add_guest_note(
  p_raw_token   text,
  p_sub_id      uuid,
  p_note_type   text,
  p_content     text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
  v_note_id  uuid;
begin
  if p_content is null or trim(p_content) = '' then
    raise exception 'content_empty';
  end if;

  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id into v_token_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  -- Ensure the submission belongs to this token.
  if not exists (
    select 1 from public.conference_guest_submissions
    where id = p_sub_id and token_id = v_token_id
  ) then
    raise exception 'invalid_token';
  end if;

  -- Upsert: replace summary (only one per submission), append comments.
  if p_note_type = 'summary' then
    insert into public.conference_guest_notes (submission_id, note_type, content)
    values (p_sub_id, 'summary', p_content)
    on conflict do nothing
    returning id into v_note_id;

    if v_note_id is null then
      update public.conference_guest_notes
      set content = p_content, updated_at = now()
      where submission_id = p_sub_id and note_type = 'summary'
      returning id into v_note_id;
    end if;
  else
    insert into public.conference_guest_notes (submission_id, note_type, content)
    values (p_sub_id, p_note_type, p_content)
    returning id into v_note_id;
  end if;

  return v_note_id;
end;
$$;

revoke all on function public.add_guest_note(text, uuid, text, text) from public;
grant execute on function public.add_guest_note(text, uuid, text, text) to anon;
grant execute on function public.add_guest_note(text, uuid, text, text) to authenticated;

-- ── 10. register_guest_file RPC ───────────────────────────────────────────────

create or replace function public.register_guest_file(
  p_raw_token    text,
  p_sub_id       uuid,
  p_file_type    text,
  p_storage_path text,
  p_file_name    text,
  p_file_size    bigint,
  p_public_url   text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash    text;
  v_token_id uuid;
  v_file_id uuid;
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

  if not exists (
    select 1 from public.conference_guest_submissions
    where id = p_sub_id and token_id = v_token_id
  ) then
    raise exception 'invalid_token';
  end if;

  insert into public.conference_guest_files (
    submission_id, file_type, storage_path, file_name, file_size, public_url
  ) values (
    p_sub_id, p_file_type, p_storage_path, p_file_name, p_file_size, p_public_url
  )
  returning id into v_file_id;

  return v_file_id;
end;
$$;

revoke all on function public.register_guest_file(text, uuid, text, text, text, bigint, text) from public;
grant execute on function public.register_guest_file(text, uuid, text, text, text, bigint, text) to anon;
grant execute on function public.register_guest_file(text, uuid, text, text, text, bigint, text) to authenticated;

-- ── 11. request_guest_access RPC ─────────────────────────────────────────────

create or replace function public.request_guest_access(
  p_raw_token   text,
  p_sub_id      uuid,
  p_message     text
)
returns text  -- returns creator email for notification
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash      text;
  v_token_id  uuid;
  v_contact   text;
  v_email     text;
  v_creator   uuid;
  v_cr_email  text;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select t.id, t.contact_name, t.contact_email, t.created_by
  into v_token_id, v_contact, v_email, v_creator
  from public.conference_guest_tokens t
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  insert into public.conference_guest_access_requests (
    token_id, submission_id, contact_name, contact_email, message
  ) values (
    v_token_id, p_sub_id, v_contact, v_email, p_message
  )
  on conflict do nothing;

  -- Return creator email so the API layer can send a notification.
  select email into v_cr_email
  from auth.users
  where id = v_creator;

  return v_cr_email;
end;
$$;

revoke all on function public.request_guest_access(text, uuid, text) from public;
grant execute on function public.request_guest_access(text, uuid, text) to anon;
grant execute on function public.request_guest_access(text, uuid, text) to authenticated;

-- ── 12. Auto date-based stage transitions (RPC for server-side use) ───────────
-- Called server-side when loading a conference detail page.
-- Advances "intended"→"ongoing" when start_date is today or past,
-- and "registered"→"ongoing" similarly. "ongoing"→"follow_up" after end_date.
-- Never demotes: archived stays archived.

create or replace function public.auto_advance_conference_stage(p_conference_id uuid)
returns text  -- the new stage (or existing if no change)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage      text;
  v_start      date;
  v_end        date;
  v_new_stage  text;
begin
  -- Only run for comms team / admin.
  if not public.is_comms_team_or_admin() then
    raise exception 'not authorized';
  end if;

  select ct.stage, c.start_date, c.end_date
  into v_stage, v_start, v_end
  from public.conference_tracking ct
  join public.conferences c on c.id = ct.conference_id
  where ct.conference_id = p_conference_id;

  if v_stage is null then
    return null;
  end if;

  v_new_stage := v_stage;

  if v_stage in ('intended', 'registered') and v_start is not null and current_date >= v_start then
    v_new_stage := 'ongoing';
  end if;

  if v_stage in ('intended', 'registered', 'ongoing') and v_end is not null and current_date > v_end then
    v_new_stage := 'follow_up';
  end if;

  if v_new_stage <> v_stage then
    update public.conference_tracking
    set stage = v_new_stage, updated_at = now()
    where conference_id = p_conference_id;
  end if;

  return v_new_stage;
end;
$$;

revoke all on function public.auto_advance_conference_stage(uuid) from public;
grant execute on function public.auto_advance_conference_stage(uuid) to authenticated;

notify pgrst, 'reload schema';
