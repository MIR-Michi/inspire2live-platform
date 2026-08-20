# Sprint 22 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. Completed tasks remain in the sprint record.
> Concept: `docs/PODCAST_RADAR_CONCEPT.md` · Decision: owed, S22-T01.
> **Sprint-wide guardrail:** the model groups and phrases; it never sources a fact a database can
> supply. A name without a resolvable source record is dropped before review. Radar writes draft
> questions and unscored wishlist cards, and nothing else. People go through `network`'s public API.

## B1 — Find names for a live question

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S22-T01 | **ADR and sprint brief.** An ADR recording the three architectural calls: structured sources are the spine and the model only groups and phrases; where the open-API client lives (kernel, because `network` needs the same client for B3 co-authorship); and the first AI budget ceiling. Sprint brief and task list. | Michael | Completed | Concept already written and accepted. The ADR is the *decision*, not a restatement — keep it short. |
| S22-T02 | **AI workload registration.** Add the Radar workload(s) to `AiWorkloadId` and a policy row to `AI_WORKLOAD_POLICIES` with a recommendation and written reasoning. | Michael | Completed | `AiWorkloadId` is a closed union — this is a kernel edit. `conference_discovery` is the closest analogue. Note the constraint drift on `ai_settings_model_check` (Sonnet 5 missing) before choosing a model. |
| S22-T03 | **Migration — two tables, one column.** `podcast_signals` (source kind, external id, url, title, published date, payload, dedupe key + unique index) and `podcast_topic_groups` (proposed question, why-now + date, names jsonb, nullable `question_id`, model/effort/raw response, status machine, dismissal reason, decider) with the partial unique index for one pending proposal; `origin` + proposal reference on `podcast_question_candidates`. RLS on both via `is_comms_team_or_admin()`; declare both in the manifest. | Michael | Completed | ≥ `00175` — `main` ends at `00174`; verify before numbering. Dedupe key computed identically in app code and in the DB, as `conferenceDedupeKey` does. |
| S22-T04 | **Kernel open-API source client.** A thin typed client for the first structured source (OpenAlex — authors and affiliations in one call), with no domain knowledge: fetch, parse, normalise, rate-limit, and a stable external id per record. Unit-tested against recorded fixtures, not the live API. | Michael | Completed | In the kernel per T01's decision: `network` needs the same client for B3. Must stay free of podcast vocabulary. |
| S22-T05 | **Domain — the proposal.** The proposal type and its status machine, signal ingestion and dedupe, the grouping + phrasing prompt with its JSON schema and hand-written validator, and the **drop-unsourced-name** rule. Note that provider structured-output mode is skipped when tools are present, so the validator carries the weight. | Michael | Completed | `wrapExternalData()` on everything ingested, with the "content, never instructions" rule stated in the system prompt. `retries: 0`, bounded timeout. |
| S22-T06 | **Domain — accept and dismiss.** Accepting: `upsertPeopleByName` (with `sourceAttribution` per field, `origin: 'external'`, no contact details) → `createQuestion` as a **draft** when proposing one → `addCandidate` per ticked name → proposal marked opened and linked. Dismissing: one of three fixed reasons, recorded with who decided. All gates in the domain, not the UI. | Michael | Completed | The `(question_id, person_id)` unique index already makes re-runs idempotent and returns a friendly message on `23505`. |
| S22-T07 | **UI — the proposal card.** Evidence folded behind source chips, names with tick boxes (pre-ticked by the two-source rule — see the open decision), one primary action and two quiet ones, "Not this" as a three-reason dropdown with no free-text box. Reuses the planner's existing score dots, chips, initials avatars and `Fold`. | Michael | Completed | This is where "without thinking" is won or lost. Design the degraded states too: looking, nothing found, partial failure, already accepted. |
| S22-T08 | **UI — the "Find names" entry point.** The button on the Questions screen and the question header in its board group, shown when the wishlist is thin; `after()` plus status polling plus a written progress line; run lock so a second press joins the first rather than starting a second run. | Michael | Completed | Pattern: `/api/comms/conferences` POST + `conference-run.ts`. Includes the stale-run self-heal. |
| S22-T09 | **Retention.** The eighteen-month purge of inactive people records and twelve-month anonymisation of closed cards, on a schedule, with a dry-run mode that reports what it *would* delete. Unit tests on the boundary dates. | Michael | Completed | Engine concept §16 promises this to the Board and **no retention job of any kind exists today**. It attaches to B1 because B1 is what starts creating people at volume. Respect `objection_received` and never resurrect a purged record. Both halves exercised through the cron route; the dry run reports rather than skips, and reads `?dryRun` permissively — see the note under T19. |
| S22-T10 | **Budget ceiling.** A hard per-run cap on searches, and a trailing-thirty-day spend check against `ai_usage_log` before a scheduled run starts — refusing and writing the reason into the run status rather than proceeding quietly. Both operator-tunable. | Michael | Completed | The first thing in this codebase to *read* `ai_usage_log` for a decision. Keep it two numbers; resist building a budgeting system. |
| S22-T11 | **Unit tests (B1).** Dedupe key stability, an unsourced name dropped, an already-known person matched rather than duplicated, accept writing exactly the four things and nothing else, a draft question refusing to advance past the readiness gate, dismissal reasons, retention boundary dates, the spend refusal. | Michael | Completed | `src/test/unit/podcast-radar-*.test.ts`. |
| S22-T12 | **Verification (B1).** The five gates, plus driving find-names end to end against a real database and a real model call: a live question → proposal → accept → people and wishlist cards → Research → Ask. | Michael | Blocked | **Partly done.** Five gates green. Migration `00175` applied to a from-scratch database (all 175, `supabase start`), Radar schema and indexes inspected, and an RLS probe confirmed a Comms user reads the rows while a non-Comms user reads none and is denied writes. **OpenAlex and Europe PMC called live** and their parsing checked against real payloads. **The accept path was driven in a real browser** (Playwright, seeded proposal, signed-in Comms user) and the resulting rows inspected: a `draft` question carrying both source URLs and `independent_sources = 2`; three `wishlist` cards with `origin = 'radar'`, unscored and not anchors; three `external` people whose every factual field is attributed to the paper's DOI and only whose angle is attributed to `ai:podcast_radar`; zero score snapshots; the proposal `opened`, attributed and linked. **Only the model call is blocked: no provider key exists in this environment** (`ANTHROPIC_API_KEY` unset, `ai_settings` empty), so grounding is exercised only against hand-written replies. |

