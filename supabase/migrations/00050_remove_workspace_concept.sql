-- ============================================================
-- MIGRATION 00050: Remove workspace concept — derive everything from role
--
-- The platform previously layered a "workspace" concept (user_type:
-- 'default'|'comms'|'board'|'partner', plus a legacy comms_team boolean)
-- on top of roles. This collapses that into role alone:
--   - Adds 'Comms' as a first-class PlatformRole
--   - 'board'/'partner' workspaces fold into the existing BoardMember /
--     IndustryPartner roles, which already drive dashboardVariant
--   - Drops user_type and comms_team from profiles entirely
-- ============================================================

-- 1) Allow the new 'Comms' role value
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'PatientAdvocate',
    'Clinician',
    'Researcher',
    'Moderator',
    'HubCoordinator',
    'IndustryPartner',
    'BoardMember',
    'PlatformAdmin',
    'Comms'
  ));

alter table public.role_space_default_overrides
  drop constraint if exists rsdo_role_check;

alter table public.role_space_default_overrides
  add constraint rsdo_role_check
  check (role in (
    'PatientAdvocate',
    'Clinician',
    'Researcher',
    'Moderator',
    'HubCoordinator',
    'IndustryPartner',
    'BoardMember',
    'PlatformAdmin',
    'Comms'
  ));

-- 2) Promote everyone who currently has comms access via the old
--    workspace flags (or the canonical fallback email) to role = 'Comms'.
--    PlatformAdmins keep their role — admin already implies comms access.
update public.profiles
set role = 'Comms'
where role <> 'PlatformAdmin'
  and (user_type = 'comms' or comms_team = true or email = 'marsu101@proton.me');

-- 3) Redefine is_comms_team_or_admin() — the single chokepoint every
--    comms RLS policy calls — to be purely role-based. Must happen
--    BEFORE the comms_team column is dropped.
create or replace function public.is_comms_team_or_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Comms', 'PlatformAdmin')
  );
$$;

-- 4) Redefine current_user_context() to drop the removed columns from
--    its payload. Must happen BEFORE the columns are dropped.
create or replace function public.current_user_context()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object('role', role)
  from public.profiles
  where id = auth.uid();
$$;

-- 5) Drop the now-unused workspace columns and their constraint.
alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  drop column if exists user_type;

alter table public.profiles
  drop column if exists comms_team;

notify pgrst, 'reload schema';
