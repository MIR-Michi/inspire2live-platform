-- ============================================================
-- MIGRATION 00160: SUPERADMIN ROLE
--
-- Adds a second admin tier, "Superadmin". It shares EVERY permission with
-- PlatformAdmin — the only difference is an app-layer capability (view-as /
-- preview other roles & users), gated in the UI, not in the database.
--
-- Design that keeps the change low-risk:
--   * current_user_role() COLLAPSES Superadmin -> PlatformAdmin, so every
--     existing RLS policy (`current_user_role() = 'PlatformAdmin'`, the
--     is_coordinator_or_admin() family, …) treats a Superadmin exactly like a
--     PlatformAdmin with ZERO policy changes.
--   * A BEFORE UPDATE trigger prevents anyone who is not already a Superadmin
--     from granting or revoking the Superadmin role — closing the escalation
--     path opened by the client-side role editor (which writes profiles.role
--     directly under the caller's own session).
-- ============================================================

-- 1) Allow the new role value on profiles and on the role-defaults overrides.
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
    'Comms',
    'Superadmin'
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
    'Comms',
    'Superadmin'
  ));

-- 2) Collapse Superadmin -> PlatformAdmin for ALL authorization. Every RLS
--    policy that compares current_user_role() to 'PlatformAdmin' now passes for
--    a Superadmin too, so both admin tiers have identical database rights.
create or replace function public.current_user_role()
returns text as $$
  select case when role = 'Superadmin' then 'PlatformAdmin' else role end
  from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- 3) A raw (non-collapsed) check for the elevated tier — used only by the
--    escalation guard below. Reads the true stored role.
create or replace function public.is_superadmin()
returns boolean as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'Superadmin',
    false
  );
$$ language sql security definer stable;

-- 4) Escalation guard: only a Superadmin may grant or revoke the Superadmin
--    role. Server-side/service-role contexts (auth.uid() is null — migrations,
--    trusted admin jobs) are exempt; the guard targets the authenticated
--    (browser session) role-editor path, which is the actual escalation vector.
create or replace function public.enforce_superadmin_grant()
returns trigger as $$
begin
  if auth.uid() is null then
    return new; -- trusted server-side / migration context
  end if;
  if (new.role = 'Superadmin') is distinct from (old.role = 'Superadmin') then
    if not public.is_superadmin() then
      raise exception 'Only a Superadmin can grant or revoke the Superadmin role';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_superadmin_grant on public.profiles;
create trigger trg_enforce_superadmin_grant
  before update of role on public.profiles
  for each row execute function public.enforce_superadmin_grant();

-- 5) Upgrade the founding admin account to Superadmin.
update public.profiles
  set role = 'Superadmin'
  where lower(email) = 'michael.wittinger@gmail.com';
