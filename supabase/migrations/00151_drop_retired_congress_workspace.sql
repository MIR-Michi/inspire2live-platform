-- ============================================================================
-- Sprint 15 — Stage C: drop the retired internal Annual Congress workspace tables
-- ============================================================================
--
-- The internal Annual Congress workspace (all /app/congress pages, components and
-- libs) was deleted from the runtime in Stage B. These tables backed only that
-- retired subsystem and now have zero live readers:
--   * no application code queries them (only stale generated types in
--     src/types/database.ts and the graceful, missing-table-tolerant account-purge
--     helper in admin/users/actions.ts, which skips 42P01 / "does not exist");
--   * no live DB function, trigger or RPC writes to them (the only historical
--     references live in already-applied migrations 00024/00054 that never re-run);
--   * the kept congress-*guest* feature (conference guest tokens / attendance) does
--     not touch any of them.
--
-- Deliberately KEPT (still referenced by live surfaces — do NOT drop here):
--   * congress_events        — admin surfaces + FK parent; data preserved
--   * congress_assignments   — data preserved (assignment history)
--   * congress_activity_log  — read by the kept Admin activity metrics
--   * congress_members       — written by the invitation-accept RPC (00027) and
--                              has a live updated_at trigger; keep until that path
--                              is retired too
--
-- Forward-only migration. Historical migrations are immutable and left untouched.
-- CASCADE resolves the internal FK graph and drops the retired tables' own indexes,
-- RLS policies and triggers. Any FK *constraint* a kept table holds into these
-- tables (e.g. congress_events.theme_id / carryover_from_topic_id) is removed by
-- CASCADE; the kept columns and their data remain intact.
-- ============================================================================

DROP TABLE IF EXISTS
  public.congress_task_dependencies,
  public.congress_tasks,
  public.congress_raid_items,
  public.congress_approval_requests,
  public.congress_follow_up_actions,
  public.congress_live_ops_updates,
  public.congress_messages,
  public.congress_assets,
  public.congress_milestones,
  public.congress_session_attendees,
  public.congress_session_notes,
  public.congress_sessions,
  public.congress_topic_votes,
  public.congress_topics,
  public.congress_decisions,
  public.congress_workstreams,
  public.congress_event_themes,
  public.congress_themes
CASCADE;
