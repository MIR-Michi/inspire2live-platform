-- ============================================================
-- MIGRATION 00058: New-member onboarding checklists
--
--   A communications-team workflow for onboarding new members
--   (typically new @inspire2live.org users).
--
--   1. `member_onboarding` — one row per new member. Created
--      automatically when a profile with an @inspire2live.org email
--      is inserted, or manually (name + intended email, which need
--      NOT be a live mailbox yet — provisioning it can itself be a
--      task). Starts as 'pending': an admin/inviter must confirm or
--      decline before the checklist is worked.
--   2. `member_onboarding_tasks` — the checklist items. Comms-team
--      tasks (e.g. create email address, grant system access), each
--      optionally assigned to a specific person, with a status.
--      Task templates are intentionally left empty for now.
--
--   Access mirrors the rest of the comms workspace via
--   is_comms_team_or_admin().
-- ============================================================

-- 1. Member onboarding records --------------------------------------
create table if not exists public.member_onboarding (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  -- Free text on purpose: the @inspire2live.org address may not be
  -- provisioned yet (creating it can be one of the onboarding tasks).
  email text,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'declined', 'completed')
  ),
  -- Set when the member is also a platform user. Null for members
  -- registered before they have an account.
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_onboarding_status
  on public.member_onboarding(status);

create unique index if not exists uq_member_onboarding_profile
  on public.member_onboarding(profile_id)
  where profile_id is not null;

-- 2. Checklist tasks ------------------------------------------------
create table if not exists public.member_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.member_onboarding(id) on delete cascade,
  title text not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed', 'skipped')
  ),
  position integer not null default 0,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_onboarding_tasks_onboarding
  on public.member_onboarding_tasks(onboarding_id, position);

-- 3. Auto-create a pending record for new @inspire2live.org users ----
create or replace function public.handle_new_member_onboarding()
returns trigger as $$
begin
  if new.email is not null and lower(new.email) like '%@inspire2live.org' then
    insert into public.member_onboarding (full_name, email, profile_id, status)
    values (coalesce(nullif(new.name, ''), new.email), new.email, new.id, 'pending')
    on conflict (profile_id) where profile_id is not null do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created_member_onboarding on public.profiles;
create trigger on_profile_created_member_onboarding
  after insert on public.profiles
  for each row execute function public.handle_new_member_onboarding();

-- 4. RLS — comms team + admins manage everything --------------------
alter table public.member_onboarding enable row level security;
alter table public.member_onboarding_tasks enable row level security;

drop policy if exists member_onboarding_all on public.member_onboarding;
create policy member_onboarding_all on public.member_onboarding
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists member_onboarding_tasks_all on public.member_onboarding_tasks;
create policy member_onboarding_tasks_all on public.member_onboarding_tasks
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
