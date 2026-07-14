/**
 * kernel/db/ownership.ts
 *
 * The non-component halves of the table-ownership reconciliation (ADR-0009 §10):
 *
 *  - KERNEL_TABLES     — tables owned by the platform kernel (identity, rbac,
 *                        notifications), not by any single component.
 *  - PENDING_OWNERSHIP  — live tables not yet claimed by a manifest at Stage 1.
 *                        These are NOT orphans; they belong to a component whose
 *                        manifest hasn't been authored yet. Each must move to a
 *                        component's `data.tables` as the per-component tasks land
 *                        (S16-T05+). This bootstrap list is expected to shrink to
 *                        empty by the end of Stage 1.
 *  - QUARANTINE        — tables that physically exist but no component owns and
 *                        which are deliberately KEPT for a stated reason, with a
 *                        re-review date. Starts EMPTY: Sprint 15's 00152 dropped
 *                        the residual orphans rather than parking them.
 *
 * Every live table must appear in exactly one of: a component manifest's
 * `data.tables`, KERNEL_TABLES, PENDING_OWNERSHIP, or QUARANTINE — otherwise the
 * reconciliation check fails.
 */

/** Kernel-owned tables (identity / rbac / notifications). */
export const KERNEL_TABLES: readonly string[] = [
  // identity
  'profiles',
  'invitations',
  // rbac
  'user_roles',
  'user_role_context',
  'user_space_permissions',
  'role_space_default_overrides',
  'permission_audit_log',
  // notifications + activity
  'notifications',
  'activity_log',
  'user_activity_events',
  'email_log',
  // platform settings store (ADR-0010) — kernel-owned, no single component
  'platform_settings',
]

/**
 * Live tables awaiting a manifest home (bootstrap; shrinks to empty over Stage 1).
 * Filled in by the reconciliation check the first time it runs — see the test.
 */
export const PENDING_OWNERSHIP: ReadonlyArray<{ table: string; likelyOwner: string }> = [
  // Legacy WP5 "partners" surface — never modularized; candidate for its own
  // `partners` component or a Stage-2 drop review. Not dropped in Sprint 15
  // because it was outside that sprint's retired-space scope.
  { table: 'partner_applications', likelyOwner: 'partners (future) or drop review' },
  { table: 'partner_audit_log', likelyOwner: 'partners (future) or drop review' },
]

/** Kept-with-reason unowned tables. Starts empty (see module header). */
export const QUARANTINE: ReadonlyArray<{
  table: string
  reason: string
  reviewBy: string
}> = []
