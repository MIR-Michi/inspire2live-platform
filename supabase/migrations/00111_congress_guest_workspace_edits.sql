-- ============================================================
-- MIGRATION 00111: Congress guest workspace — edit / delete / toggle
--
-- The guest workspace must be fully editable: a guest can come back any time
-- and add, edit, or delete their summary, photos, presentations and comments,
-- and toggle their registration on or off. This migration adds the missing
-- delete/toggle RPCs and fixes the summary so editing updates the single row
-- instead of piling up duplicates.
--
-- All RPCs are SECURITY DEFINER with search_path = '' and qualify pgcrypto's
-- digest as extensions.digest (see migration 00110 for the rationale).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 1. One summary per submission ─────────────────────────────────────────────
-- Collapse any accidental duplicate summaries (keep the most recent), then
-- enforce a single summary row per submission so edits update in place.

with ranked as (
  select id, submission_id,
         row_number() over (partition by submission_id order by updated_at desc, created_at desc) as rn
  from public.conference_guest_notes
  where note_type = 'summary'
)
delete from public.conference_guest_notes n
using ranked r
where n.id = r.id and r.rn > 1;

create unique index if not exists idx_conf_guest_notes_one_summary
  on public.conference_guest_notes (submission_id)
  where note_type = 'summary';

-- Rewrite add_guest_note: update the existing summary in place (no reliance on
-- an implicit conflict target), append comments.
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

  if not exists (
    select 1 from public.conference_guest_submissions
    where id = p_sub_id and token_id = v_token_id
  ) then
    raise exception 'invalid_token';
  end if;

  if p_note_type = 'summary' then
    update public.conference_guest_notes
    set content = p_content, updated_at = now()
    where submission_id = p_sub_id and note_type = 'summary'
    returning id into v_note_id;

    if v_note_id is null then
      insert into public.conference_guest_notes (submission_id, note_type, content)
      values (p_sub_id, 'summary', p_content)
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

-- ── 2. delete_guest_note ──────────────────────────────────────────────────────

create or replace function public.delete_guest_note(
  p_raw_token text,
  p_note_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
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

  delete from public.conference_guest_notes n
  using public.conference_guest_submissions s
  where n.id = p_note_id
    and n.submission_id = s.id
    and s.token_id = v_token_id;
end;
$$;

revoke all on function public.delete_guest_note(text, uuid) from public;
grant execute on function public.delete_guest_note(text, uuid) to anon;
grant execute on function public.delete_guest_note(text, uuid) to authenticated;

-- ── 3. delete_guest_file ──────────────────────────────────────────────────────
-- Returns the storage path so the API layer can remove the object too.

create or replace function public.delete_guest_file(
  p_raw_token text,
  p_file_id   uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
  v_path     text;
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

  delete from public.conference_guest_files f
  using public.conference_guest_submissions s
  where f.id = p_file_id
    and f.submission_id = s.id
    and s.token_id = v_token_id
  returning f.storage_path into v_path;

  return v_path;
end;
$$;

revoke all on function public.delete_guest_file(text, uuid) from public;
grant execute on function public.delete_guest_file(text, uuid) to anon;
grant execute on function public.delete_guest_file(text, uuid) to authenticated;

-- ── 4. set_guest_registered (toggle on/off) ───────────────────────────────────
-- Replaces the one-way mark_guest_registered so a guest can also uncheck it.
-- Turning it on advances the pipeline to "registered" (never demoting a
-- conference that's already ongoing/follow_up/archived). Turning it off leaves
-- the pipeline stage untouched — un-checking a box shouldn't roll the team's
-- pipeline backwards.

create or replace function public.set_guest_registered(
  p_raw_token   text,
  p_sub_id      uuid,
  p_registered  boolean
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
  set is_registered = p_registered
  where id = p_sub_id and token_id = v_token_id
  returning conference_id into v_conf_id;

  if p_registered and v_conf_id is not null then
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

revoke all on function public.set_guest_registered(text, uuid, boolean) from public;
grant execute on function public.set_guest_registered(text, uuid, boolean) to anon;
grant execute on function public.set_guest_registered(text, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
