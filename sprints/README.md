# Sprints — Inspire2Live Platform

Active delivery is organised into **two-week sprints**. Each sprint folder is the canonical source of truth for what is being built, why, and where each task stands.

## Conventions

- **One folder per sprint:** `sprint-NN-short-name/`.
- **`description.md`** in each sprint folder contains:
  - **Goal** — what shipping this sprint produces.
  - **Rationale** — why this sprint is sequenced where it is, referencing the Concept Update or Design Document.
  - **Acceptance criteria** — checklist that must be true for the sprint to be considered complete.
- **`tasks.md`** in each sprint folder is a table of tasks with these columns:
  - `ID` — `S{NN}-T{NN}` task identifier.
  - `Task` — what is being built.
  - `Owner` — who is accountable (default: TBD until sprint start).
  - `Status` — one of: `Not Started` · `In Progress` · `Completed` · `Blocked`.
  - `Notes` — links to PRs, ADRs, blockers.

## Task status workflow

```
Not Started ──▶ In Progress ──▶ Completed
                     │
                     ├─▶ Blocked
                     │
                     └─▶ (move to next sprint if descoped, with note)
```

Update task status inline in the sprint's `tasks.md` as work progresses. Do not move completed tasks out of the sprint — they remain part of the sprint record.

## Current MVP plan

The MVP is the **Communications Workspace pilot** per `docs/PLATFORM_CONCEPT_UPDATE_v1.md`. Four sprints take it from foundation to a live pilot with the comms team.

| Sprint | Folder | Theme | Weeks | Exit milestone |
|---|---|---|---|---|
| 01 | [`sprint-01-foundation-and-comms-shell/`](sprint-01-foundation-and-comms-shell/description.md) | DB foundation + comms shell + `comms_team` flag | 1–2 | M2 — Comms shell live |
| 02 | [`sprint-02-intake-and-calendar/`](sprint-02-intake-and-calendar/description.md) | Manual intake form + queue + content calendar | 3–4 | M3 — Intake usable |
| 03 | [`sprint-03-events-and-campus-log/`](sprint-03-events-and-campus-log/description.md) | Event pipeline + World Campus Log + Peter signal layer | 5–6 | M4 — Full routing |
| 04 | [`sprint-04-media-and-pilot-launch/`](sprint-04-media-and-pilot-launch/description.md) | Media library + integration stubs + comms team pilot | 7–8 | M5 — Pilot live |

After Sprint 04 ships the MVP, Phase 2 begins: WhatsApp Business API webhook, rule-based classifier, WordPress/LinkedIn/Mailchimp publish APIs, SharePoint Graph API, re-promotion of the initiative workspace. Draft placeholder backlogs now exist for:

- [`sprint-05-intake-automation-and-classification/`](sprint-05-intake-automation-and-classification/description.md)
- [`sprint-06-publishing-connectors-and-distribution/`](sprint-06-publishing-connectors-and-distribution/description.md)
- [`sprint-07-media-graph-and-pilot-hardening/`](sprint-07-media-graph-and-pilot-hardening/description.md)
- [`sprint-08-comms-user-type-and-workspace-restructure/`](sprint-08-comms-user-type-and-workspace-restructure/description.md)

These remain planning placeholders until the Sprint 04 pilot review is complete.

