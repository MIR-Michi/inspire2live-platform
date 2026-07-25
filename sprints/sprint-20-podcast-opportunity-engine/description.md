# Sprint 20 — Podcast Opportunity Engine (Phase A: the board)

> **Status:** Phase A complete — see `tasks.md` for the sprint outcome and verification results.
> **Theme:** Replace the podcast **Guests** tab with a **Planning & Strategy** planner — live
> questions, a wishlist of people per question, a six-stage board, and a relationship map that
> finds the shortest warm route to each person — built as two reusable toolbox components rather
> than a podcast one-off.
> **Depends on:** Sprint 16 modular foundation (ADR-0009), Sprint 17 Platform Settings (ADR-0010),
> Sprint 13 contact identity (ADR-0007), the existing podcast episode pipeline in `events`, and the
> content calendar in `content`.
> **Concept:** `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`
> **Decision record:** `docs/ADR/0013-opportunity-engine-components.md`

## Non-negotiable architecture direction

This sprint is the first delivery designed for the **component toolbox** from its first line
(`docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009 §12 Stage 4). Every task must hold to it:

- **Two components, split along the reuse seam.** `network` owns the generic relationship graph and
  the introduction protocol; `podcast-planning` owns the editorial question/candidate/score domain.
  Neither is added to `events`.
- **`network` must stay extractable.** It depends only on the kernel and the identity spine
  (`contacts@^1`). No podcast vocabulary reaches its domain, its tables or its UI.
- **The cross-component reference is a soft reference.** `person_id` on a candidate is a `uuid` with
  no FK, read through `network_people_public` (a `security_invoker` view) and written only through
  `network`'s domain actions — ADR-0009 §6 rules 2–4, exercised for real for the first time.
- **Every tunable number is manifest `config`**, not a constant: the ask ceiling, the live-question
  ceiling, nudge/silence/stall day counts, the timeliness half-life, the introducer cooldown, the
  minimum route strength, and how many routes to show. They render as Platform Settings panels
  automatically (ADR-0010) and are the fields a blueprint would set per tenant.
- **Scoring is arithmetic, versioned and snapshotted** — never a model call, always explainable.
- **No table without a reader.** Phase B's `podcast_signals` / `podcast_topic_groups` /
  `podcast_episode_results` are specified in the concept and deliberately not migrated here.

## Goal

Shipping this sprint produces:

1. **A planner where the Guests tab was.** `/app/comms/podcast` keeps its Episodes tab and gains
   **Planning & Strategy** with four screens: Board, Questions, People, Introductions. The old
   Guests roster disappears; the guests themselves are imported into the People list as past guests,
   which makes them the strongest available introducers for the next question.
2. **Questions that cannot be half-defined.** A question carries its wording, why it matters now
   (with sources), the listener action and where it points, and an episode format. **No candidate on
   a question can leave Wishlist until the listener action is defined** — the concept's own gate,
   enforced in the domain layer.
3. **A six-stage board that counts waiting.** Wishlist · Research · Ask · Planning · Booked ·
   Recorded, plus the two exits (Not now with a wake date, Closed with a reason). Ask and Planning
   cards show who is being waited on and for how many days, with nudge-due, silence-is-a-no and
   stalled flags. **Six open asks across all questions is enforced**, Wishlist and Research are
   unlimited.
4. **A transparent 100-point score.** Chance of a yes 25 · Reach 20 · Timeliness 20 · Follow-up 15 ·
   Mission 15 · Format 5, with the breakdown always shown, timeliness decaying on its own, an
   explicit override path that is recorded rather than hidden, and a versioned snapshot per
   computation.
5. **A usable relationship map without scraping anything.** Members declare contexts opt-in, item by
   item, revocably. Affiliation overlap produces *guesses*; the five-second map question turns a
   guess into a confirmed connection; only then does the favour go out. Route strength ranks paths,
   two-step routes take the 15 % discount, weak routes below 0.20 are never offered.
6. **Introductions that do not wear people out.** One favour request per introducer per fortnight,
   declines are consequence-free and invisible, and the Introductions screen shows each person's
   request history as recognition rather than a leaderboard.
7. **Two components in the catalog.** Manifests, registry entry, settings panels, ownership
   declarations, and all five governance gates green.

## Rationale

The podcast's bottleneck is booking, not production, and the Guests tab spends prime navigation
space on a lookup table that duplicates the episode record. Everything the concept calls scarce —
choosing the question, researching the person, finding the route, chasing the ask — currently lives
in one person's head and inbox, and the 45-country advocate network that could open half these
doors is invisible to the platform.

Sequenced here because the two prerequisites just landed: Sprint 17 gave manifest-driven settings
(so every threshold in this engine is operator-tunable without a deploy), and Sprint 19 gave the
kernel component-library surface (so the board, drawer and screens compose shared primitives instead
of inventing podcast-only ones). It is also the right moment for the toolbox: this is the first
capability whose *generic half* is obvious in advance, which makes it the cheapest possible proof of
the ADR-0009 contract rules — done now, with no data in the tables, instead of retrofitted later.

## Acceptance criteria

- [x] ADR-0013 accepted; concept doc in `docs/`; both referenced from `docs/README.md`.
- [x] `network` and `podcast-planning` exist as components with valid manifests, are in
      `src/modules/registry.ts`, and own every table they create.
- [x] Migrations `00171` and `00172` create the Phase A tables with RLS on every one of them, and
      the `network_people_public` `security_invoker` read view.
- [x] `podcast-planning` reads people **only** through `network`'s public API — no deep import, no
      cross-component FK, verified by the import-boundary gate.
- [x] The Guests tab is gone from `/app/comms/podcast`; Planning & Strategy is in its place with
      Board, Questions, People and Introductions screens and the candidate drawer.
- [x] Past guests from `events.podcast_guests` import into the People list as past guests, with the
      import idempotent (re-running creates no duplicates).
- [x] A candidate cannot leave Wishlist while its question has no listener action; a candidate
      cannot enter Ask without an angle, a route and a score; a seventh open ask is refused.
- [x] Ask/Planning cards show waiting days; nudge-due (7), silence-is-a-no (14) and stalled (21) are
      derived, not stored, and driven by config.
- [x] Score totals, bands and timeliness decay match the concept §10 rubric and are snapshotted with
      a `weights_version`.
- [x] Route strength, the two-step 15 % discount, the 0.20 floor and the three-route cap match
      concept §8; a route is only "confirmed" when a human answered the map question.
- [x] An introducer at their cooldown ceiling cannot be sent a second favour request;
      "I would rather not ask" is stored and never rendered as a failure.
- [x] Objection handling: `objection_received` hides a person from every screen **and** from scoring.
- [x] Both components' config renders in Platform Settings; the settings governance gate is green.
- [x] Unit tests cover scoring, decay, bands, stage gates, the ask ceiling, waiting-day derivation,
      route ranking, the two-step discount, the fatigue rule and the guest import.
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` all green.
- [x] Doc trail complete: CHANGELOG, TRACEABILITY (`REQ-POD-*`), DATA_DICTIONARY,
      MODULAR_COMPONENT_ARCHITECTURE §8 decomposition table, sprints README row.

## Explicitly out of scope (Phase B / C)

- Radar: signal collection, topic grouping, relevance tuning, name extraction — and the
  `podcast_signals` / `podcast_topic_groups` tables.
- OpenAlex / Europe PMC co-authorship import and automatic affiliation matching. Phase A stores
  `published_together` connections and scores them; it does not fetch them.
- The Results screen, `podcast_episode_results`, tracked links and reach measurement.
- Launch-plan task generation at Booked.
- AI drafting of invitations, route explanations and post-recording extraction (concept §13,
  Phase C).
- Any outbound send. Phase A composes the message and hands it to the human — the platform never
  sends on an introducer's behalf, by design, not by omission.

## Open decisions carried into the sprint

The eight organisational decisions in concept §18 are *not* build blockers for Phase A, with one
exception that is a go-live blocker rather than a build blocker: **the Board's lawful-basis
decision** must be recorded before real non-member people data is entered. The schema and the
product already assume the recommended position (professional information only, per-field source
attribution, unattributed fields excluded from scoring, eighteen-month purge, permanent objection
flag), so a "yes" needs no rework and a "no" stops data entry rather than the code.

## References

- Concept: `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`
- Decision: `docs/ADR/0013-opportunity-engine-components.md`
- Toolbox: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Settings: `docs/PLATFORM_SETTINGS_CONCEPT.md`, ADR-0010
- Identity spine: ADR-0007
- AI contract: `docs/AI_INTEGRATION.md`
- Delivery: `sprints/README.md`, ADR-0011

---

*Last reviewed: 2026-07-25.*
