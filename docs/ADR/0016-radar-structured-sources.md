# ADR-0016: Radar's facts come from open APIs; the model only groups and phrases

- **Status:** accepted
- **Date:** 2026-08-20
- **Owners:** @michaelwittinger-prog
- **Extends:** [ADR-0013](0013-opportunity-engine-components.md) (the podcast engine's module split)
- **Concept:** [`PODCAST_RADAR_CONCEPT.md`](../PODCAST_RADAR_CONCEPT.md)
- **Migration:** `00175`

## Context

Phase B of the podcast planner ("Radar") suggests **people** and **questions**. Two properties of the
existing system make the obvious implementation — ask a model with web search to find guests —
unacceptable.

The first is that a fabricated person is not a bad suggestion, it is an incident. These records
describe individuals who never signed up to anything, held under a legitimate-interest basis that
promises professional information only, each field source-attributed
(`PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` §16). A model that invents a plausible oncologist at a
plausible institution produces a record that looks exactly like a real one.

The second is that the score is arithmetic. `independentSources` is worth six points of timeliness
and saturates at three; `whyNowAt` drives an exponential decay. Both are read by
`domain/scoring.ts`, which exists precisely so that every number can be reproduced from stored
fields and a `weights_version`. If a model asserts "three independent sources", the score silently
stops being arithmetic over facts and becomes arithmetic over an impression.

Meanwhile the codebase's two existing discovery features (`org_newsfeed`, `conference_discovery`)
both work the other way round: the model searches, asserts, and cites afterwards. They are
acceptable there because their output is a *link* — a wrong one is noise. Radar's output is a person
and a claim about what they can say.

There is also a smaller, structural question. Radar needs a client for open scholarly APIs.
`podcast-planning` needs it for author records now; `network` needs the same co-author graph for
routes in B3. Under ADR-0009 a component may not import another component's internals, and the
kernel imports no component.

## Decision

### 1. Structured open APIs are the spine. The model groups and phrases.

OpenAlex (and, later, Europe PMC, congress programmes and regulator feeds) return the papers, the
authors, their affiliations and the dates as **records with stable identifiers**. Those records are
persisted as `podcast_signals` before any model is involved.

The model is then handed a bounded list it did not choose, and asked for the two things a database
cannot do:

- **grouping** — these eleven records are about one underlying issue;
- **phrasing** — that issue, as one sentence somebody could disagree with, and one line per person
  saying what only they could say.

Web search remains available for **corroborating a why-now** where no API exists (a ruling, a
consultation deadline, a public row). It is never the source of a person.

### 2. A suggestion naming anybody the model was not given is discarded

Every person the model proposes must carry the `signalId` of a record that was in its input. The
validator resolves that reference back to a real row and drops anything unresolvable, before the
suggestion reaches review. This is not a confidence score or a warning badge — the suggestion does
not exist.

The technique is already proven in this repository: `whatsapp-feed-categorization` drops an item
whose `sourceMessageIds` do not resolve, and `publishing/domain/claims.ts` hard-fails a variant
citing a source field that was never sent.

### 3. Radar contributes stored fields, never a term in the formula

`scoreCandidate` is not modified by this sprint and must not be. Radar writes `podcast_signals` rows,
which make `independentSources` a count; it writes `whyNowSourceUrls` and `whyNowAt` on a proposed
question. The arithmetic then reads them exactly as it does today for a hand-typed question.

A Radar-created candidate arrives **unscored**, like any other new wishlist name, and is scored only
when a human completes Research.

### 4. The source client lives in the kernel

`src/kernel/sources/` holds thin, typed, domain-free clients for public research APIs — fetch,
parse, normalise, cap. `openalex.ts` is the first. It knows nothing about podcasts, questions or
candidates, and it is the same client `network` will use for co-authorship routes in B3, which is
why it cannot live in `podcast-planning`.

This is the `ai-client` precedent: an outbound integration with no domain semantics is kernel
infrastructure, not a component capability.

### 5. Scheduled AI work is capped, and refuses out loud

`ai_usage_log` has recorded every call and its estimated cost since the AI foundation shipped, and
nothing has ever read it to make a decision. Radar is the first scheduled fan-out where an
unattended loop can spend real money, so it introduces two numbers:

- a hard cap on searches per run, and
- a trailing-thirty-day spend ceiling, checked **before** a scheduled run starts.

Exceeding either **refuses the run and writes the reason into the run status**, where the operator
sees it. It does not degrade silently, and it does not apply to a human pressing a button — a person
waiting for a result is not the runaway case.

## Consequences

**Good.**

- A suggested person is traceable to a record with a DOI or an OpenAlex ID. "Where did this name come
  from" has an answer that is not "the model said so".
- The timeliness score keeps meaning what `scoring.ts` says it means.
- Signals are cheap, deterministic and cacheable; the expensive model call operates on tens of
  records rather than searching the open web.
- B3's co-author routes get their client for free.
- The first cost guardrail exists, and the next scheduled feature has a pattern to copy.

**Costs, accepted.**

- **Coverage is narrower than web search.** A guest whose relevance is journalistic rather than
  scholarly — a patient advocate, an official, a journalist — will not be found by OpenAlex. Radar is
  therefore explicitly a *supplement* to human name-entry, and the fortnightly topic mode (B2) uses
  web search for the why-now precisely to reach material that has no API.
- **One integration per source.** Adding Europe PMC or a congress programme is real work, where a
  web-search lane would be a prompt. That is the trade being made deliberately.
- **The model can still be wrong about the angle.** Groundedness constrains *who* is suggested and
  *what is cited*, not the editorial judgement of what they could say. That is why the angle is
  presented as a draft on a card a human accepts, and why accepting creates a Wishlist card rather
  than anything further along.

**Rejected alternatives.**

- *Web search with a citation requirement*, as `org_newsfeed` does. Cheaper and broader, but a
  citation proves a URL exists, not that the person described in the summary exists as described. For
  a link that is enough; for a person record it is not.
- *A confidence score instead of a drop rule.* Every reviewer learns to ignore a confidence badge.
  A record that cannot be traced does not appear.
- *Putting the OpenAlex client in `podcast-planning` and moving it later.* Guaranteed churn: B3 needs
  it from `network`, and the move would be a cross-component import in the meantime.
