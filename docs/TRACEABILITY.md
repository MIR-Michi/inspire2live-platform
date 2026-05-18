# Traceability Matrix

Maps design requirements to implementation status and code locations.  
**Source of truth for requirement IDs:** `docs/IMPLEMENTATION_GUIDE.md` §5  
**Benchmark:** `PLATFORM_DESIGN_DOCUMENT.md` v2.0  
**Last updated:** 2026-05-18

---

## Status Values

| Value | Meaning |
|---|---|
| `done` | Implemented, tested, verified |
| `in-progress` | Currently being implemented |
| `planned` | Scheduled in roadmap, not started |
| `deferred` | Moved out of current phase |
| `deviated` | Implemented differently from design doc — see ADR |
| `blocked` | Cannot proceed — dependency or decision pending |

---

## Usage Rule

Every PR that implements product behaviour must update at least one row.  
Format: `REQ-[DOMAIN]-[NNN]` — see `docs/IMPLEMENTATION_GUIDE.md` §5 for domain prefixes.

---

## Phase 0 — Foundation (Complete)

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-TECH-001 | Supabase schema + migrations baseline | §8.2 | `done` | `supabase/migrations/*` | 2026-02-19 | 5 migrations: schema, RLS, storage, views, seed |
| REQ-TECH-002 | TypeScript DB types generated | §8.2 | `done` | `src/types/database.ts` | 2026-02-19 | Generated from Supabase linked project |
| REQ-TECH-003 | Supabase server client (cookie-based SSR) | §8.1 | `done` | `src/lib/supabase/server.ts` | 2026-02-19 | — |
| REQ-TECH-004 | Supabase browser client | §8.1 | `done` | `src/lib/supabase/client.ts` | 2026-02-19 | — |
| REQ-SEC-001 | RLS enabled and core role helpers defined | §8.3 | `done` | `supabase/migrations/00002_rls_policies.sql` | 2026-02-19 | All tables covered |
| REQ-SEC-002 | Storage buckets with access policies | §5.9, §8.3 | `done` | `supabase/migrations/00003_storage_buckets.sql` | 2026-02-19 | avatars, resources, congress-assets |
| REQ-TECH-005 | DB views for initiative health + portfolio | §5.6, §5.8 | `done` | `supabase/migrations/00004_views.sql` | 2026-02-19 | — |
| REQ-TECH-006 | Seed data baseline | §9 Phase 1 | `done` | `supabase/migrations/00005_seed_data.sql`, `supabase/seed.sql` | 2026-02-19 | Needs enrichment with 3-initiative pack (Week 3) |
| REQ-IA-001 | Platform entry page with website complement statement | §1, §5.1 | `done` | `src/app/page.tsx` | 2026-02-19 | Uses `www.inspire2live.com` |
| REQ-UX-001 | Auth flow: magic-link login page | §5.5, §6 Flow 1 | `done` | `src/app/login/page.tsx` | 2026-02-19 | OTP via Supabase |
| REQ-UX-002 | Auth callback route | §8.1 | `done` | `src/app/auth/callback/route.ts` | 2026-02-19 | Callback hardened: code exchange error handling, safe next redirect, onboarding-aware routing |
| REQ-UX-003 | Middleware: route protection + onboarding gate | §6 Flow 1, §8.1 | `done` | `middleware.ts`, `src/test/unit/middleware-routing.test.ts` | 2026-02-19 | Gate logic verified via unit tests (20 total suite baseline passing) |
| REQ-UX-004 | Onboarding page scaffold | §5.5 | `done` | `src/app/onboarding/page.tsx`, `src/components/onboarding/onboarding-wizard.tsx` | 2026-02-19 | Replaced scaffold with full 4-step onboarding wizard and profile completion flow |

---

## Phase 1 — MVP Build