## B2 — The fortnightly scan

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S22-T13 | **The remaining sources.** Europe PMC, plus the regulator and congress-programme feeds the engine concept §5 names. Same normalisation into `podcast_signals`. Web search only for corroborating a why-now where no API exists. | Michael | Completed | Hard constraint unchanged: open APIs, official feeds, manual entry. No scraping, no bridge tools, no LinkedIn. |
| S22-T14 | **Relevance, grouping and the caps.** Arithmetic relevance against live question topic tags and the advocacy agenda (no model call), grouping into topics, the two-source minimum, and the per-run cap that **drops** the surplus rather than queueing it. | Michael | Completed | Ten cards is the design target. If more clear the bar than the cap allows, that is a threshold problem to fix, not a backlog to keep. |
| S22-T15 | **The scheduled run.** Cron route with the `CRON_SECRET` idiom, `maxDuration`, the singleton run-lock with stale-run self-heal, the operator-set cadence with an interval self-throttle, service-role writes, and a prose run status including the zero-result explanation. | Michael | Completed | Copy `/api/comms/conferences` closely — it is the most complete example. Note the auth idiom fails **open** when `CRON_SECRET` is unset. |
| S22-T16 | **The Radar tab.** A fifth screen in the planner shell with a count badge, the proposal list, and an empty state saying when it last looked and when it looks next. Plus the `PLANNING_SCREENS` branch in the route. | Michael | Completed | The shell currently omits Radar because "an empty tab teaches nothing" — the empty state is what changes that, so it is a deliverable, not a placeholder. |
| S22-T17 | **Dismissals teach.** Recent dismissals with their one-tap reasons injected into the **cached** system prefix as rejected examples, capped and stably sorted so the cache prefix is reused across lanes and runs. | Michael | Completed | Same technique as conference discovery's "already have these" list — billed once per run, not once per lane. No learned threshold. |
| S22-T18 | **The digest line.** One line in the existing weekly digest — "Radar has N new topics" — linking straight to the tab. | Michael | Completed | The most user-friendly surface is the one you do not have to visit. |
| S22-T19 | **Unit tests and verification (B2).** Grouping behaviour, the two-source minimum, the per-run cap dropping rather than queueing, the interval self-throttle, the stale-run self-heal, cron auth. Then the five gates and a real scheduled run watched end to end. | Michael | Blocked | **Partly done.** Unit tests cover grouping, the two-source minimum, the cap, the drop-unsourced rule, the cached rejected-examples block and the retention dry run. **Both cron routes were called live:** Radar refused because AI is off, retention reported honestly, and both returned `401` on a wrong secret. Calling them found two things worth fixing. The retention route accepted only `dryRun=1`, so `?dryRun=true` performed a **live purge** — it now treats any value but `0`/`false`/`no` as a rehearsal (`asksForRehearsal`, unit-tested on every spelling), and the anonymisation half reports what it would touch instead of skipping. And Radar's AI-flag gate ran *last*, after two database round-trips, despite the comment claiming cheapest-first; it now runs first and returns a clean `skipped` rather than a `503`, which would have shown a red cron every week on a platform with AI switched off. **The scheduled run itself has not been watched** — same missing provider key as S22-T12. The ten-minute review measure is therefore unmeasured and remains the sprint's open question. |

