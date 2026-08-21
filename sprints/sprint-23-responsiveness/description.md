# Sprint 23 — Platform responsiveness

**Status:** Planned — not started
**Concept:** [`docs/PERFORMANCE_AND_RESPONSIVENESS_CONCEPT.md`](../../docs/PERFORMANCE_AND_RESPONSIVENESS_CONCEPT.md)

## Goal

Every click in the platform acknowledges itself within **100 ms**, every mutation settles within
**1 s at p75**, and no user-facing interaction is ever blocked by work that is not the user's own.
Delivered platform-wide, with the conference space — where the problem was reported and is worst —
as the proving ground.

Shipping this sprint produces three things: the repairs themselves, the **measurement** that proves
they worked (the platform has none today), and a **governance gate** that stops the defaults from
coming back.

## Rationale

The conference space was reported as unresponsive. It is, but reading the code against that
complaint found that the conference space is mostly a severe case of platform defaults nobody
chose. Four causes compound, and they are *multiplicative* — which is why this is one sprint and
not four small fixes filed separately:

- **Distance.** Supabase is in Frankfurt; `vercel.json` pins no region, so functions likely run in
  Vercel's US-East default. Every database round trip may be crossing the Atlantic.
- **Repetition.** Nothing is memoised per request anywhere (`cache()`: zero matches in the whole
  repository), and there is no canonical `getCurrentUser()`. Identity is re-fetched 3–5 times per
  page load; `platform_settings` is scanned whole **eleven times** to render the podcast planner.
- **Serialization.** Next.js dispatches Server Actions one at a time per client. The conferences
  page fires up to **120 AI enrichment actions on mount**, each with a 90-second timeout, and
  every other button in the tab queues behind them. That is the reported symptom: not slowness,
  *blocking*.
- **Blast radius.** Zero `useOptimistic` in the codebase, 234 `revalidatePath` sites, and a client
  pattern that re-renders the whole route **twice** per mutation (`revalidatePath` in the action
  plus `router.refresh()` in the client, both inside the pending transition).

The sequencing follows from one fact: **the platform is completely unmeasured.** No timing
instrumentation, no vitals, no slow-query log. Every finding above is read from code, not observed.
The region question alone could change the priority of everything else by an order of magnitude, so
measurement is task one and the rest is ordered by leverage-per-risk, not by how alarming each
finding reads.

This also pays a debt the codebase already knows about: the CRM pipeline board hand-rolled
optimistic moves and documented why, and `unified-task-status-control.tsx` scopes its transition
per row. The patterns exist; they were never generalised.

## Scope

**In:**

- Measurement: server timing, real-user vitals, a dev round-trip counter, and recorded before/after
  numbers for five representative journeys.
- Region co-location, if it is not already correct.
- A kernel request-memoisation layer (`getCurrentUser`, `getProfile`, `resolvePanel`) and its
  rollout across every call site.
- Removing long work from the click path and the action queue: the conference mount prefetch,
  inline notification email, the two 4-second pollers, and the bulk-invite loop.
- Optimistic UI and per-control pending state on the ~20 highest-frequency interactions.
- Narrowed revalidation, and deletion of the redundant `router.refresh()` after `revalidatePath`.
- Streaming: `loading.tsx` per segment, `<Suspense>` around slow panels, parallelised layout
  waterfalls.
- Three structural governance gates, plus the doc trail.

**Out:**

- Any caching layer over the database (Redis, `unstable_cache` on user data, ISR on authenticated
  pages). Not needed if the above lands, and each trades correctness for speed.
- Replacing `getUser()` with `getSession()`. Faster, and weakens every authorisation decision.
- Rewriting the two large conference shells.
- Index and query tuning as an opening move — revisited only if measurement demands it.
- A timing-based CI budget. Noisy; trains people to ignore it. The gates we add are structural.

## Acceptance criteria

Measured, not asserted. Every performance claim below needs a recorded before-and-after on the same
route, same account, same conditions, in the sprint record.

- [ ] **Budgets met** on the five instrumented journeys, at p75: visible feedback ≤ 100 ms,
      mutation confirmed ≤ 1 s, navigation structure visible ≤ 300 ms, interactive ≤ 1.5 s.
- [ ] **The conference space specifically:** opening the list starts **no** AI work; every button
      responds while enrichment is running; the previously observed multi-second freeze on a
      checkbox toggle is gone. Verified by a human clicking, not only by numbers.
- [ ] **`auth.getUser()` runs exactly once per request** on every page, and `platform_settings` is
      read at most once per request. Proven by the round-trip counter, not by inspection.
- [ ] **No user-facing interaction awaits a model call, an email send, or a web search inline.**
      Every one either returns immediately with a progress surface or runs in `after()`.
- [ ] **No route re-renders twice for one mutation.** `revalidatePath` + `router.refresh()` pairs
      are gone; no action revalidates more than two paths without a written justification.
- [ ] **The top ~20 interactions are optimistic**, each with a visible rollback path that has been
      exercised by forcing a failure — not just tested on the happy path.
- [ ] **No shared pending flag disables more than the control the user touched.**
- [ ] **Every route segment has a `loading.tsx`**, and the app layout's independent loaders run in
      parallel.
- [ ] **Three governance gates pass and genuinely fail** when the pattern is reintroduced —
      demonstrated by a deliberate violation in review, then reverted.
- [ ] Documentation trail complete: concept marked built, `IMPLEMENTATION_GUIDE.md` responsiveness
      section, `AGENTS.md` §6 guardrail, `MONITORING.md` updated with what is now measured,
      CHANGELOG, `REQ-PERF-*` rows.
- [ ] The five gates green: `pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm governance && pnpm build`.

## The rule that decides the arguments

When a change trades responsiveness against correctness, correctness wins and the slowness is
documented instead. Specifically: an optimistic update whose failure cannot be rolled back visibly
does not ship; a narrowed revalidation that might leave a stale panel keeps the wider scope with a
comment saying why; and work moved into `after()` must have somewhere to report that it failed.

---

*Sprint 23. Concept accepted 2026-08-21; implementation not started.*
