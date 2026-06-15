-- ============================================================
-- MIGRATION 00060: Look up an auth user id by email (admin only)
--
--   Re-inviting an email after deleting the user can fail with
--   "link expired or already used" when a stale auth.users record
--   lingers for that email (e.g. a prior delete removed the profile
--   but not the auth record, or replication left an orphan). In that
--   state inviteUserByEmail resends against the stale user instead of
--   minting a fresh invite, so the emailed token is already spent.
--
--   inviteUserAccount only checks public.profiles — it cannot see
--   auth.users. This SECURITY DEFINER helper lets the server action
--   (service role) find and purge a lingering auth user before
--   inviting, guaranteeing a fresh invite token every time.
-- ============================================================

create or replace function public.admin_get_auth_user_id(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Only the service role (used by the admin server actions) may call it.
revoke all on function public.admin_get_auth_user_id(text) from public;
grant execute on function public.admin_get_auth_user_id(text) to service_role;

notify pgrst, 'reload schema';
