# feat: editable podcast questions, and a "Suggest guests" that finds guests

- **Date:** 2026-08-21
- **Author:** Cursor agent (with Michael)
- **Type:** feat · fix
- **Scope:** podcast-planning (questions screen, Radar find-names)
- **Links:** [ADR-0016](../ADR/0016-radar-structured-sources.md) · REQ-RAD-001 · REQ-POD-001

## Context

Two reports, one root cause between them.

**"How can I edit the question?"** You could not. `updateQuestion`, `retireQuestion` and
`verifyAskDestination` all shipped in Phase A implemented, exported and declared in the manifest —
and called by nothing. A typo in a question was permanent, a draft could never be promoted to live,
the "Unchecked" badge on an ask destination could never be cleared, and there was no way to delete a
question at all. Most consequentially, **`topic_tags` had no input anywhere in the UI**, and tags are
what the guest search searches for.

**"No guest was identified even though it's a very popular topic."** Reproduced against the live
indexes with the reported question, *"how to make CAR-T cell therapy available in Brazil"*. The run
searched for **`cancer make`**. Three separate faults compounded:

1. `searchTermsForQuestion` took the first four content words **in sentence order**, so it kept
   `make` and cut `brazil`.
2. `wideningSearches` drops terms from the end, so `make` — first in the sentence — survived every
   rung of the ladder and became the query.
3. The loop **overwrote** its results each rung rather than accumulating, stopped as soon as any
   query returned five papers, and never widened the 120-day window. `cancer make` returned 381
   recent papers containing that verb, thirty of whose authors were shown to the model.

The model then did exactly what it had been told to: `GROUND_RULES` said *"an empty answer is a
useful answer"*, none of those thirty oncologists could speak to CAR-T access in Brazil, and it
correctly returned nothing. The screen reported that no suitable guest existed. Every layer behaved
as specified; the specification was wrong.

## Change

**Retrieval — which words are searched for.** Term selection now ranks by *specificity* rather than
sentence position: a new `WEAK_TERMS` list removes content words that name no subject (`make`,
`available`, `enough`, `actually`), and the rest sort by a technical-token bonus (a hyphen or digit —
`car-t`, `pd-l1`) plus length. Because the widening ladder drops from the end, ordering by
specificity means the vaguest word is surrendered first and the subject noun is the last one
standing. A question containing *only* weak words now returns an empty search and says so, rather
than searching for `cancer make`.

**Retrieval — how much is read, and when to stop.**

- The loop **accumulates** across rungs instead of overwriting, deduplicated by dedupe key.
- It stops on **thirty distinct people**, not five papers — counting the thing the model is actually
  handed, so a junk query that happens to return five rows can no longer end the search.
- 100 works per query rather than 30 (Europe PMC allows 100 per page, OpenAlex 200).
- **A query that returns nothing is retried over three years before any term is given up.** An empty
  result says something about the *window*, not about the question, and broadening is the expensive
  move — it is what turns "CAR-T in Brazil" into "CAR-T". Capped at 8 round trips and 300 records.

**Ranking — closeness first.** Records carry the rung of the ladder that found them, and
`personOptions` sorts on that above weight of evidence. This is what makes the accumulation worth
having: on the reported question, one paper in three years matches the Brazil-specific query and
five hundred match `cancer car-t therapy`, so sorting by evidence alone buries the five people who
are actually on the subject.

**Supply — stop discarding authors.** `principalAuthors` was a *filter* applied before anyone was
ranked, keeping only first, last and corresponding authors of any paper with more than three. That
is the right convention for *who led the work* and the wrong one for *who could talk about it*.
Principal authorship is now an ordering signal in `personOptions`; each paper still contributes at
most eight people, principals first, so a consortium cannot flood the list.

**The model ranks instead of deciding.** The "empty answer is a useful answer" rule moves from the
shared preamble to the *topics* prompt only, where it is still true. The names prompt now asks for an
ordering ten deep where the list allows it, and says plainly that a weaker fit should be described
honestly rather than omitted. `radarMaxNames` default 6 → 12 (a ceiling, not a target). Grounding is
**unchanged**: picks are still references into a supplied list and anything unresolvable is still
dropped. The missing prompt-injection line was added to the names prompt, which unlike the topics
prompt had none.

**A floor.** `fillToFloor` tops a short shortlist up from the retrieved people the model did not
reach, in the same ranked order, each with its real citation and an angle reading *"First author on
… (2024). Retrieved for this question but not yet assessed against it."* Not a confidence badge —
every name still resolves to a record retrieved before any model ran.

