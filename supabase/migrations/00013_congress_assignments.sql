-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 00013: Congress assignments (2-layer role model)
-- Adds congress-level responsibility mapping without duplicating platform roles.
--
-- Platform role (profiles.role) governs what actions a user can do.
-- Congress assignment governs where / for what they are responsible.
--
-- NOTE: This migration intentionally does NOT seed assignments because it would
-- require real profile UUIDs. The UI has demo fallbacks.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.congress_assignments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  congress_id     uuid not null references public.congress_events(id) on delete cascade,
  project_role    text not null,
  scope_all       boolean not null default true,
  workstream_ids  uuid[] not null default '{}'::uuid[],
  effective_from  date not null default current_date,
  effective_to    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint congress_assignments_project_role_check check (
    project_role in (
      'Congress Lead',
      'Scientific Lead',
      'Ops Lead',
      'Sponsor Lead',
      'Comms Lead',
      'Finance',
      'Compliance Reviewer',
      'Contributor',
      'Observer'
    )
  ),
  constraint congress_assignments_effective_dates check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint congress_assignments_scope_consistency check (
    scope_all = true or array_length(workstream_ids, 1) is not null
  ),
  unique(user_id, congress_id, project_role, effective_from)
);

create index if not exists congress_assignments_user_idx on public.congress_assignments(user_id);
create index if not exists congress_assignments_congress_idx on public.congress_assignments(congress_id);

alter table public.congress_assignments enable row level security;

-- Users can read their own assignments; coordinators/admins can read all.
DROP POLICY IF EXISTS "congress_assignments_select" ON public.congress_assignments;
create policy "congress_assignments_select" on public.congress_assignments
  for select using (
    auth.uid() = user_id
    or public.is_coordinator_or_admin()
  );

-- Only coordinators/admins can manage assignments (insert/update/delete).
DROP POLICY IF EXISTS "congress_assignments_manage" ON public.congress_assignments;
create policy "congress_assignments_manage" on public.congress_assignments
  for all using (public.is_coordinator_or_admin())
  with check (public.is_coordinator_or_admin());

-- ── Optional seed (safe): if well-known demo/admin emails exist, assign roles.
-- This keeps local demo environments functional without requiring manual inserts.
insert into public.congress_assignments (user_id, congress_id, project_role, scope_all, effective_from)
select p.id, ce.id, 'Congress Lead', true, current_date
from public.profiles p
join public.congress_events ce on ce.year = 2026
where p.email in ('michael.wittinger@gmail.com')
on conflict do nothing;

