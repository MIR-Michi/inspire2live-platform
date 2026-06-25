-- ============================================================
-- MIGRATION 00072: Tie comms_tasks to a campus meeting
--
-- The monthly Campus meeting gets a standard checklist of tasks
-- (identify speaker & topic, receive bio & picture, prep meeting,
-- record, publish to YouTube / WordPress / WhatsApp). These are seeded
-- as `comms_tasks` when a campus session is created, so they already
-- carry an owner, a status, and flow to the owner's personal dashboard.
--
-- `campus_session_id` ties a task directly to a campus meeting (instead
-- of, or in addition to, an agenda item). When null the task is a
-- standalone or agenda-linked comms task, unchanged. Cascades on session
-- delete so a meeting's checklist disappears with it.
--
-- The existing comms_tasks RLS (comms-team read; comms-team insert /
-- update / delete) already governs the new column — no policy changes.
-- ============================================================

alter table public.comms_tasks
  add column if not exists campus_session_id uuid
    references public.campus_sessions(id) on delete cascade;

create index if not exists idx_comms_tasks_campus_session
  on public.comms_tasks(campus_session_id)
  where campus_session_id is not null;

notify pgrst, 'reload schema';
