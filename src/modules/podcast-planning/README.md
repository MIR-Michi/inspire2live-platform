# `podcast-planning` — Planning & Strategy

**The work that happens before anyone says yes.**

Mirrors [`manifest.ts`](manifest.ts). Decision record: [ADR-0013](../../../docs/ADR/0013-opportunity-engine-components.md).
Product concept: [`docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`](../../../docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md).

## What it replaced

The podcast **Guests** tab — a roster of who already appeared, duplicating information that lives on
the episode record. The scarce resource is not editing or publishing; it is the booking work.
Past guests were not deleted: they moved into the `network` People list, where a proven willingness
to appear makes them the best introducers available for the next question.

## Three levels

| Level | What it is | Lives for |
|---|---|---|
| **Question** | One sentence someone could disagree with. | Months — it survives any number of refusals. |
| **Candidate** | One person on one question. **This is the card that moves.** | Weeks. |
| **Invitation** | One attempt to reach one person by one route. | Days. |

The card is the person and the question is the folder they sit in, so a refusal costs one card
rather than throwing away all the framing work.

## The gates (`domain/stages.ts`)

Enforced in the server action, not only in the form — a rule that only exists in a component is not
a rule.

| Move | What has to be true |
|---|---|
| Wishlist → Research | The **question** is complete, including its listener action and where it points. |
| Research → Ask | An angle, a route, and a score. The real quality gate. |
| Ask → Planning | The guest said yes. |
| Planning → Booked | A date, consent to record and publish, and every seat filled. |
| Booked → Recorded | Hands over to the content calendar; the card closes. |

Plus the one ceiling: **six cards in Ask, across all questions.** Wishlist and Research are
unlimited. That asymmetry is the difference between a pipeline that helps one person and a list that
makes them feel behind.

Waiting days are **derived, never stored** — nudge at 7, silence-is-a-no at 14, Planning stall at 21
— so the counters cannot drift from the clock and a settings change takes effect immediately.

## The score (`domain/scoring.ts`)

100 points from six parts: chance of a yes 25 · reach 20 · timeliness 20 · follow-up 15 · mission 15
· format 5. Three properties are non-negotiable:

- **Plain arithmetic over stored fields.** Never a model call. `scoreCandidate()` is pure and
  returns its full breakdown with every total.
- **Timeliness decays** by half-life, so wishlists clean themselves.
- **Every computation is snapshotted** into `podcast_candidate_scores` with a `weights_version`, so a
  weight change stays auditable and any number ever shown can be reproduced.

An override wins outright and is *shown* winning — the decision is recorded rather than hidden,
because an override that keeps being right is evidence the model is wrong, not the person.

## How it talks to `network`

People come from `@/modules/network`'s public API and nowhere else.
`podcast_question_candidates.person_id` is a `uuid` **with no foreign key** (ADR-0013 §2): it is
resolved through the `network_people_public` `security_invoker` view, and every write to a person
goes through `network`'s domain actions. A card whose person cannot be resolved renders as
*repairable* rather than crashing, and the board surfaces the count.

## Layout

```
domain/
  types.ts               stages, routes, formats, asks, PlanningConfig
  stages.ts              the gates, waiting days, the ask ceiling, the board agenda  (pure)
  scoring.ts             the six parts, decay, bands, ranking                        (pure)
  question-summary.ts    per-question counts for the Questions screen                (pure)
  guest-import.ts        the Guests-tab migration                                    (pure)
  repository.ts          reads; assembles the board from two components
  actions.ts             writes; enforces every gate and snapshots every score
  config.ts / schema.ts  effective settings, and the row shapes this component owns
ui/
  planning-strategy-shell.tsx   the tab: Board · Questions · People · Introductions
  opportunity-board.tsx         six stages, grouped by question, waiting tinted differently
  questions-screen.tsx          the readiness gate, shown openly
  candidate-drawer.tsx          the seven-block person card
  question-composer.tsx · candidate-research-form.tsx · candidate-stage-controls.tsx
  guest-import-button.tsx
  onboarding-tour*.tsx           the "How it works" walkthrough: -screens (server, renders the
                                 real screens) · -fixture (the worked example) · -scenes (script,
                                 zoom) · onboarding-tour (the player)
```

## Not built here (Phase B / C)

Radar (signal collection, topic grouping, name extraction), the Results screen and reach
measurement, launch-plan generation, and AI drafting. Their tables are specified in the concept and
deliberately **not** migrated: a table with no reader is an orphan under ADR-0009 §10.

## Tests

`src/test/unit/podcast-planning-scoring.test.ts` · `-stages.test.ts` · `-guest-import.test.ts` ·
`-question-summary.test.ts` — 69 tests over the pure domain.
