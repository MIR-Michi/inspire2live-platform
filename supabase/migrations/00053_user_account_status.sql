-- ============================================================
-- MIGRATION 00053: USER ACCOUNT STATUS (active / inactive)
--
-- Adds an admin-managed account status so PlatformAdmins can
-- deactivate (suspend) and reactivate users without deleting
-- them. Inactive users are blocked from the app in middleware.
--
-- Also extends the permission_audit_log change_type vocabulary
-- so status changes and full deletions are recorded.
-- ============================================================

-- ── 1) profiles.status ──────────────────────────────────────
alter table public.profiles
  add column if not exists status text;

update public.profiles
set status = 'active'
where status is null;

alter table public.profiles
  alter column status set default 'active';

alter table public.profiles
  alter column status set not null;

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive'));

create index if not exists idx_profiles_status on public.profiles (status);

-- ── 2) Extend audit log change types ────────────────────────
alter table public.permission_audit_log
  drop constraint if exists permission_audit_log_change_type_check;

alter table public.permission_audit_log
  add constraint permission_audit_log_change_type_check
  check (change_type in (
    'role_change',
    'permission_override',
    'assignment_change',
    'status_change',
    'user_deleted'
  ));

notify pgrst, 'reload schema';
