# ADR-0008: Unified Task Domain Layer (view + adapters, not a god-table)

- **Status:** accepted
- **Date:** 2026-06-25
- **Owners:** Michael Wittinger

## Context

The platform has grown three separate "task" stores, each created for a different surface:

- **`tasks`** — initiative/project work. Required `initiative_id` + `reporter_id`, `priority`,
  `milestone_id`, a `todo/in_progress/review/done/blocked` workflow, `congress_decision_id`
  provenance, `tags`. Strongly typed in the generated DB types. RLS keyed on initiative membership.
- **`comms_tasks`** — lightweight communications-team to-dos (and, since ADR work on campus,
  the per-meeting checklist). Optional context (`agenda_item_id`, `campus_session_id`), simple
  `not_started/in_progress/completed/skipped` status, no priority/reporter. RLS via
  `is_comms_team_or_admin()`. Not in generated types (accessed as `any`).
- **`member_onboarding_tasks`** — new-member onboarding checklist items. `position` ordering plus
  lifecycle coupling: completing a task reconciles the member's onboarding state and logs a CRM
  interaction. RLS via `is_comms_team_or_admin()`. Not in generated types.

The duplication is felt in the **application layer**, not the database: three near-identical loaders
(`comms-dashboard-data`, `comms-personal-dashboard-data`, `member-onboarding`, plus the dashboard
pages), three status-control components, and three status vocabularies that already get mapped to one
unified set at display time in `lib/comms-status.ts`. The recent fix that surfaced onboarding tasks on
the personal dashboard had to hand-wire a fourth query because there was no shared task abstraction.

We want "one task system" from the application's point of view, without taking on a high-risk schema
migration of initiative/congress/bureau surfaces.

- Related requirements: `REQ-TASK-001` (single task abstraction for assignment + dashboards),
  `REQ-TASK-002` (every task has an owner), `REQ-SEC-001` (per-context access preserved).

## Decision

Adopt a **single task domain layer in TypeScript over focused, purpose-built storage tables**, plus a
**read-only SQL view** for cross-cutting reads. Do **not** merge the three tables into one physical table.

1. **`unified_tasks` view (read path).** A read-only Postgres view that `UNION ALL`s the three tables
   into one shape: `source`, `id`, `title`, `description`, `owner_id`, `status` (raw), `due_date`,
   `priority`, `position`, `context_kind`, `context_id`. Created **`with (security_invoker = true)`** so
   each underlying table's RLS still applies to the querying user — the view grants no extra visibility.

2. **`src/lib/tasks/` domain layer (single source of truth for behavior).**
   - `types.ts` — a discriminated `UnifiedTask` type keyed by `source`.
   - `status.ts` — one canonical status vocabulary (the comms set:
     `not_started/in_progress/completed/skipped`) and the per-source normalizers.
   - `repository.ts` — reads from `unified_tasks` and resolves owner + context labels/hrefs
     (`loadTasksForUser`).
   - `actions.ts` — one `updateTaskStatus` / `reassignTask` entry point that **delegates to a thin
     adapter per source**. The adapters reuse the existing source-specific server actions, which already
     encapsulate that table's RLS, revalidation, notifications, and side-effects (onboarding completion
     reconcile + CRM logging). No side-effect logic is duplicated.

3. **One canonical status vocabulary.** The comms set is canonical because it is already the unified
   display vocabulary. Comms and onboarding tasks store it natively. Initiative `review`/`blocked` map to
   `in_progress` for the unified view; the richer initiative workflow stays intact in its own table and
   workspace UI.

4. **Writes stay per-source.** Comms and onboarding tasks are interactive everywhere (status + reassign).
   Initiative tasks remain read-only on shared/aggregated surfaces (as they are today) and are edited in
   the initiative workspace, which keeps its richer control. The unified component renders an interactive
   control for comms/onboarding and a read-only badge + deep link for initiative tasks.

5. **Strong typing.** `comms_tasks` and `member_onboarding_tasks` are registered in the generated DB
   types over time so the `as any` handles can be removed.

## Alternatives considered

1. **Single physical `tasks` table (polymorphic god-table).** Make `initiative_id` nullable, add typed
   nullable context FKs for every source, an "exactly one context" CHECK matrix, an OR-based RLS policy
   spanning initiative membership *and* comms-team access, and branching triggers for the per-source
   side-effects. This concentrates complexity into the three hardest-to-audit places (constraints, a
   single security-sensitive RLS policy, branching triggers), requires a data migration with a transition
   window, and drags initiative/congress/bureau RLS into a change that is really about comms. Rejected:
   higher risk, not actually simpler.

2. **Do nothing / keep hand-wiring per surface.** Cheapest now, but every new surface re-implements task
   loading and the next "show task type X here" repeats the recent onboarding fix. Rejected: unsustainable.

3. **View + domain layer over focused tables (chosen).** One task type, one set of actions, one status
   vocabulary, one component set — the felt duplication is removed — while each table keeps its tight RLS
   and triggers. Adding a new task context later is one adapter + one line in the view, not a migration.

## Consequences

### Positive

- The application sees exactly one task system: one `UnifiedTask` type, one status control, one loader.
- No data migration, fully reversible, zero risk to initiative/congress/bureau.
- Each table keeps a small, auditable RLS policy; no OR-policy security chokepoint.
- Extensible: a new task context (e.g. event tasks) is a thin adapter + a `UNION` arm.
- `security_invoker` keeps the view honest — it cannot leak rows a user couldn't already read.

### Negative / trade-offs

- Cross-source ordering/pagination happens over a `UNION` view, not a single indexed table — fine at
  current volumes, but a very large "all tasks everywhere" report may want materialization later.
- The status mapping layer remains until stored vocabularies are converged (a later, optional migration).
- Three write paths still exist physically; the unification is a contract, enforced by convention + the
  domain layer, not by the database.

### When the god-table would become right

If initiative, comms, and onboarding tasks converge to genuinely identical semantics and we need
DB-level cross-context constraints or a single transaction across them. They do not today, and we will
not pre-build for a convergence that may never happen.

## Rollout / Migration plan

**Phase 1 (this change):**
1. Add the `unified_tasks` view (migration `00075`, `security_invoker = true`).
2. Build `src/lib/tasks/` (types, status, repository, delegating actions).
3. Add `UnifiedTaskList` + `UnifiedTaskStatusControl` components.
4. Migrate the comms **personal dashboard** "my tasks" to render all of a user's tasks (initiative +
   comms + onboarding) via the repository, with correct open/overdue counts.
5. Unit tests for status normalization and repository mapping.

**Phase 2 (later, optional):** migrate the team dashboard, campus meeting page, and initiative views onto
the same domain layer; register the comms/onboarding tables in generated types and delete `as any`;
converge stored status vocabularies so the mapping layer can be removed.

## References

- PR: _this branch (`feat/unified-task-domain-layer`)_
- Related: ADR-0006 (Communications Workspace), ADR-0007 (Unified Contact Identity), `lib/comms-status.ts`.
