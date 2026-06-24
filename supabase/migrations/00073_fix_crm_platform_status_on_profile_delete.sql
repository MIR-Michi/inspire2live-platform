-- ============================================================
-- MIGRATION 00073: Fix stale CRM platform_status after profile deletion
--
-- comms_crm_contacts.profile_id is ON DELETE SET NULL — when a platform
-- account is deleted the CRM contact survives (correct: it is the canonical
-- identity record) but platform_status was never reset, leaving it stale
-- ('invited' or 'active') even though no profile is linked.
--
-- This migration backfills those stale rows. Going forward, the server action
-- (cleanupUserContent) resets platform_status = 'none' explicitly before the
-- profile is deleted, so this state cannot accumulate again.
-- ============================================================

update public.comms_crm_contacts
set platform_status = 'none'
where profile_id is null
  and platform_status in ('invited', 'active', 'inactive');

notify pgrst, 'reload schema';
