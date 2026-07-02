# Sprint 15 — Legacy Cleanup (retire dead spaces, workflows & demo artefacts)

> **Status:** In Progress
> **Theme:** Remove legacy spaces, workflows, demo content, and dead artefacts that create noise — **without disrupting anything in use.**
> **Depends on:** Sprints 01–14 (the features being kept); the unified nav (`src/lib/role-access.ts`) as the source of truth for "active" surfaces.

## Goal

The platform has accumulated artefacts from earlier versions: orphaned pages, empty demo stubs, misnamed modules, and generic spaces superseded by newer ones. They add cognitive load and make the codebase look larger than it is. This sprint removes them **safely and reversibly**, on one hard rule: nothing is deleted until it is proven unused *or* explicitly approved for retirement, and every batch leaves `tsc` + lint + unit tests green.

Shipping this sprint produces a smaller, clearer runtime with no dead demo code, no misleading module names, and only spaces that are actually reachable and used.

## Rationale

- A route/reachability audit (see `tasks.md`, phase 1) shows **most "legacy" surfaces are still wired into the live app** — so removal is frequently a *product-deprecation decision*, not mechanical dead-code deletion. Blindly deleting them would break dashboards and shared domains.
- Concrete proof this must be careful: **Podcast is built on the events domain.** `app/comms/podcast/page.tsx` renders `EventsPipelineShell`, loads the event pipeline, and its detail pages *are* `/app/comms/events/[id]`. The `events` table's `event_type` enum holds `podcast`, `conference`, `congress`, … So "delete events" as a whole would destroy Podcast (kept). Only the **generic events *list* page** is a candidate — the events *domain* stays.
- Similarly, `demo-data.ts` sounds disposable but exported the live Initiatives stage vocabulary used across the app — a rename, not a deletion.
- Therefore the work splits into: (A) provably-dead code we remove immediately, (B) misnamed/duplicated code we refactor, (C) wired-but-suspected-legacy *spaces* that each need an explicit go/no-go plus a reference-rewire before removal, and (D) database/seed legacy handled only via forward migrations (history is immutable).

## Technical approach

- **Batching.** One concern per commit, each independently revertible. Order: provably-dead → refactors → per-space deprecations (one space per batch).
- **Reachability method.** A surface is "active" if it is in `MASTER_NAV`/`COMMS_NAV_SECTIONS` (`role-access.ts`) or reached by a link/redirect/import from an active surface. Everything else is a removal candidate to be verified.
- **Per-space removal recipe (Category C):** (1) confirm retirement with the product owner; (2) rewire/neutralise inbound references (nav, dashboard cards, data loaders, links) and update their tests; (3) delete pages/components/lib that are now unreferenced; (4) a **forward** migration to drop any now-dead tables/rows (never edit historical migrations); (5) `tsc`/lint/unit tests + a manual smoke of the affected areas.
- **Database/seed.** Migrations are immutable history and are **not** edited or deleted. Live demo rows, if any, are removed with a new migration, gated on which spaces are retired. `DEMO_EMAILS` (admin) is a live utility and is kept.
- **Guardrails.** No behaviour change in Batch 0. No Category-C deletion without sign-off. Coverage gate stays green.

## Acceptance criteria

- [x] Route/space/demo audit captured as this sprint (was `docs/CLEANUP_SPRINT.md`, now moved here).
- [x] **Batch 0 (provably dead):** `src/lib/congress-workspace-demo.ts` removed (no runtime import; guard test still green); stale coverage-exclude dropped.
- [x] **Refactor:** `demo-data.ts` → `initiative-stages.ts` — keeps the 4 live stage exports, drops all 15 unused `DEMO_*` stubs; importers updated; a unit test added; no behaviour change.
- [ ] **Dead-code scan:** systematic unused-file / unused-export pass; provably-unreferenced modules removed.
- [ ] **Per-space go/no-go recorded** for each Category-C candidate (events list page, congress workspace, calendar, media, meetings, bureau, partners, admin org-feed/ai).
- [ ] Each approved space removed via the per-space recipe, references rewired, tests updated, one commit each.
- [ ] Any live demo/seed **rows** for retired spaces removed via a forward migration.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` (coverage gate) green after every batch; manual smoke of affected areas.

## Out of scope

- Editing or deleting historical migrations (immutable) — dead tables are dropped only by new forward migrations.
- Removing shared domains that back kept features (e.g. the `events` table that powers Podcast/Conferences).
- Any feature/UX change beyond removing legacy — this sprint only subtracts.

## References

- `sprints/README.md`, `src/lib/role-access.ts` (nav source of truth)
- Coupling evidence: `src/app/app/comms/podcast/page.tsx`, `supabase/migrations/00046_comms_podcast_events.sql`, `00072_event_pipeline_links.sql`
- Prior cleanups already merged: `00054_remove_demo_users.sql`, `00061_remove_demo_crm_contacts.sql`
