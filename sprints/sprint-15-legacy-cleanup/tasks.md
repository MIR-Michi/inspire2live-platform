# Sprint 15 — Tasks

Theme: retire legacy spaces, workflows & demo artefacts without disruption. Status values: `Not Started` · `In Progress` · `Completed` · `Blocked` · `Needs decision`.

## Phase 1 — Identify & verify (audit)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T01 | Enumerate every app route + build a reachability map against `role-access.ts` nav | Opus 4.8 | Completed | ~70 routes catalogued; active = in-nav or linked from an active surface |
| S15-T02 | Classify candidates: (A) provably dead, (B) misnamed/duplicate, (C) wired-but-legacy space, (D) db/seed | Opus 4.8 | Completed | Most "legacy" is Category C (still wired) → needs product go/no-go |
| S15-T03 | Verify high-risk couplings before any deletion | Opus 4.8 | Completed | **Podcast depends on the events domain** (shares the `events` table + `EventsPipelineShell`); `demo-data.ts` holds live stage logic — proof blind deletion breaks prod |

## Phase 2 — Provably-dead & refactors (no product decision needed)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T04 | Remove `src/lib/congress-workspace-demo.ts` (Batch 0) | Opus 4.8 | Completed | No runtime import; only a guard test references the name, still green; stale coverage-exclude dropped |
| S15-T05 | Rename `demo-data.ts` → `initiative-stages.ts`; drop 15 unused `DEMO_*` stubs; keep 4 live stage exports; update importers | Opus 4.8 | Completed | 2 importers updated (initiatives layout + milestones); added `initiative-stages.test.ts`; un-excluded from coverage; no behaviour change |
| S15-T06 | Systematic unused-file / unused-export scan; remove provably-unreferenced modules | Opus 4.8 | Not Started | Candidates verified 0-ref before removal; each its own commit |

## Phase 3 — Per-space deprecations (each needs go/no-go, then the removal recipe)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T07 | **Events list page** `/app/comms/events` (+`[id]` generic view) | Opus 4.8 | Needs decision | Remove the *generic list page* + its dashboard cards only. **Keep** the events domain/tables/`EventsPipelineShell` — Podcast & Conferences depend on them. Rewire: comms + personal dashboards, library, dashboard-data loaders + their tests |
| S15-T08 | **Congress workspace** `/app/congress/workspace/*` (~14 pages) + `/app/congress/*` | Opus 4.8 | Needs decision | Large earlier-version subsystem; referenced by a notifications redirect + nav test. Confirm retired vs kept before touching |
| S15-T09 | **Calendar** `/app/comms/calendar` | Opus 4.8 | Needs decision | 12 inbound refs — confirm retired |
| S15-T10 | **Media** `/app/comms/media` (+`[id]`) | Opus 4.8 | Needs decision | 7 refs — confirm retired vs active library asset flow |
| S15-T11 | **Meetings** `/app/comms/meetings` | Opus 4.8 | Needs decision | 7 refs; note Transcripts (Sprint 14) is adjacent and kept |
| S15-T12 | **Bureau** `/app/bureau` | Opus 4.8 | Needs decision | Not in nav; 3 refs |
| S15-T13 | **Partners** `/app/partners` | Opus 4.8 | Needs decision | Not in nav; 1 ref |
| S15-T14 | **Admin org-feed / AI settings** `/app/admin/org-feed`, `/app/admin/ai` | Opus 4.8 | Needs decision | Sprint-14 AI surfaces — likely KEEP; listed for completeness |

## Phase 4 — Database / seed legacy

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T15 | For each approved retired space, forward migration to drop now-dead tables/rows | Opus 4.8 | Not Started | Never edit historical migrations; new forward migration only |
| S15-T16 | Purge any live demo/seed rows for retired spaces | Opus 4.8 | Not Started | Gated on Phase 3 decisions; `DEMO_EMAILS` admin utility kept |

## Verification (per batch)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T17 | `tsc` + lint + unit tests (coverage gate) green after every batch | Opus 4.8 | In Progress | Green through T04–T05 |
| S15-T18 | Manual smoke of affected areas after each space removal | Opus 4.8 | Not Started | Dashboards, nav, and the retired space's former entry points |
