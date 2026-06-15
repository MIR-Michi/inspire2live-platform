-- ============================================================
-- MIGRATION 00059: Onboarding records follow user deletion
--
--   Migration 00058 linked member_onboarding.profile_id to profiles
--   with ON DELETE SET NULL. That leaves a "ghost" onboarding row on
--   the comms dashboard when a platform user is deleted: profile_id
--   becomes null but the record keeps its pending/active status and
--   can never be tied back to anyone.
--
--   Auto-created records (one per @inspire2live.org user) should
--   disappear with the user. Switch to ON DELETE CASCADE. Manually
--   registered members keep profile_id null from the start, so they
--   are never affected by a profile deletion.
-- ============================================================

alter table public.member_onboarding
  drop constraint if exists member_onboarding_profile_id_fkey;

alter table public.member_onboarding
  add constraint member_onboarding_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
