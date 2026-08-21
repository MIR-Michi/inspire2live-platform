# Performance & Responsiveness Concept

**Status:** Accepted concept, not yet built — see [`sprints/sprint-23-responsiveness/`](../sprints/sprint-23-responsiveness/description.md)
**Date:** 2026-08-21
**Related:** [ADR-0009](ADR/0009-modular-component-architecture.md) · [`AI_INTEGRATION.md`](AI_INTEGRATION.md) · [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) · [`MONITORING.md`](MONITORING.md)

---

## 1. The problem

The conference space was reported as feeling slow and unresponsive. It is, and it is the worst
case — but it is not a conference bug. Reading the codebase against that complaint turned up a set
of platform-wide defaults that nobody ever chose, each of which independently multiplies the delay
between a click and a visible response.

Two facts frame everything below.

**The platform is unmeasured.** There is no timing instrumentation, no client-side vitals
collection, no slow-query log, and no performance budget in CI. Every number in this document is
derived from reading code — round-trip counts, timeout constants, call-site counts — not from
observing production. That is a finding in itself, and it is why the first task of the sprint is
measurement rather than repair. **Nothing here should be optimised before it is measured**, because
one of the four causes below may turn out to dominate the other three by an order of magnitude, and
we currently cannot tell which.

**The causes are multiplicative, not additive.** A page that makes 15 database round trips is fine
at 5 ms each and unusable at 100 ms each. Fixing the count matters far less than fixing the cost
per trip, and fixing both matters far more than either. This is why the fixes are ordered the way
they are rather than by how bad each finding looks in isolation.

## 2. Diagnosis: four multipliers

### 2.1 Distance — possibly the whole story, and unverified

