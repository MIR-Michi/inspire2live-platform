# ADR-0013: The Podcast Opportunity Engine ships as two toolbox components

- **Status:** accepted
- **Date:** 2026-07-25
- **Owners:** @michaelwittinger-prog
- **Concept:** `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`
- **Delivery:** `sprints/sprint-20-podcast-opportunity-engine/`

## Context

The Podcast Opportunity Engine concept replaces the podcast **Guests** tab with a
**Planning & Strategy** planner: live questions, a wishlist of people per question, a six-stage
board, a relationship map used to find warm routes to those people, and a two-step introduction
loop (a cheap "do you know X" map question first, the favour second).

Its own §17 makes an architectural claim we have to answer before the first table is created:

> Nothing here is specific to Inspire2Live beyond its seed data. The Radar engine, the connection
> map, the chance-of-a-yes model and the two-step introduction loop are generic advocacy
> infrastructure, which makes this module a strong candidate for the multi-tenant component library
> rather than a one-off. Building it tenant-aware from the start costs little now and avoids a
> retrofit later.

That lands directly on ADR-0009 (modular component architecture) and its Stage 4 goal — a catalog
of components a blueprint can compose into a *related* platform. The naive implementation (one
`podcast` module owning everything, or worse, more tables bolted onto the already-heterogeneous
`events` component) would produce exactly the entanglement ADR-0009 exists to prevent: the
reusable half — a relationship graph and an introduction protocol that any advocacy organisation
would want — would be welded to podcast-specific vocabulary and unusable anywhere else.

Three forces pull on the decision:

1. **ADR-0009 §9 rule 4** — no cross-component foreign keys except into the kernel identity spine.
   A candidate card points at a person; if people and candidates live in different components, that
   pointer cannot be a database-level FK.
2. **`events` is already too big.** ADR-0009 §8 says writing its manifest is "expected to split it
   further". Adding eleven tables to it moves in the wrong direction.
3. **Tenant-awareness must cost little.** There is no tenant/org table in the platform today.
   Inventing `tenant_id` columns nothing reads would be speculative work and dead schema — the
   opposite of what ADR-0009 §13 asks for.

## Decision

### 1. Two new components, not one

| Component | Owns | Why it is its own component |
|---|---|---|
| **`network`** (`src/modules/network`) | The people directory, declared and public affiliations, the connection graph, the map question, and introduction requests. | This is the generic half. "Find who I know who knows the person I want, ask cheaply, then ask for the favour" is advocacy infrastructure with no podcast vocabulary in it at all. |
| **`podcast-planning`** (`src/modules/podcast-planning`) | Questions, candidate cards and their stages, versioned score snapshots, invitations. | This is the editorial half: the six stages, the 100-point rubric, the six episode formats, the listener actions. |

`podcast-planning` declares `dependsOn.components: ['network@^1']`. `network` depends on nothing
but the kernel and `contacts@^1` (the identity spine) — it must stay liftable on its own.

Neither component is added to `events`. The podcast **episode** record stays in `events`; the
planner *feeds* it, and the handover at the Recorded stage is a content-calendar item, exactly as
the concept specifies.

### 2. The cross-component reference is a soft reference through a published view

`podcast_question_candidates.person_id` is a `uuid` **with no foreign key**. It resolves through
`network_people_public`, a `security_invoker = true` view that is `network`'s published read
contract (ADR-0009 §6 rule 2). Referential integrity for that column is enforced in
`network`'s domain actions — deleting a person goes through `deleteNetworkPerson()`, which is the
owner's write path (rule 3).

This is deliberately the *harder* option at the database level and the *cheaper* one at the
architecture level: it is what makes `network` extractable into a second platform without dragging
podcast tables behind it, and it exercises the contract rules that Stage 2 will need everywhere.

FKs **into** the identity spine (`profiles`, `comms_crm_contacts`) remain normal FKs — rule 4
allows exactly that, and it is how a network person is linked to a member or a CRM contact.

### 3. Tenant-awareness means "no hardcoded organisation", not a `tenant_id` column

Concretely, for these two components:

