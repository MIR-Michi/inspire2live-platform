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

## Phase 3 — Retire the confirmed spaces (decided)

**Decision (product owner):** retire **Stories, Network, Resources, Board, Annual Congress (`/app/congress`), Bureau, the Events list page, and Notifications (`/app/notifications`)**. Keep everything that backs a kept feature (see "must-keep" below).

**Risk-minimized rollout — three stages, most-reversible first:**
- **Stage A — Disable (this batch):** remove nav entries; block the routes centrally (retired-guard → redirect to `/app/dashboard`); rewire the one hard redirect from a kept surface (notifications → `/app/congress`). No page/lib/DB deletion. Instantly removes the spaces from the product, fully revertible.
- **Stage B — Clean UI + delete orphaned code:** remove dashboard cards/links that pointed at retired spaces; delete the now-unreachable page/component/lib files (one space per commit); update tests.
- **Stage C — Drop dead data:** forward migrations to drop tables owned solely by retired spaces. **Keep** shared tables.

**Must-keep (shared with kept features):**
- `events` domain — `events` table, `EventsPipelineShell`, `comms-events*` — Podcast & Conferences depend on it. Only the **list page** `/app/comms/events` is retired; `[id]` detail stays.
- `congress_events` + `src/lib/congress-workspace/current-event.ts` — imported by the kept Admin → User Management page.
- `congress_activity_log` — read by the kept Admin activity metrics (`user-activity.ts`).
- Public patient-stories site `/stories` + `/stories/[slug]` — **separate decision** (external/SEO-facing URLs); not retired in this pass.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T07 | **Stage A** — remove nav items (Board, Network, Stories, Resources) + retire-guard for `/app/{stories,network,resources,board,congress,bureau,notifications}` and the exact `/app/comms/events` list page; rewire notifications redirect; update `role-access` tests | Opus 4.8 | Completed | Central guard in `canAccessAppPath`; events list → redirect; notifications bell auto-hidden (gated on `canAccessAppPath`) |
| S15-T07b | **Retire Notifications** — add `notifications` to the retire-guard (blocks route + hides the top-nav bell); remove the Notifications panel from the admin dashboard (Field Newsfeed kept, full-width); drop the notifications query/metadata | Opus 4.8 | Completed | Notifications page redirects to dashboard |
| S15-T07c | **Legacy links/buttons swept** — removed "Open Bureau →" + "Open the Bureau" text (admin dashboard), the Events quick-link card (personal dashboard) and "All events →" (team dashboard) pointing at the retired list; kept `/events/[id]` detail links | Opus 4.8 | Completed | |
| S15-T07d | **Completed tasks disappear from "My tasks"** — the list rendered all tasks; now renders `openTasks` so completed/skipped vanish regardless of when they were completed | Opus 4.8 | Completed | Root cause: no filter existed on the list (only the stat cards used `openTasks`) |
| S15-T08 | **Stage B — Board** `/app/board` + `src/components/board/*` | Opus 4.8 | Not Started | Delete after Stage A verified |
| S15-T09 | **Stage B — Network** `/app/network` | Opus 4.8 | Not Started | |
| S15-T10 | **Stage B — Resources** `/app/resources` | Opus 4.8 | Not Started | |
| S15-T11 | **Stage B — Stories (internal)** `/app/stories/*` + components; keep public `/stories` | Opus 4.8 | Not Started | Public site retirement is a separate decision |
| S15-T12 | **Stage B — Bureau** `/app/bureau` | Opus 4.8 | Not Started | |
| S15-T13 | **Stage B — Annual Congress** `/app/congress/*` + `/app/congress/workspace/*` + `src/components/congress/*` + congress libs **except** `congress-workspace/current-event.ts` | Opus 4.8 | Not Started | Keep `congress_events` + `congress_activity_log` (used by kept admin surfaces) |
| S15-T14 | **Stage B — Events list page** `/app/comms/events/page.tsx` + dashboard Events cards/loaders | Opus 4.8 | Not Started | Keep `[id]`, `EventsPipelineShell`, `events` domain (Podcast/Conferences) |
| S15-T15 | **Stage C** — forward migrations dropping tables owned solely by retired spaces; keep shared tables | Opus 4.8 | Not Started | After Stage B; `DEMO_EMAILS` admin utility kept |

## Kept (explicitly not retired)

| Space | Why kept |
|---|---|
| Initiatives, Tasks, Notifications, Profile | Active |
| Comms: Dashboard, Planner, Campus, Campus-log, WhatsApp, CRM, Conferences, Podcast, Library, Intake, Transcripts | Active workspace |
| Admin: Users, Activity, Feedback, Guest submissions, AI settings, Org-feed | Active admin surfaces |
| Calendar, Media, Meetings | **Not** in this retirement list — left as-is |

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
