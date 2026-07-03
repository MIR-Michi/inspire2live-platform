-- ============================================================================
-- Remove the dead 'stories' RBAC PlatformSpace rows
-- ============================================================================
--
-- The 'stories' space governed the internal editorial Stories workspace, which
-- Sprint 15 retired; the public patient-stories feature was then retired in
-- migration 00153. The space is removed from the application vocabulary
-- (PlatformSpace / PLATFORM_SPACES / ROLE_SPACE_DEFAULTS / NavIcon / labels), so
-- any persisted 'stories' permission override is now orphan config.
--
-- Delete those rows. The CHECK constraints on these tables still list 'stories'
-- (alongside other already-retired spaces: board, bureau, network, resources,
-- notifications, partners, congress) — they are left as-is on purpose: a
-- permissive CHECK is harmless, and tightening the whole space vocabulary in the
-- DB is a separate, broader cleanup than removing one space.
--
-- Forward-only migration; historical migrations (00022/00023) are immutable.
-- ============================================================================

DELETE FROM public.user_space_permissions       WHERE space = 'stories';
DELETE FROM public.role_space_default_overrides  WHERE space = 'stories';
