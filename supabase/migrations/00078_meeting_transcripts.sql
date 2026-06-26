-- ============================================================
-- MIGRATION 00078: MEETING TRANSCRIPTS + SUMMARIES
--
-- Sprint 14 Capability 2 (Summarize meetings from a transcript):
-- - meeting-transcripts Storage bucket (private, comms-only) for the
--   uploaded raw file (txt/vtt/srt/docx)
-- - meeting_transcripts: extracted plain text + provenance, optionally
--   linked to a campus session or weekly agenda item, or standalone
-- - meeting_summaries: the reviewable structured summary Claude produces
--   (TL;DR, decisions, action items, publication blurb)
--
-- Transcripts can carry sensitive discussion, so access is restricted to
-- the communications team / PlatformAdmin (is_comms_team_or_admin), and the
-- raw upload may be deleted after a summary is produced (raw_deleted_at).
-- ============================================================

-- ── Storage bucket for raw transcript uploads ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-transcripts',
  'meeting-transcripts',
  false, -- private: sensitive meeting content, comms-only via RLS
  26214400, -- 25MB limit
  array[
    'text/plain',
    'text/vtt',
    'application/x-subrip',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- meeting-transcripts: Read — comms team / admin only
drop policy if exists "meeting_transcripts_storage_read" on storage.objects;
create policy "meeting_transcripts_storage_read" on storage.objects
  for select using (
    bucket_id = 'meeting-transcripts' and public.is_comms_team_or_admin()
  );

-- meeting-transcripts: Write — comms team / admin only
drop policy if exists "meeting_transcripts_storage_write" on storage.objects;
create policy "meeting_transcripts_storage_write" on storage.objects
  for insert with check (
    bucket_id = 'meeting-transcripts' and public.is_comms_team_or_admin()
  );

-- meeting-transcripts: Delete — comms team / admin only (raw deletion post-summary)
drop policy if exists "meeting_transcripts_storage_delete" on storage.objects;
create policy "meeting_transcripts_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'meeting-transcripts' and public.is_comms_team_or_admin()
  );

-- ── meeting_transcripts ────────────────────────────────────
create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_filename text,
  source_format text not null
    check (source_format in ('txt', 'vtt', 'srt', 'docx')),
  extracted_text text not null,
  -- Storage object path for the raw upload. Cleared when the raw file is
  -- deleted after a summary is produced (raw_deleted_at is then set).
  storage_path text,
  raw_deleted_at timestamptz,
  -- Optional links: a transcript may belong to a campus session, a weekly
  -- agenda item, or neither (standalone).
  campus_session_id uuid references public.campus_sessions(id) on delete set null,
  agenda_item_id uuid references public.comms_weekly_agenda_items(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meeting_transcripts is 'Uploaded meeting transcripts (text extracted from txt/vtt/srt/docx). Sensitive — comms-only RLS. Raw upload may be deleted post-summary.';

create index if not exists idx_meeting_transcripts_campus_session
  on public.meeting_transcripts(campus_session_id)
  where campus_session_id is not null;
create index if not exists idx_meeting_transcripts_agenda_item
  on public.meeting_transcripts(agenda_item_id)
  where agenda_item_id is not null;
create index if not exists idx_meeting_transcripts_created_at
  on public.meeting_transcripts(created_at desc);

alter table public.meeting_transcripts enable row level security;

drop policy if exists meeting_transcripts_comms_access on public.meeting_transcripts;
create policy meeting_transcripts_comms_access
  on public.meeting_transcripts
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists meeting_transcripts_set_updated_at on public.meeting_transcripts;
create trigger meeting_transcripts_set_updated_at
  before update on public.meeting_transcripts
  for each row execute function public.set_updated_at();

-- ── meeting_summaries ──────────────────────────────────────
create table if not exists public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.meeting_transcripts(id) on delete cascade,
  tldr text not null,
  decisions jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  publication_blurb text,
  -- Where the human filed the summary on save: a campus session, a weekly
  -- agenda item, or standalone.
  campus_session_id uuid references public.campus_sessions(id) on delete set null,
  agenda_item_id uuid references public.comms_weekly_agenda_items(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'saved', 'discarded', 'superseded')),
  chunked boolean not null default false,
  model text,
  effort text,
  raw_response jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  saved_by uuid references public.profiles(id) on delete set null,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meeting_summaries is 'Reviewable structured meeting summary (TL;DR, decisions, action items, publication blurb) produced by Claude from a meeting_transcripts row. Human confirms before it is saved.';

create index if not exists idx_meeting_summaries_transcript
  on public.meeting_summaries(transcript_id, created_at desc);

create unique index if not exists idx_meeting_summaries_one_pending
  on public.meeting_summaries(transcript_id)
  where status = 'pending';

alter table public.meeting_summaries enable row level security;

drop policy if exists meeting_summaries_comms_access on public.meeting_summaries;
create policy meeting_summaries_comms_access
  on public.meeting_summaries
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists meeting_summaries_set_updated_at on public.meeting_summaries;
create trigger meeting_summaries_set_updated_at
  before update on public.meeting_summaries
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