- **Every threshold the concept names is manifest `config`**, not a constant in a function body:
  the six-open-asks ceiling, the four-live-questions ceiling, the 7-day nudge, the 14-day
  silence-is-a-no, the 21-day Planning stall, the timeliness half-life, the introducer cooldown,
  the 0.20 minimum route strength, and how many routes to show. They render as an editable panel in
  Platform Settings automatically (ADR-0010) and are what a blueprint would set per tenant.
- **Scoring weights are versioned data, not code constants.** Each computation writes a
  `podcast_candidate_scores` row stamped with `weights_version`, so a weight change is auditable
  and a historical number stays reproducible — which is also what §10 of the concept demands of the
  product ("a number nobody can explain would be worse than the instinct it replaced").
- **Domain vocabulary carries no Inspire2Live specifics.** Hubs, the Annual Congress and the
  advocacy agenda appear only as seed/config values and as ask destinations, never as branches in
  `network`'s logic.
- **A physical `tenant_id` is explicitly deferred** to ADR-0009 Stage 4, when a blueprint format
  exists and there is a second deployment to be a second tenant *of*. Adding it now would create
  columns with no reader — a governance orphan by our own §10 definition.

### 4. Scoring is arithmetic in the domain layer, never a model call

`scoreCandidate()` is a pure function over stored fields. It is unit-tested, reproducible, and
returns its breakdown alongside its total. The AI tasks in the concept §13 all sit on the drafting
and extraction side and reach the platform as drafts through the kernel AI client.

### 5. Phase B tables are not created in Phase A

`podcast_signals`, `podcast_topic_groups` and `podcast_episode_results` are specified in the
concept and deliberately **not** migrated in Sprint 20. A table with no reader is an orphan under
ADR-0009 §10, and the governance gate would be right to fail it.

## Consequences

**Positive**

- `network` is the first component in the codebase designed for extraction from day one, and the
  first real exercise of the ADR-0009 §6 read-view contract between two components.
- The `events` component does not grow.
- Every tunable number in the engine is visible and editable in Platform Settings without a code
  change, and is a blueprint field the day blueprints exist.
- Score history is auditable, which is a prerequisite for the concept's own calibration loop (§15).

**Negative / accepted costs**

- `podcast_question_candidates.person_id` has no database-level referential integrity. Mitigated by
  routing every write through `network`'s domain actions and by an integrity check in the
  repository read path (a candidate whose person is missing renders as a repairable card, not a
  crash).
- Two manifests, two migrations and two settings panels for one product surface. Accepted: the
  split is along the reuse seam the concept itself identifies, not an arbitrary one.
- Cross-component reads pay a second query instead of a join. At the volumes involved (tens of
  questions, hundreds of people) this is not a concern.

**Neutral**

- Both components are gated by the existing `comms_team` feature flag, so absence is a clean state.
- Stage 2 (physical schema move) applies to both exactly as it does to every other component; the
  manifests already declare `network` and `podcast_planning` as their target schemas.

## Alternatives considered

- **One `podcast` component owning everything.** Simplest to build, and the reason to reject it is
  the whole point of ADR-0009: the reusable half would be unusable anywhere else, and we would pay
  to separate it later with data already in it.
- **Add the tables to `events`.** Rejected: ADR-0009 §8 already flags `events` as needing a split.
- **Put the people directory in the kernel identity spine.** Rejected: these are *external*
  people the organisation has no relationship with, governed by legitimate interest and an
  eighteen-month purge (concept §16). Kernel identity is about members and the CRM contact spine;
  merging the two would put a purge policy on the identity layer.
- **Real FK from candidate to person, accepting the cross-component FK.** Rejected: it is precisely
  rule 4, and it would make `network` non-extractable — the one property this ADR exists to protect.

## References

- ADR-0009 — Modular component architecture (§6 data contracts, §9 contract rules, §10 governance)
- ADR-0010 — Platform Settings space (manifest `config` → settings panel)
- ADR-0007 — Unified contact identity (the identity spine these components link into)
- `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` — the product concept
- `docs/MODULAR_COMPONENT_ARCHITECTURE.md` §12 — the transition ladder this sits on
