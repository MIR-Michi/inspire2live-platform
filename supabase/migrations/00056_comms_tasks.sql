-- ============================================================
-- MIGRATION 00056: Communications team tasks
--
--   1. A `comms_tasks` table — standalone team tasks (title,
--      description, owner, deadline) with a shared completion status.
--      Created from the team dashboard; surfaced on the owner's personal
--      dashboard. Status uses the unified vocabulary.
--   2. Remove the completion status from weekly agenda items — agenda
--      items are discussion points, not tracked tasks.
-- ============================================================

-- 1. Team tasks ------------------------------------------------------
create table if not exists public.comms_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed', 'skipped')
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comms_tasks_owner
  on public.comms_tasks(owner_id)
  where owner_id is not null;

create index if not exists idx_comms_tasks_status
  on public.comms_tasks(status);

create index if not exists idx_comms_tasks_due
  on public.comms_tasks(due_date)
  where due_date is not null;

alter table public.comms_tasks enable row level security;

-- The comms team is small and collaborative: any comms-workspace member
-- (or admin) can read all tasks, create tasks (assigning any owner), and
-- update/delete them (owners update their own status; managers can adjust).
drop policy if exists comms_tasks_read on public.comms_tasks;
create policy comms_tasks_read on public.comms_tasks
  for select
  using (public.is_comms_team_or_admin());

drop policy if exists comms_tasks_insert on public.comms_tasks;
create policy comms_tasks_insert on public.comms_tasks
  for insert
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_tasks_update on public.comms_tasks;
create policy comms_tasks_update on public.comms_tasks
  for update
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_tasks_delete on public.comms_tasks;
create policy comms_tasks_delete on public.comms_tasks
  for delete
  using (public.is_comms_team_or_admin());

-- 2. Agenda items no longer carry a completion status ----------------
alter table public.comms_weekly_agenda_items
  drop column if exists status;

notify pgrst, 'reload schema';