Supabase runs in **AWS `eu-central-1`, Frankfurt** ([`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md) §Data residency,
[ADR-0002](ADR/0002-supabase-baas.md)). `vercel.json` contains **no `regions` key**, so unless the
Vercel project setting overrides it, serverless functions run in Vercel's default region `iad1` —
Washington, D.C.

If that is the live configuration, every single database round trip is a transatlantic
round trip of roughly 90–110 ms, and the auth calls are a second transatlantic hop to GoTrue. A
page that makes 15 sequential-ish round trips then spends **1.4–1.7 seconds purely in flight**,
before Postgres does any work, before a byte is rendered, and doubled again for European users
whose own latency to `iad1` is added on top.

Co-locating functions with the database is a **one-line change** to `vercel.json`. If the project
is already pinned to `fra1`, this section costs nothing to verify and can be closed in ten minutes.
If it is not, it is very likely the largest single win available and it makes several of the
findings below drop from "serious" to "tidy up eventually".

**This is why it is task one.**

### 2.2 Repetition — the same answer fetched three to five times per page

There is **no request-scoped memoisation anywhere in this repository.** React's `cache()` has zero
matches across `src`; so do `unstable_cache` and `revalidateTag`. `next/cache` is imported in 34
files and used exclusively for `revalidatePath` — write-side invalidation only, never reads.

There is also **no canonical `getCurrentUser()` helper**. That absence is the root cause rather than
a symptom: with nothing to memoise, every layout, page, and action hand-rolls the same four lines
against a freshly constructed Supabase client (~150 `createClient()` call sites across 113 files).
`requireCommsUser` exists as three independent copies.

The result, per page load:

| Page | `auth.getUser()` | `profiles` queries |
|---|---|---|
| `/app/comms/intake` | 3 | 3 |
| `/app/dashboard` | 4 | 4 |
| `/app/comms/conferences/[id]` | 4 | 5 |
| `/app/comms/calendar` | 4 | 5 |
| `/app/initiatives/[id]` | 4 | 4 |

`auth.getUser()` is not a cookie read — it is a network call to the Supabase auth server that
validates the token. Calling it four times is four network calls. (It is nevertheless the *correct*
call for an authorisation decision; the fix is to make it once and share the answer, never to
downgrade to `getSession()`.)

The same shape appears in settings. `resolvePanel` (`src/kernel/settings/resolver.ts:20`) reads the
**entire `platform_settings` table with no filter**, and `resolveSetting` calls it once per key —
so `resolvePlanningConfig` issues six identical full-table scans and `resolveNetworkConfig` four.
Rendering the podcast planner performs **eleven identical scans of `platform_settings`**.

A single `cache()`-wrapped helper collapses the auth column to 1 and the settings scans to 1, with
no schema change and no behaviour change.

### 2.3 Serialization — waterfalls, and one queue that blocks everything

**Layout waterfalls.** `src/app/app/layout.tsx` runs a six-to-eight step chain in which several
steps have no data dependency on each other (`:32` getUser → `:35` profiles → `:74` notifications
count → `:83` space permissions → `:86` campus counts ‖ design config).
`src/app/app/initiatives/[id]/layout.tsx` is five sequential awaits with no `Promise.all` at all,
including an `initiatives` lookup that needs only a URL parameter and could have started
immediately. Because layout awaits sit *outside* the `loading.tsx` boundary, none of this is
covered by a skeleton: the user stares at the previous page.

**The Server Action queue — the conference symptom, explained.** Next.js
[dispatches Server Actions one at a time per client](https://nextjs.org/docs/app/guides/server-actions):
"If a user triggers three actions in quick succession, the second waits for the first… do not rely
on `Promise.all` to parallelize Server Actions from the client." Every button in the conference UI
is a Server Action.

On mount — with no click from anyone — the conferences list queues up to **120 AI enrichment
Server Actions**, each of which may run four web searches and a model call with a **90-second
timeout** (`conferences-shell.tsx:175-203`, `BACKGROUND_DETAIL_LIMIT = 120`;
`ai-features/domain/conferences.ts:712`). The `concurrency = 2` in that code is an illusion: the
client dispatcher serialises them regardless.

While one of those occupies the queue, *every other action from that browser tab is stalled* —
Add to shortlist, the stage dropdown, Assign attendee, every checkbox on the detail page. Each
button sets its own pending flag and disables itself, so the user sees a dead, greyed-out
interface with no explanation, for up to 90 seconds. On the success path the loop happens to
self-terminate after the first enrichment; **on the failure path it does not**, because the error
branch skips `revalidatePath`, so nothing changes the prop identity that would cancel it, and the
workers grind through all 120.

This single mechanism explains the reported symptom better than any query cost, and it is why
"the conference space is slow" is a misdiagnosis worth correcting: the conference space is
*blocked*, which feels like slowness but is repaired differently.

**Long work on click paths elsewhere.** The same pattern, less extreme, is everywhere: intake
structuring, "Suggest guests" (90 s and 180 s timeouts), publishing drafts, campus briefings, and
meeting summaries all `await` a model inline from a click. Roughly eleven sites `await` a Resend
email send inline — changing a task's owner blocks on an email. Bulk guest invites loop guests
serially, sending an email *and* a WhatsApp message per iteration, while the single-guest path
right beside it correctly uses `after()`. Two pollers (`use-conference-run`, `use-org-newsfeed-run`)
tick every 4 seconds **through Server Actions**, each doing its own `getUser()` + `profiles`, and
therefore each taking a turn in the same queue.

### 2.4 Blast radius — every mutation re-renders the world, usually twice

`useOptimistic` has **zero uses in the repository**. Every mutation is pessimistic: the user waits
for the server before anything changes on screen.

Then they wait a second time, because the near-universal client pattern is:

```tsx
startTransition(async () => {
  const result = await action()   // the action already called revalidatePath
  router.refresh()                // …and now we re-render the route again
})
```

`revalidatePath` inside an action already makes Next re-render the route and ship a fresh RSC
payload in the action's own response. The `router.refresh()` is a redundant second full render, and
because it is *inside* the transition, the button stays disabled for both. This double-refresh
appears in at least a dozen components across every space; contact assignment manages a **triple**
round trip (action → re-read action → refresh).

The revalidation scope is also far wider than the data that changed. There are **234
`revalidatePath` call sites**. Ticking one campus checklist item revalidates four paths; a
transcript write revalidates five, two of them `'layout'`-scoped; saving the design panel
revalidates `/app` at layout scope — the entire authenticated tree. Every one of the 15 write
actions in the `network` module revalidates the podcast planner page. No `revalidateTag` exists
anywhere, so path-level is the only granularity available.

Meanwhile a single toggle on the conference detail page re-runs ~15 queries, two redundant auth
pairs, and a write RPC (`auto_advance_conference_stage`) that is appended sequentially after every
render of that page.

Finally, **shared pending flags freeze whole lists.** One `useTransition` boolean gating an entire
table appears in at least six components (campus meeting checklist, event task checklist, network
connection checks, route explorer, conferences shell, transcript panel): changing one row's owner
disables every control on every row. Only `unified-task-status-control.tsx` scopes the transition
per row, and it is the model to copy.

### 2.5 Nothing streams

`<Suspense>` appears nowhere in the authenticated tree — only in `login` and `setup-password`.
There are **7 `loading.tsx` files for 63 pages**. Every page is all-or-nothing: the slowest query
on the page decides when *any* of it appears. And `router.refresh()` does not trigger `loading.tsx`
at all, so the post-mutation wait — the most common wait in the product — is almost always silent.

## 3. What "responsive" means here

Perceived performance is a matter of thresholds, not averages, and the thresholds are well
established: **100 ms** reads as instantaneous, **1 second** preserves the sense of acting on the
system directly, and beyond **10 seconds** attention leaves. We adopt those as budgets rather than
aspirations, and we measure at p75 on the hardware and connection our users actually have.

| Interaction | Budget | Enforced by |
|---|---|---|
| Any click produces a **visible change** | **≤ 100 ms**, always | Optimistic UI — never involves the server |
| A mutation is **confirmed** (server truth on screen) | ≤ 1 s p75 | Narrow revalidation, no double refresh |
| Navigation shows **structure** (skeleton or partial content) | ≤ 300 ms | Streaming + `loading.tsx` at every segment |
| Navigation is **complete and interactive** | ≤ 1.5 s p75 | Request memoisation, region, parallel loaders |
| Work that cannot meet the above | **off the action queue entirely** | `after()` / route handler / cron, with its own progress surface |

The last row is the load-bearing one. Nothing in the product is forbidden from taking 90 seconds;
what is forbidden is taking 90 seconds *of a person's attention* or *of the queue their next click
needs*.

## 4. Principles

Six rules, from which nearly every fix in §5 follows mechanically.

1. **Answer the person before you answer the database.** A click changes the screen immediately and
   reconciles afterwards. If the write fails, roll back visibly and say why.
2. **Never make a person wait for work that is not theirs.** Enrichment, email, embeddings and
   scans belong on a background path with their own progress surface — never inline in the click,
   and never on the Server Action queue.
3. **Ask once per request.** Identity, profile and settings are resolved a single time and shared.
   New code reaches them through one canonical helper, never by hand-rolling the query.
4. **Invalidate what changed, not where it lives.** Revalidation scope is a correctness *and*
   latency decision. Wider is not safer; it is slower and it is a silent cross-module coupling.
5. **Server Actions mutate; route handlers read.** Reads on the action queue — pollers, searches,
   enrichment — steal turns from the mutations the user is waiting on. Route handlers run in
   parallel and are the correct home for them.
6. **Show structure early.** Stream. Every route segment has a `loading.tsx`; slow panels sit behind
   their own `<Suspense>` and do not hold up the page around them.

## 5. The fixes, in leverage order

Ordered by expected improvement per unit of risk, not by how alarming each finding reads.

| # | Fix | Why here | Risk |
|---|---|---|---|
| 0 | **Measure.** Server timing on every request, Web Vitals from real sessions, a round-trip counter in dev. | Everything below is a hypothesis until this exists, and one item may dwarf the rest. | None |
| 1 | **Co-locate functions with the database** (`regions: ["fra1"]`). | One line; potentially divides every latency in the product by a large constant. Verify the current setting first. | Very low |
| 2 | **One `cache()`-wrapped `getCurrentUser()` / `getProfile()` / `resolvePanel`.** | Collapses 3–5 auth round trips to 1 and 11 settings scans to 1, platform-wide, with no behaviour change. Mechanical rollout across ~113 files. | Low |
| 3 | **Get AI and email off the click path and off the action queue.** Delete the 120-item mount prefetch; move enrichment behind a route handler or a background run; `after()` for notification email; move the two 4-second pollers to route handlers. | Repairs the reported symptom directly. | Medium |
| 4 | **Optimistic UI on the top ~20 interactions**, and scope every `useTransition` to the control that owns it. | Buys the 100 ms budget outright on the interactions people repeat all day. | Medium |
| 5 | **Narrow revalidation**; delete the redundant `router.refresh()` after `revalidatePath`. | Halves the cost of most mutations and removes cross-module coupling. | Medium |
| 6 | **Stream.** `loading.tsx` per segment, `<Suspense>` around slow panels, parallelise layout waterfalls. | Turns remaining latency into something the user can watch instead of something that looks broken. | Low |
| 7 | **Guardrails** so this does not regress: a governance gate and a documented budget. | Everything above is a one-time repair; without a gate it decays. | Low |

## 6. Deliberately not doing

- **A caching layer over the database.** No Redis, no `unstable_cache` on user data, no ISR on
  authenticated pages. Every one of those trades correctness or RLS clarity for speed, and none is
  needed if 1–3 land. Request-scoped memoisation (`cache()`) is different in kind: it dedupes
  *within* one render and cannot serve stale data across requests.
- **Swapping `getUser()` for `getSession()`.** It would be faster and it would weaken every
  authorisation decision in the product. Not a trade we make.
- **Rewriting the two large conference shells.** Tempting, out of scope, and mostly unnecessary once
  the queue is unblocked.
- **Query and index tuning as an opening move.** Several unbounded queries deserve limits
  (§2 findings note a whole-table scan of `conference_contact_assignments` on every list load), but
  hundreds of rows over a fast link are cheap. Revisit *after* measurement says otherwise.
- **A performance budget in CI that fails builds on timing.** Timing in CI is noisy and would train
  people to ignore it. The gate we add is structural (see §7) — it fails on patterns, which are
  deterministic.

## 7. How it is kept

A perf sprint without a gate is a perf sprint you repeat in a year. Three checks, all structural
and therefore stable, added to `pnpm governance`:

- **`auth.getUser()` may only be called inside the canonical kernel helper.** This is the rule that
  makes finding 2.2 unrepeatable; every other auth duplication in the product's history would have
  been caught by it.
- **No `revalidatePath('/app', 'layout')`, and no action revalidating more than two paths** without
  an inline justification comment.
- **No `runAiMessage` (or Resend send) reachable from a Server Action** unless it is inside
  `after()` or an explicitly annotated long-run route.

Plus the human half: [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) gains a short
"Responsiveness" section stating the §3 budgets and the §4 principles, and `AGENTS.md` §6 gains a
one-line guardrail pointing at it.

## 8. What must be settled by measurement, not argument

These are genuinely open, and the sprint's first task exists to close them:

1. **Which region do functions actually run in?** Decides whether §2.1 is the headline or a
   non-issue, and it changes the priority of everything else.
2. **How cold is the conference detail cache in production?** The 120-item prefetch only enqueues
   rows lacking a `detail`. If the discovery cron keeps that near zero, §2.3's worst case is rare;
   if it does not, it fires on every visit.
3. **Is the RLS helper `is_comms_team_or_admin()` hoisted to a one-time filter, or re-evaluated per
   row?** It takes no arguments and is declared `stable`, so it should hoist — but unverified, and
   if it does not, every unbounded scan carries a `profiles` lookup per row. One `EXPLAIN` settles it.
4. **How large is a typical RSC payload** on the conferences list, which ships every conference's
   full AI `detail` blob to the browser on every render?

## 9. Risk

The honest risk in this work is **breaking correctness while chasing speed**, in three specific
places. Optimistic UI can leave the screen disagreeing with the database when a write fails, so
every optimistic path needs a visible rollback and none may be applied to a write whose success is
genuinely in doubt. Narrowing revalidation can leave a stale panel somewhere the wide invalidation
was accidentally covering — which is why §7's limit is two paths *with justification*, not one path
absolutely. And moving work into `after()` moves it outside the request, where a failure no longer
surfaces to the person who caused it, so anything deferred needs somewhere to report having failed.

Each of the three is a reason to keep the sprint's changes small and separately reviewable, not a
reason to avoid them.

---

*Concept for Sprint 23. Last reviewed: 2026-08-21.*
