-- ============================================================================
-- Retire the patient-stories feature (public site + content)
-- ============================================================================
--
-- The public patient-stories site (/stories, /stories/[slug]) and its module are
-- deleted from the runtime. These tables backed only that feature and have no
-- remaining readers:
--   * no other table holds a foreign key INTO them — the only inbound FKs are
--     within this cluster (patient_story_events / story_status_changes →
--     patient_stories, ON DELETE CASCADE);
--   * no application code queries them (the internal editorial workspace was
--     retired in Sprint 15; the public site is removed in this change);
--   * they only depend OUTWARD on profiles (ON DELETE CASCADE), which is
--     unaffected by dropping them.
--
-- Content is intentionally dropped (product decision — the feature is not
-- retained). CASCADE removes the cluster's own indexes, RLS policies and
-- triggers; the four story-specific trigger functions are then dropped as they
-- become dead.
--
-- Forward-only migration; historical migrations (00017, 00019) are immutable and
-- left untouched. The matching patient_stories / patient_story_events seed blocks
-- are removed from seed.sql in the same change so `supabase db reset` (seed runs
-- after migrations) does not target a dropped table.
--
-- NOTE (separate follow-up, deliberately NOT in this migration): the 'stories'
-- RBAC PlatformSpace vocabulary + its historical permission seed rows
-- (migrations 00022/00023) governed the already-retired *internal* editorial
-- workspace and are dead config; cleaning them touches the permission model
-- (Record<PlatformSpace,…> exhaustiveness) and is scoped to its own change.
-- ============================================================================

DROP TABLE IF EXISTS
  public.story_status_changes,
  public.patient_story_events,
  public.patient_stories
CASCADE;

-- Story-specific trigger functions, now dead (their triggers went with the tables).
DROP FUNCTION IF EXISTS public.log_patient_story_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_moderator_patient_story_update() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_patient_story_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_patient_story_author_change() CASCADE;
