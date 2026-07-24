-- ============================================================
-- MIGRATION 00170: Tie comms_tasks to an event (podcast workspace)
--
-- The podcast workspace replaces its fixed setup/run/follow-up boolean
-- checklist with an editable task list — the same shape as the monthly
-- Campus meeting checklist (title, owner, deadline, unified status),
-- seeded from a standard template when the workspace is first opened.
--
-- `event_id` ties a task directly to an event (a podcast episode). When
-- null the task is a standalone, agenda-, campus- or conference-linked
-- comms task, unchanged. Cascades on event delete so an episode's
-- checklist disappears with it.
--
-- The existing comms_tasks RLS (comms-team read; comms-team insert /
-- update / delete) already governs the new column — no policy changes.
-- ============================================================

alter table public.comms_tasks
  add column if not exists event_id uuid
    references public.events(id) on delete cascade;

create index if not exists idx_comms_tasks_event
  on public.comms_tasks(event_id)
  where event_id is not null;

notify pgrst, 'reload schema';
