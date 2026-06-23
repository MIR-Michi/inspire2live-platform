-- ============================================================
-- MIGRATION 00069: Campus meeting agenda + per-item meeting notes
--
-- Brings the structured agenda framework (shared agenda items with an
-- owner + drag ordering, and assignable comms_tasks linked to an agenda
-- item) to the monthly Campus meeting, reusing the same tables as the
-- weekly comms meeting:
--
--   1. `meeting_notes` — free-text notes captured against an agenda item
--      during/after the meeting (in addition to the short `summary`
--      description). Used by both weekly comms and monthly campus meetings.
--   2. `campus_session_id` — optionally ties an agenda item to a campus
--      monthly session. When null the item belongs to a weekly comms
--      meeting (grouped by `meeting_date`, unchanged); when set it belongs
--      to that campus session's agenda. Cascades on session delete.
--
-- The existing RLS on comms_weekly_agenda_items (comms-team read; owner
-- insert/update/delete) already governs these new columns — campus
-- sessions are a comms-workspace surface — so no policy changes are needed.
-- ============================================================

alter table public.comms_weekly_agenda_items
  add column if not exists meeting_notes text;

alter table public.comms_weekly_agenda_items
  add column if not exists campus_session_id uuid
    references public.campus_sessions(id) on delete cascade;

create index if not exists idx_comms_weekly_agenda_campus_session
  on public.comms_weekly_agenda_items(campus_session_id)
  where campus_session_id is not null;

notify pgrst, 'reload schema';
