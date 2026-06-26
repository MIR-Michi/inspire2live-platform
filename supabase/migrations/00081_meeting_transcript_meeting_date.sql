-- ============================================================
-- MIGRATION 00081: Anchor a transcript to a bi-weekly meeting
--
-- Sprint 14 Capability 2 UX: transcripts are uploaded from inside an
-- existing meeting. Campus meetings already anchor via campus_session_id;
-- the bi-weekly (weekly) comms meeting is grouped by meeting_date, so add a
-- matching meeting_date column. A transcript belongs to a weekly meeting
-- (meeting_date set) OR a campus session (campus_session_id set), or is
-- standalone.
-- ============================================================

alter table public.meeting_transcripts
  add column if not exists meeting_date date;

create index if not exists idx_meeting_transcripts_meeting_date
  on public.meeting_transcripts(meeting_date)
  where meeting_date is not null;

-- meeting_summaries mirror the link for convenience when filing a summary.
alter table public.meeting_summaries
  add column if not exists meeting_date date;

notify pgrst, 'reload schema';
