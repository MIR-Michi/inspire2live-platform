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
| S15-T06 | Systematic unused-file / unused-export scan; remove provably-unreferenced modules | Opus 4.8 | Completed | Repo-wide path-import scan (method sanity-checked against known-live components). Removed 10 zero-reference files: `ui/{priority-badge,activity-item,empty-state,health-chip,escalation-banner,error-boundary}.tsx`, `roles/set-congress-roles.tsx` (retired-congress leftover), `comms/{comms-placeholder,new-item-modal}.tsx`, and `lib/patient-stories.ts` (public `/stories` queries Supabase directly, never imported it). `tsc` + lint + 364 tests green |

## Phase 3 — Retire the confirmed spaces (decided)

**Decision (product owner):** retire **Stories, Network, Resources, Board, Annual Congress (`/app/congress`), Bureau, the Events list page, and Notifications (`/app/notifications`)**. Keep everything that backs a kept feature (see "must-keep" below).

**Risk-minimized rollout — three stages, most-reversible first:**
- **Stage A — Disable (this batch):** remove nav entries; block the routes centrally (retired-guard → redirect to `/app/dashboard`); rewire the one hard redirect from a kept surface (notifications → `/app/congress`). No page/lib/DB deletion. Instantly removes the spaces from the product, fully revertible.
- **Stage B — Clean UI + delete orphaned code:** remove dashboard cards/links that pointed at retired spaces; delete the now-unreachable page/component/lib files (one space per commit); update tests.
- **Stage C — Drop dead data:** forward migrations to drop tables owned solely by retired spaces. **Keep** shared tables.

**Must-keep (shared with kept features):**
- `events` domain — `events` table, `EventsPipelineShell`, `comms-events*` — Podcast & Conferences depend on it. Only the **list page** `/app/comms/events` is retired; `[id]` detail stays.
- `congress_events` + `congress_assignments` **tables** — kept (data preserved). The reader lib `src/lib/congress-workspace/current-event.ts` was **decoupled and removed**: the Admin → User Management page no longer fetches the latest congress event nor renders the "Congress Roles" assignment button (retired with the space).
- `src/lib/congress-guest-tokens.ts` — kept; backs the Conferences guest-token / attendance feature (`/congress/attend/*`, `/api/congress-guest/*`), which is **not** part of the retired internal congress workspace.
- `congress_activity_log` — read by the kept Admin activity metrics (`user-activity.ts`).
- Public patient-stories site `/stories` + `/stories/[slug]` — **separate decision** (external/SEO-facing URLs); not retired in this pass. Their `WorkspaceDiagnostics` dependency was relocated to a neutral `src/components/ui/query-diagnostics.tsx` so congress code could be deleted.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T07 | **Stage A** — remove nav items (Board, Network, Stories, Resources) + retire-guard for `/app/{stories,network,resources,board,congress,bureau,notifications}` and the exact `/app/comms/events` list page; rewire notifications redirect; update `role-access` tests | Opus 4.8 | Completed | Central guard in `canAccessAppPath`; events list → redirect; notifications bell auto-hidden (gated on `canAccessAppPath`) |
| S15-T07b | **Retire Notifications** — add `notifications` to the retire-guard (blocks route + hides the top-nav bell); remove the Notifications panel from the admin dashboard (Field Newsfeed kept, full-width); drop the notifications query/metadata | Opus 4.8 | Completed | Notifications page redirects to dashboard |
| S15-T07c | **Legacy links/buttons swept** — removed "Open Bureau →" + "Open the Bureau" text (admin dashboard), the Events quick-link card (personal dashboard) and "All events →" (team dashboard) pointing at the retired list; kept `/events/[id]` detail links | Opus 4.8 | Completed | |
| S15-T07d | **Completed tasks disappear from "My tasks"** — the list rendered all tasks; now renders `openTasks` so completed/skipped vanish regardless of when they were completed | Opus 4.8 | Completed | Root cause: no filter existed on the list (only the stat cards used `openTasks`) |
| S15-T08 | **Stage B — Board** `/app/board` + `src/components/board/*` | Opus 4.8 | Completed | Deleted in Stage B batch 1 (commit 0862aa5) |
| S15-T09 | **Stage B — Network** `/app/network` | Opus 4.8 | Completed | Deleted in Stage B batch 1 (commit 0862aa5) |
| S15-T10 | **Stage B — Resources** `/app/resources` | Opus 4.8 | Completed | Deleted in Stage B batch 1 (commit 0862aa5) |
| S15-T11 | **Stage B — Stories (internal)** `/app/stories/*` + components; keep public `/stories` | Opus 4.8 | Completed | Internal pages deleted (commit 0862aa5); public `/stories` kept |
| S15-T12 | **Stage B — Bureau** `/app/bureau` | Opus 4.8 | Completed | Deleted in Stage B batch 1 (commit 0862aa5) |
| S15-T13 | **Stage B — Annual Congress** `/app/congress/*` + `/app/congress/workspace/*` + `src/components/congress/*` + congress libs (`congress.ts`, `congress-assignments.ts`, `congress-policy.ts`, `congress-workspace/current-event.ts`) + congress tests | Opus 4.8 | Completed | Kept `congress-guest-tokens.ts` + congress DB tables. Decoupled first: relocated `WorkspaceDiagnostics` → `ui/query-diagnostics.tsx` (public `/stories`), removed `AssignCongressRolesButton`/`VoteButton` + congress fetch from Admin users. `tsc`/lint/364 tests green; coverage 60.66% |
| S15-T14 | **Stage B — Events list page** `/app/comms/events/page.tsx` + dashboard Events cards/loaders | Opus 4.8 | Completed | `page.tsx` is a redirect stub → `/app/dashboard`; `isRetiredEventsList` guard blocks the route (`role-access.test.ts` asserts `false`); dashboard Events cards/quick-links already removed in T07c. Confirmed no remaining loader targets the list. `[id]` detail + `EventsPipelineShell` + `events` domain kept (Podcast/Conferences) |
| S15-T15 | **Stage C** — forward migration dropping tables owned solely by retired spaces; keep shared tables | Opus 4.8 | Completed | `00151_drop_retired_congress_workspace.sql` drops the 18 internal Congress-workspace tables (CASCADE). Kept `congress_events`/`congress_assignments`/`congress_activity_log` (live surfaces) and `congress_members` (invitation-accept RPC + trigger). See Stage C analysis below |
| S15-T15c | **Stage C (completion)** — drop the residual retired-space orphans the dead-code scan confirmed have zero live readers | Opus 4.8 | Completed | `00152_drop_retired_orphan_tables.sql` drops `hub_members`, `hub_initiatives`, `discussions`, `discussion_replies`, `partner_engagements`, `partner_audit_entries`, `resource_translations`, `topic_votes` (CASCADE) + the two now-dead count-trigger functions. Verified: no inbound FK from a kept table, no view deps, account-purge helper is graceful, `seed.sql` `hub_members` block removed. Validated end-to-end against Postgres 16 (8 dropped, 4 kept survive). Kept the live parents `hubs`/`resources`/`notifications`/`congress_*` |

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
| S15-T15b | Forward migration to drop now-dead tables for retired spaces | Opus 4.8 | Completed | `00151` — internal Congress-workspace tables only (self-contained, provably zero live readers). Never edited historical migrations |
| S15-T16 | Purge any live demo/seed rows for retired spaces | Opus 4.8 | Completed | Audit result: **no seed row is exclusive to a fully-retired space.** `supabase/seed.sql` only inserts into `hubs`/`hub_members` (kept — the campus-log hub selector reads `hubs`), `congress_events` (a Stage-C **kept** table), and `patient_stories` (kept public `/stories`). Board/Network/Bureau have no seed inserts. Nothing to purge — same "nothing to drop" logic as the Stage-C table analysis |

