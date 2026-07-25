# Sprint 20 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. Completed tasks remain in the sprint record.
> Concept: `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` · Decision: `docs/ADR/0013-opportunity-engine-components.md`.
> **Sprint-wide guardrail:** `network` stays free of podcast vocabulary and depends only on the
> kernel + the identity spine. Every threshold is manifest `config`. No table without a reader.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S20-T01 | **Concept, decision record and sprint brief.** Bring the v0.2 concept into `docs/`, decide and record the component split, tenant-awareness position and cross-component reference rule, and write the sprint brief. | TBD | Completed | `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`, `docs/ADR/0013-opportunity-engine-components.md`, this folder. |
| S20-T02 | **Migration 00171 — `network` tables.** `network_people`, `network_person_affiliations`, `network_member_affiliations`, `network_connections`, `network_connection_checks`, `network_introduction_requests`; RLS on every table (member-affiliation rows are owner-writable), the `network_people_public` `security_invoker` read view, and indexes for the route lookup. | TBD | Completed | Opt-in affiliation rows are the member's own; objection flag hides a person at the view level. |
| S20-T03 | **Migration 00172 — `podcast-planning` tables.** `podcast_questions`, `podcast_question_candidates`, `podcast_candidate_scores`, `podcast_invitations`; RLS mirrors the Comms space; `person_id` deliberately carries **no** FK (ADR-0013 §2). | TBD | Completed | Phase B tables intentionally absent. |
| S20-T04 | **`network` domain — the connection map.** Connection-type vocabulary and strengths, route ranking with the two-step ×0.85 discount, the 0.20 floor and three-route cap, affiliation-overlap guesses, confirmation from map answers, and the introducer fatigue rule. | TBD | Completed | Pure functions, no I/O: `connection-strength.ts`, `affiliation-overlap.ts`, `fatigue.ts`. |
| S20-T05 | **`network` data layer, manifest and public API.** Module-scoped typed Supabase client, repository + actions (people, affiliations, checks, introduction requests), manifest with config + settings panel, `index.ts` contract, README. | TBD | Completed | Nothing podcast-specific; `context_type`/`context_id` keeps introduction requests generic. |
| S20-T06 | **`podcast-planning` domain — stages, gates and the ask ceiling.** Stage vocabulary with waiting states, transition gates, derived waiting days (nudge 7 / silence 14 / stall 21), the six-open-asks ceiling, wake-date handling for Not now, and closed reasons. | TBD | Completed | `stages.ts`, all thresholds injected from config. |
| S20-T07 | **`podcast-planning` domain — the score.** Chance-of-a-yes (25) from route + six factors, the six-part 100-point total, band mapping, timeliness decay by half-life, override handling, and the versioned snapshot payload. | TBD | Completed | `chance-of-yes.ts`, `scoring.ts`; explanation returned with every total. |
| S20-T08 | **`podcast-planning` data layer, manifest and public API.** Questions/candidates/invitations repository + actions, question readiness gate, the Recorded → content-calendar handover, manifest with config, `index.ts`, README. | TBD | Completed | People are read only via `@/modules/network`. |
| S20-T09 | **Past-guest import.** Move `events.podcast_guests` names into the People list as past guests with a `past_guest` marker and their episode history; idempotent by normalised name. | TBD | Completed | Nothing is deleted; the Guests tab's data outlives the tab. |
| S20-T10 | **Planning & Strategy UI.** Screen shell + sub-nav, six-stage Board grouped by question with waiting counters, Questions screen, People screen, Introductions screen, and the seven-block candidate drawer. | TBD | Completed | Composes kernel component-library primitives; no podcast-only card/badge variants. |
| S20-T11 | **Route explorer, map question and introduction request UI.** Route path display with strength and evidence, the five-answer map question, and the favour request with the assembled introducer package. | TBD | Completed | Two asks kept separate in the UI, not just in the model. |
| S20-T12 | **Member affiliation opt-in form.** Item-by-item declaration with per-item visibility and revocation, reachable from the People/Introductions surface. | TBD | Completed | Declining is invisible to everyone else. |
| S20-T13 | **Route wiring.** `/app/comms/podcast` tab swap (Episodes · Planning & Strategy), thin route + screen params, error boundary next to the DB-querying page. | TBD | Completed | Route imports only the two modules' public APIs. |
| S20-T14 | **Unit tests.** Scoring, decay, bands, chance-of-a-yes, stage gates, ask ceiling, waiting-day derivation, question readiness, route ranking + two-step discount + floor, affiliation overlap, fatigue, objection exclusion, guest import idempotence. | TBD | Completed | `src/test/unit/network-*.test.ts`, `src/test/unit/podcast-planning-*.test.ts`. |
| S20-T15 | **Registry, governance and doc trail.** Registry entries, ownership reconciliation, settings panels, CHANGELOG, `REQ-POD-*` traceability rows, DATA_DICTIONARY, MODULAR_COMPONENT_ARCHITECTURE §8 table, docs index, sprints README. | TBD | Completed | All five governance gates green. |
| S20-T16 | **Verification.** `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build`, plus a coverage check on the new domain layers. | TBD | Completed | Results recorded in the sprint outcome below. |

## Sprint outcome

**Phase A delivered.** Two components (`network`, `podcast-planning`), migrations `00171`/`00172`,
four screens on `/app/comms/podcast?tab=planning`, and the Guests tab retired with its data migrated
into the People list.

**Verification (2026-07-25):**

| Gate | Result |
|---|---|
| `pnpm typecheck` | green |
| `pnpm lint` | green (0 errors; 1 pre-existing warning in `conferences/actions.ts`, untouched) |
| `pnpm test` | green — 624 tests across 71 files, of which 106 are new |
| `pnpm governance` | green — all five gates (import-boundary · table-ownership · reachability · dead-code · settings) |
| `pnpm build` | green |
| `pnpm test:coverage` | green — 64.3 % lines / 64.6 % functions against a 60 % threshold; the new pure domain sits at 96–97 % |

**Not verified against a live database.** The migrations were authored against the existing schema
and conventions and are validated by the CI Postgres replay job, but no runtime pass over the new
tables was possible in this environment — the board, drawer and route explorer have not been driven
against real rows. That is the first thing to do on a preview deploy.

**Phase A success criteria remain open by design** (two guests booked through an introduction
recorded in the platform; fifteen members with a completed affiliation profile) — they measure use,
not delivery, and are checked after the pilot fortnight.
