-- ============================================================
-- Migration 00041: Canonical platform admins
-- Preserves the two original admin identities across environments
-- ============================================================

update public.profiles
set role = 'PlatformAdmin'
where email in ('marsu101@proton.me', 'michael.wittinger@gmail.com');

update public.profiles
set role = 'PlatformAdmin'
where id in (
  select id
  from auth.users
  where email in ('marsu101@proton.me', 'michael.wittinger@gmail.com')
);

notify pgrst, 'reload schema';