### Stage C analysis — why only the Congress-workspace tables were dropped

Criterion: drop a table **only** if it is owned solely by a fully-retired space **and**
has zero live readers (no app-code query, no DB function/trigger/RPC that can run, no
seed insert, no coupling from a kept feature). Every other retired-space table failed
this test and was deliberately kept:

- **`patient_stories` family** — `patient_stories` backs the **kept public `/stories`** site.
  Its audit children `story_status_changes` / `patient_story_events` are written by a live
  trigger on `patient_stories` (`log_patient_story_status_change`, migration 00019), so
  dropping them would break status updates on a kept table. **Kept.**
- **`resources` family** — the `resources` table is read by the **kept Initiatives → Evidence**
  page and is still a live `PlatformSpace`. `resource_translations` is its child. **Kept.**
- **`notifications`** — the `/app/notifications` *page* was retired, but the table is still
  written/read by the kept app-shell notification bell (`app/layout.tsx`, `lib/notify.ts`,
  intake actions). **Kept.**
- **Congress kept tables** — `congress_events`, `congress_assignments` (data preserved),
  `congress_activity_log` (Admin activity metrics), `congress_members` (invitation-accept
  RPC 00027 + live `updated_at` trigger). **Kept.**
- **Board / Network / Bureau** — no space-exclusive tables were dropped *in 00151*. A later
  reader-level re-check (during the S15-T06 dead-code scan) found that several of their tables
  had in fact become zero-reader orphans once the spaces were retired: `discussions`,
  `discussion_replies`, `partner_engagements`, `partner_audit_entries`, and the Network child
  tables `hub_members` / `hub_initiatives`. These were dropped in the **completion migration
  `00152`** (S15-T15c). The genuinely-shared parents stayed: `hubs` (World Campus Log selector),
  `resources` (Initiatives → Evidence), `tasks` (everywhere). Lesson folded into ADR-0009
  governance: "lives in a shared table" must be proven by an actual live reader, not assumed.

Runtime safety of the drop: the only remaining code touching the 18 dropped tables is the
account-purge helper (`admin/users/actions.ts`), whose `tryOp` wrapper explicitly swallows
`42P01` / "does not exist", and its one non-wrapped `congress_topics` read degrades to
`null` (supabase-js returns `{data:null,error}` rather than throwing). No app code change
was required. Stale generated types in `src/types/database.ts` are harmless and will be
refreshed by the next `supabase gen types` run.

## Verification (per batch)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S15-T17 | `tsc` + lint + unit tests (coverage gate) green after every batch | Opus 4.8 | Completed | Final gate after T06/T14/T16: `tsc` clean, lint clean (1 pre-existing unrelated warning), 364/364 unit tests pass |
| S15-T18 | Manual smoke of affected areas after each space removal | Opus 4.8 | Completed | Retired routes verified as redirect-guarded (`role-access.test.ts`); dashboards render with retired cards removed; kept surfaces (Podcast/Conferences `[id]`, public `/stories`, campus-log hub selector) unaffected by the dead-code removal |