## Doc trail

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S22-T20 | **Documentation.** CHANGELOG, `REQ-RAD-*` rows to `done`, DATA_DICTIONARY (two tables + the candidate column), AI_INTEGRATION (the new workload, the budget ceiling, and the drifted specifics it already carries), the engine concept §5/§17 cross-references, docs index, sprints README. | Michael | Completed | Same PR as the behaviour it documents (AGENTS.md §8). Three tables, not two — the run-status singleton was needed as well. The two drifted `AI_INTEGRATION.md` facts were fixed in passing: the newsfeed group timeout is 60s (not 75s), and conference discovery fans out ~36 region × lens lanes (not one search per region). |

## Outcome

**Shipped.** Both halves of the sprint: "Suggest guests" on a live question, and the fortnightly scan
behind the Radar tab, with acceptance writing people, a draft question and unscored wishlist cards.
Two source clients rather than the one planned (OpenAlex **and** Europe PMC), because the two-source
floor is only meaningful across genuinely independent catalogues — which also forced
`dedupeAcrossSources`, unplanned: the two catalogues index many of the same papers and one paper
counted twice would clear a bar built to require corroboration.

**Deferred as planned.** B3 — routes from co-authorship — is untouched. So are Europe PMC's siblings
in the concept's §5 list (regulator feeds, congress programmes), which the lane structure now has an
obvious place for.

**What is not verified, and it matters.** No provider key exists in this environment, so **no model
call has ever been made**. Everything up to and after the call is exercised — the sources live, the
grounding against hand-written and adversarial replies, the request the client would build — but the
prompt has never met a model, and prompt quality is exactly the thing unit tests cannot speak to.
Whoever runs this first should watch one `runFindNames` and one scan end to end before trusting a
proposal, and should expect to tune `NAMES_SYSTEM_PROMPT` and `TOPICS_SYSTEM_PROMPT` on what comes
back. The sprint's own measure — three consecutive reviews cleared to zero in under ten minutes —
cannot be taken until then.

**Two defects found by calling the thing rather than by testing it.** Both were in the cron routes,
which is where unit tests are weakest, and neither would have been caught by a test of the domain —
in both cases the domain function was correct and the route was faithfully doing what its own comment
described.

The first was dangerous: retention parsed `dryRun=1` and nothing else, so an operator who typed the
obvious `?dryRun=true` would have got a live purge from a request they believed was a rehearsal. It
is fixed the safe way round — the parameter's *presence* means rehearse, and only `0`, `false` or
`no` overrides that. The second was merely wrong: Radar's cheapest gate, an env read, ran last, so
every weekly tick on an AI-disabled platform did two database round-trips to produce a red `503`.

The lesson generalises past this sprint. Cron routes have no user to notice they are misbehaving,
which is exactly why the five gates passing green said nothing about either bug.

**A third defect, found by CI rather than by me.** The branch went up green on the five gates and
failed CI anyway: 762 tests passing, coverage at 58.77% lines against a 60% threshold. The cause is
that the gate written in AGENTS.md §5 runs `pnpm test`, while CI runs `pnpm test:coverage` — so a
sprint that adds ~2,500 lines of code faster than it adds tests can be locally green and globally
under water, and nothing on the developer's machine says so. AGENTS.md §3/§5 now name
`test:coverage` as the gate, which is the actual repair; the rest was consequence:

- `kernel/sources` was the real gap, at 10% — two clients whose parsing *is* the provenance every
  Radar citation rests on, and S22-T04 had promised fixture tests that were never written. Now 98%
  across 24 tests, against recorded payloads with `fetch` stubbed: normalisation, the retraction
  drop, partial dates discarded rather than guessed, DOI-before-catalogue URLs, `TITLE_ABS` scoping,
  and down-versus-empty error behaviour.
- Radar's Supabase reads and writes, its settings resolver, the run-lock and the `radar.ts` wiring
  are excluded in `vitest.config.ts`, under the rule Sprint 20 wrote for exactly these layers. That
  is a judgement worth stating plainly rather than burying in a config diff: the decisions those
  files used to hold were extracted into `radar-types.ts` and `radar-grounding.ts` during the sprint
  and are covered at ~100%, so what is excluded is wiring whose test would assert a mock. If logic
  migrates back into them, the exclusion becomes a place for bugs to hide.

**A note for the next sprint.** Search recall was the surprise. OpenAlex and Europe PMC both AND
every term, so a four-word question retrieved one paper where three of its words retrieved 138. The
answer was a domain anchor (`radarDomainAnchor`, default `cancer`, never dropped) plus a widening
ladder. It works, but it is a heuristic discovered by running the thing, and a second pass with real
questions in front of it will probably find better.
