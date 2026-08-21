# Radar's first contact with a real model, and what it broke

**Date:** 2026-08-21
**Author:** Michael
**Type:** Fix · Change
**Related:** [`sprints/sprint-22-podcast-radar/`](../../sprints/sprint-22-podcast-radar/description.md) ·
[ADR-0016](../ADR/0016-radar-structured-sources.md) ·
[`2026-08-21-radar-in-the-tour.md`](2026-08-21-radar-in-the-tour.md)

## Why

Sprint 22 shipped Radar with an honest caveat recorded in its outcome: no provider key existed in
that environment, so **no model call had ever been made**. The first person to press "Suggest
guests" against a configured provider found out what that caveat was worth. They got
`a.trim is not a function`.

Chasing it turned up two more problems on the same path, one of them the reason the feature would
have kept failing intermittently even after the crash was fixed.

## What changed

### 1. The crash: a type the compiler agreed with and the runtime did not

`runAiMessage` parses the reply itself when a `structuredFormat` is set — `output` comes back as an
**object**. Radar then called `parseJsonReply(reply.output)`, which did `output.trim()`.

It survived every gate because the mistake was agreed with three times over:

- `AiRunResult<T>` defaults `T` to `string`, so `runAiMessage({…})` without an explicit type
  parameter *is typed* as returning a string. `pnpm typecheck` had nothing to complain about.
- `parseJsonReply` was declared `(output: string)`, so it looked correct in isolation.
- Every unit test for it passed a string literal, so the tests shared the assumption rather than
  testing it. **A gate cannot catch an assumption it holds too.**

Every other structured caller in the codebase — intake structuring, org newsfeed, conference
discovery, meeting summary, WhatsApp categorisation, publishing — already does the right thing:
`runAiMessage<unknown>({…})`, then hand `output` to a validator that takes `unknown`. Radar was the
only file that re-parsed. It now matches, `parseJsonReply` takes `unknown` and passes an
already-parsed value straight through, and `unparsedReply` renders the diagnostic without assuming
text. Both the find-names and the scan path were affected identically.

### 2. Find-names died with one source, while the other was up

B1 read OpenAlex alone. OpenAlex throttles anonymous callers hard — `429`, and under load it serves
that as `503` — so an interactive click failed outright while Europe PMC was answering normally.
Observed, not theorised: during this fix every widening attempt returned `503`, then `429`, while
Europe PMC returned 17 records for the same query.

B1 now queries both catalogues under `Promise.allSettled` and dedupes across them, which is what the
fortnightly scan already did, and fails only when **both** sources fail. One source down is a
thinner result, not a failed run.

### 3. `OPENALEX_CONTACT_EMAIL` was read by the code and documented nowhere

It is what buys the polite pool and avoids most of the throttling above. Added to `.env.example` and
`ENVIRONMENT_REFERENCE.md`, including what degrades without it. Setting it is the actual fix for the
throttling; item 2 is the fallback for when it happens anyway.

### 4. The tour speaks like a person

Separate request, same session. The narration was written to be read and was being spoken, which is
a different craft: stacked em-dashed subclauses arrive as run-ons from a synthesiser, and compressed
phrasing that scans well on a page has to be re-heard to be understood. All twenty-seven scenes are
rewritten for the ear — contractions, one idea per sentence, the reason before the mechanism.

The voice is now **male**, preferring the neural voices where they exist, and resolved from a
`voiceschanged` listener rather than read once: Chrome fills its voice list asynchronously, and
reading it too early silently yields the platform default, which is female on nearly every machine.

One piece of jargon was doing real damage. **"Booking is the hard part" meant nothing** to anyone
who had not already planned a podcast — reported directly by a viewer. It is now "getting a yes",
in the narration, in the pipeline diagram, and in the caption. The routes chapter, which had been
labelled "Getting a yes", is now "Reaching them", because the phrase is needed for the whole booking
phase and two things under one label is worse than a plainer name.

The tour runs about nine minutes now rather than seven. Chapter jumping makes that navigable, but it
is a real increase and worth knowing.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm governance && pnpm build` — green.
- **The crash is now covered by tests that would have caught it**: `parseJsonReply` is asserted
  against objects, arrays, `null` and `undefined`, with a comment recording why the old tests
  missed it.
- **The two-source path was run against the live catalogues**, not mocked: OpenAlex returned `429`,
  Europe PMC returned 17 records, and find-names still produced 36 candidate people. Before the
  change that click failed.
- The rewritten tour was **watched in a browser** and screenshotted scene by scene. That is how the
  Radar evidence scene was found to be clipping its own text at the zoom it shipped with; it now
  plays unzoomed, because the card fills the screen and any scale above 1 cuts a word off one edge
  or the other depending on which of the three modal sizes the viewer picked.
- **Still unverified:** a live model call. The `.trim` crash proves the request now reaches a
  provider and comes back, but the environment used here has no key, so prompt quality remains
  untested — the same open item Sprint 22 recorded.

## Follow-ups

- Set `OPENALEX_CONTACT_EMAIL` in Vercel. Until then Radar runs at half strength on the anonymous
  pool, and the two-source floor is harder to clear because one of the two sources is often refused.
- `AiRunResult<T>`'s `string` default is a trap for the next caller as much as it was for this one.
  Making a `structuredFormat` request resolve to `unknown` at the type level would remove the class
  of bug rather than this instance of it. Kernel change, so not folded into a fix.
