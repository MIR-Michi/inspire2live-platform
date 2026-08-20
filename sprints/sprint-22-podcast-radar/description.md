# Sprint 22 — Podcast Radar (Phase B)

> **Status:** Planned. Nothing built.
> **Theme:** Assisted discovery for the podcast planner. A **proposal** — a question, the dated
> evidence behind it, and the names attached — reviewed in one gesture and promoted into draft
> questions and wishlist cards. Ships in two steps: **find names for a live question**, then the
> **fortnightly scan**.
> **Depends on:** Sprint 20 (the board, the score, the People list, `network`'s introduction
> protocol), Sprint 17 Platform Settings (every threshold is manifest `config`), the kernel AI
> client and its usage log.
> **Concept:** `docs/PODCAST_RADAR_CONCEPT.md`
> **Decision record:** owed — see S22-T01. ADR-0013 already fixes the module split.
> **Out of this sprint:** B3, routes from co-authorship. See *Explicitly out of scope*.

## Non-negotiable direction

Every task holds to these. They are the concept's load-bearing rules, restated as build constraints.

- **The model groups and phrases. It never sources a fact a database can supply.** Structured open
  APIs return the papers, the authors and their affiliations; web search corroborates a *why now*
  and nothing else. "Three independent sources" is a count of stored rows.
- **A name without a resolvable source record is dropped before anyone sees it.** Not shown with a
  caveat, not flagged low-confidence. Dropped. A fabricated person is this sprint's worst outcome.
- **The score stays plain arithmetic.** Radar may supply *stored fields* the formula reads. It may
  never become a term in the formula, or `weights_version` and the snapshot table stop meaning what
  they claim.
- **Radar writes drafts and wishlist cards. Nothing else.** No listener action, no
  `ask_verified_at`, no score, no stage past Wishlist, no contact detail, ever.
- **People are written through `network`'s public API.** `upsertPeopleByName`, never a direct write
  to `network_people`. Module boundaries are CI-enforced.
- **Ten cards a fortnight, not four hundred.** The count is a design target. A backlog is the inbox
  this feature exists to avoid, so a surplus is dropped rather than queued.
- **No table without a reader.** Two tables, both read in this sprint.

## Goal

Shipping this sprint produces:

1. **A way to add a candidate at all.** A "Find names" action on a live question returns a proposal
   in thirty to sixty seconds without blocking; accepting it creates people and unscored wishlist
   cards. Phase A shipped without this, and the board has been unfillable since.
2. **One reviewable object, two modes.** A proposal attached to a live question, or one proposing a
   new question. Same card, same three buttons, one heading apart.
3. **A card that decides itself.** Evidence folded behind chips, names pre-ticked by the
   two-source rule, one primary action and two quiet ones. "Not this" is three fixed reasons and no
   free-text box.
4. **A fortnightly scan** that produces topics rather than links: relevance by arithmetic, grouping
   and phrasing by the model, a two-source minimum, a per-run cap, and a run that explains itself
   when it finds nothing.
5. **A Radar tab worth having at zero**, with a count badge and an empty state that says when it
   last looked and when it looks next — plus a digest line so it need not be visited.
6. **Dismissals that teach**, as cached negative examples in the prompt prefix rather than as a
   learned threshold nobody can read.
7. **Retention that matches the volume.** The eighteen-month purge and twelve-month closed-card
   anonymisation the engine concept §16 promises the Board, implemented.
8. **The first AI budget ceiling in this codebase.** A per-run search cap and a trailing-spend check
   that refuses a scheduled run out loud rather than proceeding quietly.

## Rationale

Two facts sequence this sprint here.

The first is a gap nobody wrote down. Phase A delivered a complete board — six stages, gates,
scoring, waiting counters, the content-calendar handover — and **no way to put a name on it**.
`addCandidate` is implemented, exported, declared in the manifest and has zero callers;
`network.createPerson` is the same; the People screen is read-only. The board is a machine with no
hopper, and the only thing that has ever filled it is the one-shot past-guest import. That reframes
Radar from an automation nicety into the missing entry point, and it decides the order inside this
sprint: find-names before the ambient scan.

The second is that the machinery Radar is supposed to feed is already built and idle. `whyNowAt`
drives an exponential timeliness decay. `independentSources` saturates at three. `whyNowSourceUrls`
exists on the question. `routeCategory` maps a graph route onto the candidate's enum and, like
`addCandidate`, has no caller. Phase A deliberately built the sockets; this sprint is where
something is plugged into them.

Everything else it needs already exists and is proven twice: `runAiMessage` with a server web-search
tool, the fan-out and prompt-cache pattern from conference discovery, the cron + singleton run-lock +
interval self-throttle from `/api/comms/conferences`, and two shipped shapes for human review —
`intake_ai_suggestions` for a single pending proposal and `whatsapp_feed_summaries`/`_items` for a
run producing many. The genuinely new work is one external API client, the grouping logic, the
review card, and the two guardrails in §7 and §8 of the goal.

## Acceptance criteria

**B1 — find names**

- [ ] An ADR is accepted covering the sourcing rule, where the source client lives, and the budget
      ceiling; concept and ADR both referenced from `docs/README.md`.