### L0: Communications Workspace Foundation

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-COMMS-001 | Communications intake queue schema with review/routing fields | Concept Update §11 | `done` | `supabase/migrations/00028_comms_intake_items.sql` | 2026-05-17 | Verified locally after making older migrations compatible: Supabase applied through `00035` and `pnpm dlx supabase@2.76.10 db lint --local --fail-on error` returned no schema errors |
| REQ-COMMS-002 | Communications event pipeline and content calendar schema | Concept Update §11 | `done` | `supabase/migrations/00029_comms_events.sql`, `supabase/migrations/00033_comms_content_calendar.sql` | 2026-05-17 | Verified in the same local migration-only apply and clean schema lint run |
| REQ-COMMS-003 | World Campus session, member, and media asset schema foundation | Concept Update §11 | `done` | `supabase/migrations/00030_comms_campus_sessions.sql`, `00031_comms_media_assets.sql`, `00032_comms_campus_members.sql` | 2026-05-17 | Verified in local Supabase after resolving older congress migration incompatibilities |
| REQ-COMMS-004 | Communications access flag on profiles and comms-only RLS policies | Concept Update §9, §11 | `done` | `supabase/migrations/00034_profiles_comms_team.sql`, `00035_comms_permissions_rls.sql` | 2026-05-17 | Verified via local migration apply through `00035` plus clean schema lint |
| REQ-COMMS-005 | Generated application types updated for the communications schema | Concept Update §11 | `done` | `src/types/database.ts` | 2026-05-17 | TypeScript compile passes after schema type updates |
| REQ-COMMS-006 | Communications workspace shell with five placeholder sub-routes | Concept Update §10 | `done` | `src/app/app/comms/layout.tsx`, `src/app/app/comms/*`, `src/components/comms/comms-placeholder.tsx` | 2026-05-17 | Layout, nav tabs, redirect, and placeholder pages compile successfully |
| REQ-COMMS-007 | Communications post-login routing and gated navigation visibility | Concept Update §9, §10 | `done` | `src/lib/comms-access.ts`, `src/app/auth/callback/route.ts`, `middleware.ts`, `src/app/app/layout.tsx`, `src/lib/role-access.ts`, `src/components/layouts/*` | 2026-05-17 | Middleware and navigation regression tests pass |
| REQ-COMMS-008 | Demo comms-team persona and regression tests for communications access | Concept Update §9, MVP verification | `done` | `supabase/seed-demo.sql`, `src/test/unit/middleware-routing.test.ts`, `src/test/unit/role-access.test.ts`, `src/test/unit/permissions.test.ts` | 2026-05-17 | Added Atefeh moderator persona with `comms_team = true`; unit test suite passes |
| REQ-COMMS-009 | Communications permission model and architecture decision captured in docs | Concept Update §9, §11 | `done` | `docs/ROLE_PERMISSION_MODEL.md`, `docs/ADR/0006-communications-workspace.md` | 2026-05-17 | Governance docs now reflect the communications module and access rules |
| REQ-COMMS-010 | Manual intake capture form and server action for structured Phase 1 capture | Concept Update §7.2 | `done` | `src/app/app/comms/intake/new/page.tsx`, `src/components/comms/manual-intake-form.tsx`, `src/app/app/comms/intake/actions.ts` | 2026-05-18 | Verified with `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, and `pnpm build` |
| REQ-COMMS-011 | Intake queue review surface with filters, badges, route/edit/dismiss actions, and 90-day dismissed archive | Concept Update §7.3 | `done` | `src/app/app/comms/intake/page.tsx`, `src/components/comms/intake-queue-shell.tsx`, `src/lib/comms-workflow.ts`, `src/app/app/comms/intake/actions.ts` | 2026-05-18 | Verified in app build plus local schema lint after applying migration `00036` |
| REQ-COMMS-012 | Routing destinations and manual classification correction log | Concept Update §7.3, §7.5 | `done` | `supabase/migrations/00036_comms_sprint02_support.sql`, `src/app/app/comms/intake/actions.ts`, `src/test/unit/comms-workflow.test.ts` | 2026-05-18 | Added destination record creation, `routed_to_*` updates, and `intake_classification_corrections` logging |
| REQ-COMMS-013 | Content calendar monthly/list views, editor, promote-from-intake, and manual publish/archive status flow | Concept Update §6.2 | `done` | `src/app/app/comms/calendar/page.tsx`, `src/components/comms/content-calendar-shell.tsx`, `src/app/app/comms/calendar/actions.ts`, `src/lib/comms-workflow.ts` | 2026-05-18 | Verified with typecheck, lint, tests, and production build; status machine covered by unit tests |
| REQ-COMMS-014 | Daily communications digest email with configurable send time and scheduled cron entry point | Concept Update §7.4 | `done` | `src/lib/comms-digest.ts`, `src/lib/supabase/admin.ts`, `src/app/api/comms/digest/route.ts`, `vercel.json` | 2026-05-18 | Vercel cron config validated; digest schedule uses `profiles.notification_prefs.digestDeliveryTime` with 08:00 fallback |
| REQ-COMMS-015 | Sprint 02 communications demo seed pack (intake items + calendar drafts) | Concept Update §4, §7 | `done` | `supabase/seed-demo.sql` | 2026-05-18 | Verified by loading `seed-demo.sql` into the running local Supabase DB container after applying migration `00036`; full `supabase/seed.sql` still has a pre-existing syntax issue unrelated to Sprint 02 |
| REQ-COMMS-016 | Sprint 02 workflow regression tests for routing and calendar status transitions | Concept Update §6.2, §7.5 | `done` | `src/test/unit/comms-workflow.test.ts` | 2026-05-18 | `pnpm test` passes with 190/190 tests green |

### L1: Core Continuity

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-UX-005 | Onboarding wizard: 4 steps (welcome / role / profile / first-initiative) | §5.5, §6 Flow 1 | `done` | `src/components/onboarding/onboarding-wizard.tsx`, `src/app/onboarding/page.tsx` | 2026-02-19 | Implemented with step progress and validations |
| REQ-UX-006 | Profile persistence to `profiles` table on onboarding completion | §5.5, §8.2 | `done` | `src/components/onboarding/onboarding-wizard.tsx` | 2026-02-19 | Persists role, name, location, org, timezone, language, onboarding flag |
| REQ-UX-007 | `onboarding_completed` gate end-to-end verified | §6 Flow 1 | `done` | `middleware.ts`, `src/app/auth/callback/route.ts`, `src/app/onboarding/page.tsx` | 2026-02-19 | Verified route-level gating path and callback redirect behavior |
| REQ-IA-002 | App shell: TopNav + SideNav + role-aware routing | §4.2, §7.2 | `done` | `src/components/layouts/*`, `src/app/app/layout.tsx`, `src/lib/role-access.ts`, `src/test/unit/role-access.test.ts` | 2026-02-19 | Role-aware navigation centralized and enforced via middleware + shared access helper |
| REQ-UX-008 | Coordinator dashboard (Sophie): RAG health table + inactivity alerts | §5.6, §4.2 | `done` | `src/app/app/dashboard/page.tsx`, `src/lib/dashboard-view.ts`, `src/test/unit/dashboard-view.test.ts` | 2026-02-19 | Coordinator view finalized with RAG table, inactivity states, and no-data guidance |
| REQ-UX-009 | Advocate dashboard (Maria): my tasks + initiative cards + milestone progress | §4.2, §5.5 | `done` | `src/app/app/dashboard/page.tsx`, `src/lib/dashboard-view.ts`, `src/test/unit/dashboard-view.test.ts` | 2026-02-19 | Advocate view finalized with task urgency cues, progress cards, and empty-state guidance |
| REQ-UX-010 | Board-lite dashboard (Peter): top-line metrics snapshot | §4.2, §5.8 | `done` | `src/app/app/dashboard/page.tsx`, `src/lib/dashboard-view.ts`, `src/test/unit/dashboard-view.test.ts` | 2026-02-19 | Board KPI snapshot completed with portfolio risk callout and fallback portfolio state |
| REQ-UX-011 | Profile page: avatar, Hero of Cancer badge, expertise tags, initiative affiliations, contribution timeline | §5.5, §7.2 | `done` | `src/app/app/profile/page.tsx`, `src/components/profile/profile-editor.tsx`, `src/lib/profile-view.ts`, `src/test/unit/profile-view.test.ts` | 2026-02-19 | Completed profile experience with editable settings, contribution timeline, and helper-level unit coverage |
| REQ-UX-012 | Initiative workspace: header + quick stats + all 6 tab navigation | §5.2 | `done` | `src/app/app/initiatives/page.tsx`, `src/app/app/initiatives/[id]/layout.tsx`, `src/components/initiatives/initiative-tabs.tsx` | 2026-02-19 | Workspace shell shipped with role-aware access gate and complete 6-tab navigation |
| REQ-UX-013 | Initiative workspace: Overview tab (description, objectives, activity feed, status card, mini timeline) | §5.2 | `in-progress` | `src/app/app/initiatives/[id]/page.tsx` | 2026-02-19 | Overview baseline implemented (description, quick stats, recent activity); objectives + mini timeline pending |
| REQ-UX-014 | Initiative workspace: Milestones tab (horizontal timeline, status nodes, expandable detail) | §5.2 | `planned` | `src/app/app/initiatives/[id]/milestones/` | — | Week 3 |
| REQ-UX-015 | Initiative workspace: Tasks tab (kanban, 5 columns, filter bar, list view toggle) | §5.2 | `in-progress` | `src/app/app/initiatives/[id]/tasks/page.tsx`, `src/lib/initiative-workspace.ts`, `src/test/unit/initiative-workspace.test.ts` | 2026-02-19 | Tasks baseline shipped with status/priority filtering and kanban lane snapshot; drag/drop + list toggle pending |
| REQ-UX-016 | Initiative workspace: Evidence tab (grid/list, type icons, version, language, translation badge, partner badge) | §5.2, §5.9 | `planned` | `src/app/app/initiatives/[id]/evidence/` | — | Week 3 |
| REQ-UX-017 | Initiative workspace: Team tab (roster, role badges, activity indicators, invite flow for coordinators) | §5.2 | `planned` | `src/app/app/initiatives/[id]/team/` | — | Week 3 |
| REQ-UX-018 | Initiative workspace: Discussions tab (threaded, tagged: General/Decision/Question/Blocker/Idea) | §5.2 | `planned` | `src/app/app/initiatives/[id]/discussions/` | — | Week 3 |
| REQ-TECH-007 | Seed pack: 3 initiatives with realistic milestones, tasks, evidence, team, discussions | §9 Phase 1 | `planned` | `supabase/seed.sql` | — | Week 3 |

### L2: Governance Layer

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-OPS-001 | Friday Morning Bureau: initiative status grid (all columns: name, RAG, phase, lead, open tasks, blocked tasks, next milestone, due date, last activity, notes) | §5.6 | `planned` | `src/app/app/bureau/weekly/` | — | Week 4 |
| REQ-OPS-002 | Bureau: inline expand for blocker detail + quick-action buttons (assign task, post note, change status, flag escalation) | §5.6, §6 Flow 2 | `planned` | `src/app/app/bureau/weekly/` | — | Week 4 |
| REQ-OPS-003 | RAG status logic: green/amber/red derivation rules | §5.6 | `planned` | `src/lib/rag.ts` (to create) | — | Week 4 |
| REQ-OPS-004 | Bureau: inactivity alerts panel (14-day threshold, one-click nudge) | §5.6, §5.10 | `planned` | `src/app/app/bureau/weekly/` | — | Week 4 |
| REQ-OPS-005 | Weekly summary generator: structured output from live data, coordinator-editable | §5.6, §6 Flow 2 | `planned` | `src/app/app/bureau/weekly/` | — | Week 4 |
| REQ-PARTNER-001 | Partner application form (scope, compliance upload, neutrality declaration) | §5.7, §6 Flow 3 | `planned` | `src/app/app/partners/apply/` | — | Week 5 |
| REQ-PARTNER-002 | Partner governance review: approve / request clarification / decline with justification | §5.7 | `planned` | `src/app/app/partners/` | — | Week 5 |
| REQ-PARTNER-003 | Scoped partner workspace: read-only advocacy sections, read/write partner contribution section | §5.7, §8.3 | `planned` | RLS + initiative workspace | — | Week 5 |
| REQ-PARTNER-004 | Partner audit trail: every partner action logged and visible to governance stakeholders | §5.7 | `planned` | `src/app/app/partners/[id]/` | — | Week 5 |
| REQ-SEC-003 | Partner contribution separation: "Partner Contribution — [Org]" badge + physical separation from editorial content | §5.7, §3 Principle 5 | `planned` | Evidence tab, resource library | — | Week 5 |

### L3: Institutional Memory

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-RES-001 | Global resource library: search + filters (initiative, type, language, cancer type, date range) | §5.9 | `planned` | `src/app/app/resources/library/` | — | Week 5 |
| REQ-RES-002 | Resource upload: metadata form, drag-and-drop zone | §5.9 | `planned` | `src/app/app/resources/` | — | Week 5 |
| REQ-RES-003 | Resource versioning: previous versions preserved, dropdown history, superseded label | §5.9 | `planned` | `src/app/app/resources/[id]/` | — | Week 5 |
| REQ-RES-004 | Translation status badges on all resources: Original / Translated / Needs Translation | §5.9, §10 | `planned` | Resource cards + library | — | Week 5 |
| REQ-TECH-008 | Decision→task provenance: tasks store `created_from` + `congress_decision_id` origin | §5.3, §8.2 | `done` | `supabase/migrations/00001_initial_schema.sql` | 2026-02-19 | Schema field present; UI surfacing in Week 4 |

### L4: Congress Continuity (MVP slice)

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-CONGRESS-001 | Congress decision pipeline view with conversion status | §5.3, §6 Flow 4 | `planned` | `src/app/app/congress/` | — | Week 4 |
| REQ-CONGRESS-002 | Decision→task conversion dashboard: 48h target, progress bar, one-click conversion | §5.3, §6 Flow 4 | `planned` | `src/app/app/congress/follow-up/` | — | Week 4 |
| REQ-CONGRESS-003 | Congress topic submission form + voting interface | §5.3 | `planned` | `src/app/app/congress/topics/` | — | Week 4 |

### Notification Layer

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-UX-019 | In-app notification center: bell icon, unread count, grouped by initiative, all event types | §5.10 | `planned` | `src/components/layouts/top-nav.tsx` | — | Week 4 |

### Week 6 — Quality + Accessibility

| Requirement ID | Description | Design Doc Ref | Status | Code Location | Last Verified | Notes |
|---|---|---|---|---|---|---|
| REQ-A11Y-001 | WCAG 2.1 AA compliance: keyboard nav, ARIA landmarks, color + icon status indicators | §11 | `planned` | All components | — | Week 6 |
| REQ-A11Y-002 | Focus indicators visible (2px primary-500 outline) on all interactive elements | §11 | `planned` | `globals.css` | — | Week 6 |
| REQ-A11Y-003 | All status indicators use icon + text, not color alone | §11, §7.2 | `planned` | All badge/RAG components | — | Week 6 |
| REQ-PERF-001 | Images lazy-loaded; SSR for initial page loads | §11 | `planned` | All image components | — | Week 6 |
| REQ-DS-001 | Design token system (colors, typography, spacing, radius, shadows) as Tailwind 4 theme | §7.1 | `in-progress` | `src/app/globals.css` | 2026-02-19 | Partial; full implementation Week 6 |

---

## Phase 2 — Congress Cycle Integration (Weeks 7–16)

| Requirement ID | Description | Design Doc Ref | Status | Notes |
|---|---|---|---|---|
| REQ-CONGRESS-004 | Pre-congress: full topic submission, voting, agenda page, role assignment | §5.3 | `planned` | Week 7–9 |
| REQ-CONGRESS-005 | During-congress: live session documentation interface + decision capture widget | §5.3 | `planned` | Week 10–12 |
| REQ-CONGRESS-006 | Post-congress: automatic contributor workspace connection + congress archive | §5.3 | `planned` | Week 13–14 |
| REQ-UX-020 | Board dashboard V1: executive layout, portfolio health chart, trend, hub map | §5.8 | `planned` | Week 15–16 |
| REQ-OPS-006 | PDF board report export | §5.8 | `planned` | Week 15–16 |
| REQ-RES-005 | Resource template section: reusable initiative templates with "Use Template" flow | §5.9 | `planned` | Week 15–16 |

---

## Phase 3 — Hub Network + Scaling (Weeks 17–30)

| Requirement ID | Description | Design Doc Ref | Status | Notes |
|---|---|---|---|---|
| REQ-HUB-001 | Hub directory with interactive global map | §5.4 | `planned` | Week 17–20 |
| REQ-HUB-002 | Hub workspace pages + hub coordinator dashboard | §5.4 | `planned` | Week 17–20 |
| REQ-HUB-003 | Cross-hub template replication engine | §5.4, §5.9 | `planned` | Week 25–27 |
| REQ-HUB-004 | World Campus session scheduling, recording, session→initiative linking | §5.4 | `planned` | Week 21–24 |
| REQ-PERF-002 | Offline-capable essential views for hub coordinators (PWA) | §6, §11 | `planned` | Week 28–30 |
| REQ-PERF-003 | Low-bandwidth optimization: first meaningful paint < 3s on 3G | §11 | `planned` | Week 28–30 |
| REQ-A11Y-004 | French (FR) and Spanish (ES) localization | §10 | `planned` | Week 28–30 |
