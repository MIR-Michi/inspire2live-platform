-- ============================================================
-- MIGRATION 00103: Tie comms_tasks to a conference
--
-- Conference tasks live in the same comms_tasks table and work
-- exactly like campus-session tasks but are linked to a conference
-- instead. Tasks are assignable to any profile (defaulting to the
-- conference attendees) and support CRUD from the operating page.
-- Cascade-deletes when the conference is removed.
-- ============================================================

alter table public.comms_tasks
  add column if not exists conference_id uuid
    references public.conferences(id) on delete cascade;

create index if not exists idx_comms_tasks_conference
  on public.comms_tasks(conference_id)
  where conference_id is not null;

notify pgrst, 'reload schema';