**A better basis for the angle.** The model saw one paper title per person; it now sees up to three,
plus whether they lead the work.

**Diagnosis.** `runFindNames` logs the query, per-source outcome and count for every attempt, the
running people count, the parse outcome and all four drop counters. The three zero-result cases —
nothing retrieved, reply unreadable, nothing put forward — no longer share one message, and a
single-catalogue failure is reported instead of swallowed.

**The questions screen.** `question-composer.tsx` becomes `question-editor.tsx`, handling create and
edit from one component. It exposes **topic tags** (with a line explaining that they are what the
guest search uses), and behind a folded "What this is worth" section the anchor date, patient
relevance, advocacy-agenda flag and the three score inputs — all previously unreachable. Tags are now
shown on each question card, with an explicit note when there are none. The permanent "Unchecked"
badge became a `VerifyAskButton`. `updateQuestion` now enforces the live-question ceiling that only
`createQuestion` guarded.

**Deleting a question.** `podcast_question_candidates.question_id` cascades, and scores and
invitations cascade off that, so the rule is a pure guard, `canDeleteQuestion` in `stages.ts`,
enforced by the action exactly as `canAdvance` is by `moveCandidate`: delete freely when there are no
cards; confirm, naming the count, when there are cards but nobody was invited; **refuse** once anyone
was invited, and point at Retire — that record is what stops somebody being approached twice.
`QuestionSummary` gained `totalCards`, which counts sleeping and closed cards the three visible
counts deliberately hide.

Files to look at first: `domain/radar-types.ts` (term selection, closeness ranking, author policy),
`domain/radar.ts` (the retrieval loop), `domain/radar-grounding.ts` (prompt and `fillToFloor`),
`domain/stages.ts` (`canDeleteQuestion`), `ui/question-editor.tsx`.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm governance && pnpm build` — all green.
  Coverage on the changed pure files: `radar-types.ts` 98%, `radar-grounding.ts` 92%, `stages.ts`
  94%, `question-summary.ts` 100%.
- **Measured against the live Europe PMC index**, replaying the new selection and loop on the two
  reported questions:

  | | before | after |
  |---|---|---|
  | *CAR-T available in Brazil* | query `cancer make` → 381 unrelated papers, 30 authors, **0 names** | terms `car-t therapy brazil cell`; 5 attempts, 101 records, **539 people** |
  | *Immunotherapy for older patients with advanced melanoma* | — | 1 attempt, 24 records, **148 people** |

  On the Brazil question the ladder finds nothing in 120 days for the two Brazil-specific rungs,
  retries them over three years and retrieves one paper — *"Challenges and Pathways in Regulating
  Next-Gen Biological Therapies"*, squarely the question — then broadens to `cancer car-t therapy`
  for supply. Closeness ranking puts that paper's five authors in positions 1–5, ahead of a
  seven-paper CAR-T author at rung 2. Counts are Europe PMC alone; the real run queries OpenAlex
  alongside it.
- 20 new unit tests, including the two reproduced cases as named regressions (`cancer make` must
  never appear on the ladder; the melanoma question must keep `melanoma`), the closeness ordering,
  the floor, and all four branches of `canDeleteQuestion`.

**Not driven end to end in the browser.** The editor, delete confirmation and verify button are
wired but have only been exercised by typecheck, lint and build; the retrieval half — the part that
was actually broken — was verified against the live indexes as above.

## Risk & rollback

No migration and no schema change. `PersonOption` gained three fields and `QuestionSummary` one, both
additive. Stored signals written before this change still work: principal authorship is derived from
the role string already in the `people` JSONB rather than from a new flag.

The behavioural risk is the opposite of the bug: a question with a genuinely thin literature will now
return ten names where it previously returned none, and some will be loose fits. That is deliberate —
they are ranked last, carry their evidence, and say in the angle that nobody has judged them — but if
it proves noisy, `TARGET_NAMES` in `radar.ts` is the single number to turn down. Rollback is a
revert; nothing persists that would outlive it.

## Follow-ups

Part 3 of the plan is **not** in this change: congress-programme and podcast-RSS sources, regulator
feeds, and open-web guest search with a server-side fetch-and-verify step (which would need a new
ADR amending [ADR-0016](../ADR/0016-radar-structured-sources.md) §1). The measurement above is the
argument for it — the Brazil question has exactly one paper in three years, and a speaker list or an
episode feed would have found people the literature cannot.

Specificity is currently approximated by word length and a technical-token bonus, because no free API
offers corpus frequency cheaply. It is honest but crude, and worth revisiting if a question is seen
losing its subject noun.
