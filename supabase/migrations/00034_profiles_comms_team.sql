-- ============================================================
-- MIGRATION 00034: Profiles comms flag + Moderator role reconciliation
-- ============================================================

alter table public.profiles
  add column if not exists comms_team boolean;

update public.profiles
set comms_team = false
where comms_team is null;

alter table public.profiles
  alter column comms_team set default false;

alter table public.profiles
  alter column comms_team set not null;

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
    'PlatformAdmin'
  ));

notify pgrst, 'reload schema';