- [ ] One migration (≥ `00175`) creates `podcast_signals` and `podcast_topic_groups` with RLS on
      both, the deterministic dedupe key with its unique index, the partial unique index enforcing
      one pending proposal, and the `origin` + proposal-reference columns on
      `podcast_question_candidates`. Both tables are declared in the manifest and read in this
      sprint.
- [ ] A Radar workload exists in `AiWorkloadId` and `AI_WORKLOAD_POLICIES` with a written
      justification. No model name appears in any document.
- [ ] "Find names" on a live question returns a proposal without blocking the page, with a written
      progress line while it works and a run lock that makes a second press a no-op.
- [ ] A zero-result run says what it looked at and why nothing cleared the bar.
- [ ] Every suggested name carries a resolvable source record; a name without one never reaches the
      review, proven by a unit test with a deliberately unsourced name in the model output.
- [ ] A name already in the People list is shown as an existing person, not created twice.
- [ ] Accepting creates people through `network`'s API and unscored wishlist cards; the cards sort
      last and cannot advance to Ask until a human has done Research.
- [ ] Dismissing records the reason with one tap and no free-text box.
- [ ] Retention: inactive people records are purged at eighteen months and closed cards anonymised
      at twelve, on a schedule, with a dry-run mode and a unit test for the boundary dates.
- [ ] The budget ceiling refuses a run and says so, rather than proceeding, when the per-run search
      cap or the trailing-spend check is exceeded.

**B2 — the fortnightly scan**

- [ ] A scheduled run groups signals into topics behind a two-source minimum and a per-run cap, and
      proposes a question phrased as one arguable sentence with a dated why-now.
- [ ] Relevance filtering is arithmetic over topic tags and the advocacy agenda — no model call.
- [ ] The Radar tab appears in the planner shell with a count badge, and at zero shows when it last
      looked and when it looks next.
- [ ] Accepting a topic creates a question with `status: 'draft'`; it cannot be researched until a
      human completes the readiness gate.
- [ ] Recent dismissals with their reasons appear in the cached system prefix, billed once per run.
- [ ] The weekly digest carries a Radar line linking to the tab.
- [ ] Cadence is an operator setting; the cron self-throttles against it rather than being
      redeployed.

**Both**

- [ ] Ingested source text is wrapped with `wrapExternalData()` and the prompt states that it is
      content to describe, never instructions to follow.
- [ ] Background runs use the service role (session-less writes would otherwise be filtered by
      `is_comms_team_or_admin()`), and still write people only through `network`'s API.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` all green, and
      both modes driven end to end against a real database and a real model call.
- [ ] Doc trail complete: CHANGELOG, `REQ-RAD-*` → `done`, DATA_DICTIONARY, AI_INTEGRATION,
      the engine concept's §5/§17 cross-references, docs index, sprints README.

## Explicitly out of scope

- **B3 — routes from co-authorship.** OpenAlex co-author import, affiliation matching and a
  pre-filled route. Its own sprint: a different integration, and its success measure (acceptance
  through introductions beating cold approaches) is the central bet of the whole design and deserves
  to be tested on its own.
- **The Results screen and `podcast_episode_results`.** Reach measurement is a separate feature; the
  third reserved Phase B table stays uncreated until it has a reader.
- **Launch-plan task generation** (engine concept §11).
- **Any Phase C drafting** — invitations, route explanations, post-recording extraction.
- **Autonomous contact of any kind.** Nothing in this platform sends anything.
- **A read-only tier on the podcast board.** Radar dismissals are open to anyone with comms access,
  because that is how every other control on this board already works.

## Open decisions carried into the sprint

Neither blocks the start.

**Are names pre-ticked?** The concept argues both sides in §13 and lands on a compromise: pre-tick
only names with two or more independent sources, leave single-source names unticked with the reason
shown. The tension is real — one tap is the whole design premise, but the tap creates a person
record about somebody who never signed up, which is the one act here that arguably deserves
friction. Settle it while building the review card, from how it feels rather than from argument.

**May Radar propose questions, or only find names for questions a human wrote?** A B2 question, and
the risk is anchoring: a mediocre machine-phrased question accepted because it was sitting there.
The mitigation is already in the design (drafts only, freely rewritten), but it is worth watching in
the first real review rather than assuming.

**Thresholds are guesses.** Two sources minimum, roughly ten cards a fortnight, cleared in ten
minutes. Derived from the engine concept's own numbers, but nobody has run this. They are manifest
`config` for exactly that reason; the *design* still assumes the order of magnitude is right, and
the first three fortnightly reviews are the test.

## References

- Concept: `docs/PODCAST_RADAR_CONCEPT.md`
- Engine concept: `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` §5, §8, §13, §16
- Decision: ADR-0013 (module split); a new ADR is owed — S22-T01
- Phase A delivery: `sprints/sprint-20-podcast-opportunity-engine/`
- AI contract: `docs/AI_INTEGRATION.md`
- Toolbox: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Settings: `docs/PLATFORM_SETTINGS_CONCEPT.md`, ADR-0010
- Delivery process: `sprints/README.md`, ADR-0011

---

*Last reviewed: 2026-08-20.*
