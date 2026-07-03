-- ============================================================================
-- Sprint 15 — Stage C (completion): drop the residual retired-space orphan tables
-- ============================================================================
--
-- Stage C (migration 00151) conservatively dropped only the internal Annual
-- Congress *workspace* tables. Finishing the Sprint-15 dead-code scan then
-- confirmed a further set of tables that belong to already-retired spaces
-- (Network, Board/Bureau, the congress topic-voting path) and now have
-- **zero live readers**. Each was verified safe to drop:
--
--   * no application code queries them — the only remaining reference is the
--     graceful account-purge helper in admin/users/actions.ts, whose tryOp
--     wrapper swallows 42P01 / "does not exist";
--   * no KEPT table holds a foreign key INTO them — the only inbound FKs are
--     within this drop set (discussion_replies → discussions,
--     partner_audit_entries → partner_engagements);
--   * no view depends on them;
--   * their triggers are dropped with the tables by CASCADE. The two count
--     triggers updated tables that are themselves gone: update_reply_count()
--     targets discussions (dropped here) and update_vote_count() targets
--     congress_topics (already dropped by 00151). Both trigger functions are
--     now dead and are dropped below.
--
-- The kept, still-live tables of the same families are deliberately NOT touched:
--   * hubs                — read by the kept World Campus Log hub selector
--   * resources           — read by the kept Initiatives → Evidence page
--   * notifications        — written/read by the kept app-shell notification bell
--   * congress_events / _assignments / _activity_log / _members — kept in 00151
--
-- Forward-only migration. Historical migrations are immutable and left untouched
-- (their inserts run in order, before this drop, on a fresh reset). The matching
-- seed.sql hub_members block is removed in the same change so `supabase db reset`
-- (which runs seed.sql AFTER all migrations) does not target a dropped table.
-- ============================================================================

DROP TABLE IF EXISTS
  public.hub_members,
  public.hub_initiatives,
  public.discussion_replies,
  public.discussions,
  public.partner_audit_entries,
  public.partner_engagements,
  public.resource_translations,
  public.topic_votes
CASCADE;

-- Trigger functions left dead by the drops above (their triggers went with the
-- tables; the function bodies now reference non-existent tables).
DROP FUNCTION IF EXISTS public.update_reply_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_vote_count() CASCADE;