- [`sprint-09-comms-crm-foundation/`](sprint-09-comms-crm-foundation/description.md)
- [`sprint-10-brand-identity-alignment/`](sprint-10-brand-identity-alignment/description.md)
- [`sprint-11-crm-people-and-pipelines/`](sprint-11-crm-people-and-pipelines/tasks.md)
- [`sprint-12-whatsapp-webhook-production-hardening/`](sprint-12-whatsapp-webhook-production-hardening/description.md) — hardens the Sprint 05 WhatsApp webhook + outbound reply integration for production use (delivery status, failure triage, threading, ops docs).
- [`sprint-13-contact-identity-unification/`](sprint-13-contact-identity-unification/description.md) — single canonical contact identity (CRM spine + email resolution); see ADR-0007.
- [`sprint-14-ai-augmentation/`](sprint-14-ai-augmentation/description.md) — Claude-powered comms intelligence: structure incoming content, summarize meetings + propose follow-up tasks from uploaded transcripts, an admin-configured organization news feed, and per-user net monitoring.
- [`sprint-15-legacy-cleanup/`](sprint-15-legacy-cleanup/description.md) — retire disused spaces and dead code ahead of the modular restructuring.
- [`sprint-16-modular-component-foundation/`](sprint-16-modular-component-foundation/description.md) — Stage 1 of the modular component architecture (ADR-0009): declare component boundaries with **zero database change** — stand up `src/kernel/` + `src/modules/`, author a manifest per component, enforce import boundaries in CI, and convert `feedback` end-to-end as the reference. See `docs/MODULAR_COMPONENT_ARCHITECTURE.md`.
- [`sprint-17-platform-settings-space/`](sprint-17-platform-settings-space/description.md) — Stage 1.5: re-root platform configuration under a first-class **Platform Settings** space and build the manifest-driven settings machinery that doubles as the composition/blueprint layer for the toolbox future. See `docs/PLATFORM_SETTINGS_CONCEPT.md`.
- [`sprint-18-conference-operations-redesign/`](sprint-18-conference-operations-redesign/description.md) — makes the per-conference **operating page** the single, time-and-role-aware surface for the team and invited guests: de-tabbed operating page, a declarative requirement model (presentation only for presenters; photos only requested during/after), traffic-light status, a guest overview, and instant, logged invites. See `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md`.
- [`sprint-19-adaptive-dashboard-design/`](sprint-19-adaptive-dashboard-design/description.md) — redesigns personal, team, admin, and role dashboards as spacious Campus-inspired two-zone workspaces with cross-device preferences, accessible tile movement/sizing, presets, friendly motion, and restrained completion celebration. It also establishes Platform Settings → **Design & Component Library** and requires every Sprint 19 surface to use the upcoming kernel component-library, semantic-token, catalog, and accessibility model. See `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md` and `docs/PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`.
- [`sprint-20-podcast-opportunity-engine/`](sprint-20-podcast-opportunity-engine/description.md) — replaces the podcast **Guests** tab with a **Planning & Strategy** planner: live questions, a six-stage board with waiting counters and a six-open-asks ceiling, an explainable 100-point score with decaying timeliness, and a relationship map built from opt-in declarations and a five-second "do you know them?" question rather than from scraping. Delivered as **two toolbox components** — `network` (generic, extractable) and `podcast-planning` — with the cross-component reference as a soft reference through a published read view. See `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` and ADR-0013.
- [`sprint-21-publishing-space/`](sprint-21-publishing-space/description.md) — adds a **Publishing** space at `/app/comms/publishing` that turns either a platform record **or** a dropped screenshot plus one line of context into channel-ready copy, drafted through the kernel AI client and approved by a human before it becomes a `content_calendar` entry. **LinkedIn first**; newsletter and website are visible and deliberately not enabled. Built as one generic `publishing` component with a **source-provider extension point** (a new `provides.sources` manifest field, reconciled in CI) so the next source and the next channel are additive — there is no `linkedin` module. See `docs/PUBLISHING_SPACE_CONCEPT.md` and ADR-0014.
- [`sprint-22-podcast-radar/`](sprint-22-podcast-radar/description.md) — **shipped** (except a live model run — see the sprint outcome). Phase B of the podcast planner: assisted discovery built around a **proposal** — a question, the dated evidence behind it, and the names attached — reviewed in one gesture and promoted into draft questions and unscored wishlist cards. Sequenced as **find names for a live question** first, because Phase A shipped with `addCandidate` implemented and uncalled and the board has had no way to add a candidate at all; then the **fortnightly scan** with its own tab, digest line and dismissal learning. The load-bearing rule is that the model groups and phrases but never sources a fact a database can supply, so structured open APIs return the papers, authors and affiliations and a name without a resolvable source is dropped before review. Also carries two gaps the feature makes urgent: the unbuilt eighteen-month retention purge, and the first AI budget ceiling in the codebase. Routes from co-authorship (B3) are deliberately a later sprint. See `docs/PODCAST_RADAR_CONCEPT.md`.

- [`sprint-23-responsiveness/`](sprint-23-responsiveness/description.md) — **planned.** Makes every click acknowledge itself within 100 ms and every mutation settle within a second, platform-wide, with the conference space as the proving ground. Prompted by a report that conferences felt unresponsive, which turned out to be four compounding platform defaults rather than a conference bug: functions possibly running a continent away from the Frankfurt database, **no request-scoped memoisation anywhere** (so identity is re-fetched 3–5 times per page and `platform_settings` is scanned eleven times to render the planner), long AI work sitting on the Server Action queue that Next.js serialises per browser tab (the conferences page fires up to **120 enrichment actions on mount**, blocking every button behind them), and mutations that re-render the whole route twice with no optimistic UI anywhere. Sequenced measurement-first, because the platform has no instrumentation at all and the region question alone could reorder everything. Closes with three structural governance gates so the defaults cannot return. See `docs/PERFORMANCE_AND_RESPONSIVENESS_CONCEPT.md`.

## How to read a sprint

1. Open the sprint's `description.md` — understand goal, rationale, acceptance criteria.
2. Open `tasks.md` — find tasks in `Not Started` or `In Progress`.
3. Pick a task, change its status to `In Progress`, do the work.
4. On completion: update the row to `Completed`, link the PR or commit in Notes.
5. When all acceptance criteria are checked off, mark the sprint complete in `description.md` and start the next one.

## Code structure

Since Sprint 16 the codebase is organised as a **kernel + independent components**
(ADR-0009): cross-cutting code lives in `src/kernel/*` and each capability is a
self-contained module in `src/modules/<component>/` (behind a single `index.ts`,
declared by a `manifest.ts`). App routes under `src/app` are thin and import only
a module's public API. See `docs/MODULAR_COMPONENT_ARCHITECTURE.md` and the
"How to add a component" guide in `docs/IMPLEMENTATION_GUIDE.md` §3. Three
governance gates (`pnpm governance`) keep the boundaries honest in CI.

## References

- Modular architecture: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, `docs/ADR/0009-modular-component-architecture.md`
- Strategic scope: `docs/MVP_SCOPE_AND_ROADMAP.md`
- Concept update (Phase 1 source): `docs/PLATFORM_CONCEPT_UPDATE_v1.md`
- Original spec (Phase 2+ source): `Inspire2Live_PLATFORM_DESIGN_DOCUMENT.md`
- Engineering conventions: `docs/IMPLEMENTATION_GUIDE.md`
- Requirements traceability: `docs/TRACEABILITY.md`
