# `network` — the relationship graph

**Finding the shortest warm route to somebody you do not yet know, without scraping anything.**

Mirrors [`manifest.ts`](manifest.ts). Decision record: [ADR-0013](../../../docs/ADR/0013-opportunity-engine-components.md).
Product concept: [`docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`](../../../docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md) §6–§8.

## What it is for

The idea everyone recognises from LinkedIn — find the person you want, then see who you know who
knows them — rebuilt without touching any platform's connection data, because a terms-of-service
violation is an organisational risk, not a technical one.

Three mechanisms replace the harvested graph:

1. **Members declare contexts, opt-in and item by item.** Institutions and rough years, societies,
   congresses, boards, universities, disease areas, countries. They never upload contacts.
2. **Overlaps produce guesses, never claims.** `suggestConnections()` can only emit `suggested`
   edges. Nothing in this component can create a `confirmed` connection from data alone.
3. **A human confirms.** The five-second map question — *"do you know Prof. X at Y?"* — turns a
   guess into a route. `answerConnectionCheck()` is the only path to a confirmed edge.

## The one rule that shapes everything

**Two asks, in this order, kept apart in the model and in the UI.**

| | The map question | The favour |
|---|---|---|
| Costs | five seconds | somebody's goodwill |
| Commits | nobody | the introducer |
| Can go to | several people at once | one confirmed contact |
| Throttled | **no**, deliberately | one per introducer per cooldown |
| Moves a card | never | yes |

Throttling the cheap ask is the fastest way to ensure the map never gets built. Collapsing the two
into one button is the fastest way to wear the network out.

## Why it is its own component

There is no podcast vocabulary in here, and there is not meant to be. `dependsOn` is the kernel plus
`contacts@^1` (the identity spine) and nothing else, and `network_introduction_requests` carries a
generic `context_type`/`context_id` rather than a foreign key to whatever asked for the
introduction. That is what makes the component liftable into a second platform — the acid test
ADR-0009 §3 sets for a real boundary.

## Layout

```
domain/
  types.ts                 vocabulary + NetworkConfig (thresholds are settings, not constants)
  connection-strength.ts   the route model — pure: strengths, ≤2 hops, ×0.85, floor, ranking
  affiliation-overlap.ts   declared + public contexts → suggested edges (guesses only)
  fatigue.ts               the cooldown and the per-introducer load summary
  routes.ts                composed lookup: stored graph → ranked, named routes
  repository.ts            reads (through network_people_public — the objection rule lives there)
  actions.ts               the ONLY write path into these tables
  config.ts                manifest config → effective settings (default → DB → env)
  schema.ts                row shapes this component owns (see @/kernel/data/module-schema)
ui/
  people-directory.tsx     the People screen
  introductions-board.tsx  open + answered requests, and who has been asked
  route-explorer.tsx       the two asks, side by side and clearly different
  affiliation-profile-form.tsx  the opt-in declaration
  connection-check-panel.tsx    answering the map question
```

## Data protection (concept §16)

- Professional information only. No private contact details for a name on a wishlist.
- Every field carries a source; an unattributed field is unverified and excluded from scoring.
- `objection_received` hides a record from **every** screen and from scoring, permanently. The rule
  is enforced once in `network_people_public`, so no consumer can forget it.
- Member declarations are opt-in per item, revocable, and a `private` item is never used for routing.
  Declining is invisible to everyone else.

## Tests

`src/test/unit/network-connection-strength.test.ts` · `network-affiliation-overlap.test.ts` ·
`network-introduction-fatigue.test.ts` — 37 tests over the pure domain.
