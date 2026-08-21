# Sprint 23 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. Completed tasks remain in the sprint record.
> Concept: `docs/PERFORMANCE_AND_RESPONSIVENESS_CONCEPT.md`
>
> **Sprint-wide guardrails.**
> **(1) Measure before and after, on the same route and account, and write the numbers into the
> Notes column.** A task claiming an improvement without a recorded pair is not Completed.
> **(2) Correctness wins.** An optimistic update that cannot roll back visibly does not ship; a
> narrowed revalidation that might strand a stale panel keeps its scope with a comment saying why.
> **(3) One workstream per PR.** These changes touch a hundred files; a mixed PR cannot be reviewed
> or reverted.

## A — Measure first

Nothing in B–F should start before A01 and A02 are done. They decide the order of everything else.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T01 | **Answer the region question.** Pin `regions: ["fra1"]` in `vercel.json` so compute is co-located with Supabase's `eu-central-1`. | Michael | **Done — measurement outstanding** | Diagnosed and pinned on 2026-08-21 (branch `perf/pin-function-region`, `docs/SDLC.md` §9). **What remains is the number:** re-read `x-vercel-id` after the deploy to confirm the compute segment now says `fra1`, and take the T03 journeys before/after. Until that is recorded this task is not closed, because the whole sprint is ordered against how large this turns out to be. **The diagnosis, kept because it explains the ordering:** Production functions run in **`iad1` (Washington, D.C.)** while the database is in **`eu-central-1` (Frankfurt)**. Measured directly off two side-effect-free production routes, which return `x-vercel-id: fra1::iad1::…` — the format is `<edge>::<compute>::<id>`, so European users hit the Frankfurt edge and are then served by US-East compute that talks back across the Atlantic to Frankfurt for **every single query**. At a typical `iad1`↔`eu-central-1` round trip of 85–95 ms, and 11–16 round trips per page (concept §2.2), that is **roughly 1.0–1.5 s of pure network per page load**, paid again on every mutation — and doubled where the route re-renders twice. Note the diagnostic trap for whoever verifies this: a prerendered page such as `/login` returns a two-part `fra1::…` id, which is only the *edge* node and looks reassuring. Force a function invocation (any `/api/*` route) to see the compute segment. **This one line is now the single highest-leverage change in the sprint**, and it must be measured before and after, because it rescales every other task's value. |
| S23-T01b | **Know which database a measurement was taken against.** `pnpm dev` is fine — `.env.development.local` points at the local stack (`127.0.0.1:54321`) and, being development-scoped, it outranks `.env.local`. But `.env.local` holds the **cloud** project URL and Next loads it in *production* mode too, where `.env.development.local` is not read. So `pnpm build && pnpm start` on a laptop talks to the shared cloud database over home broadband (~40–88 ms per round trip, ×11–16 per page). | TBD | Not Started | **Corrected 2026-08-21** — an earlier version of this row claimed `pnpm dev` itself paid that cost. It does not; the dev-server log shows every Supabase call going to `127.0.0.1`. What survives the correction is narrower but still matters for T03: a local production build is neither a clean local measurement nor a representative deployed one, so **take the baselines against a real deployment**, and record which environment each number came from. Separately, and outside this sprint: if `bvccuypipogprmjxctxp` is the production project, a local production build writing to it is a data-safety question — raise it, do not fix it here. |
| S23-T02 | **Instrument.** Per-request server timing (total, DB round-trip count, cumulative DB ms) exposed in dev and via `Server-Timing` in production; real-user Web Vitals (INP above all — it is the metric that matches this complaint); a dev-only counter that logs how many times per request `getUser`, `profiles` and `platform_settings` were hit. | TBD | Not Started | INP, not LCP: the complaint is about clicks, not first paint. The round-trip counter is what makes S23-T05's acceptance criterion checkable rather than a matter of reading code. |
| S23-T03 | **Baseline five journeys.** Conferences list open · conference detail checkbox toggle · podcast planner load · intake queue load + one status change · dashboard load. Record p50/p75 for the four §3 budgets on each. | TBD | Not Started | These five are the sprint's before-and-after ruler; keep the exact method reproducible so the closing measurement is comparable. Include one run on a realistic connection, not just localhost. |
| S23-T04 | **Settle the three open questions** from concept §8 that measurement can close: how cold the conference `detail` cache is in production, whether `is_comms_team_or_admin()` hoists (one `EXPLAIN`), and the RSC payload size of the conferences list. | TBD | Not Started | Each can retire or promote a later task. The `EXPLAIN` matters most: if the RLS helper is re-evaluated per row, every unbounded scan carries a `profiles` lookup per row and query work jumps the queue in priority. |

## B — Ask once per request

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T05 | **The kernel memoisation layer.** A canonical `getCurrentUser()`, `getProfile()` and a `cache()`-wrapped `createClient()` in `src/kernel/data` (or `kernel/auth`), plus `cache()` on `resolvePanel`. Returns the same object within one render pass; no cross-request caching of any kind. | TBD | Not Started | The absence of this helper **is** the root cause — with nothing to memoise, 113 files hand-rolled the query. Document plainly in the file header that `cache()` is request-scoped and cannot serve stale data, because that is the objection reviewers will raise. |
| S23-T06 | **Roll it out.** Replace hand-rolled auth in all six `layout.tsx` files, every page, and the three copies of `requireCommsUser`. Delete the duplicated `profiles` selects. Target: exactly one `getUser()` and one `profiles` read per request. | TBD | Not Started | Mechanical and large (~150 `createClient()` sites, 78 files calling `getUser()`). Verify with S23-T02's counter, page by page, not by grep. `src/app/app/comms/layout.tsx` becomes nearly empty — it currently re-fetches what its parent already has. |
| S23-T07 | **One settings read per request.** `resolvePlanningConfig` (6 keys) and `resolveNetworkConfig` (4) currently issue one full unfiltered `platform_settings` scan **per key** — eleven identical scans to render the planner. Collapse to one via T05, and add the filter the query never had. | TBD | Not Started | Two separate defects in one place: the missing memo *and* an unfiltered whole-table select. Fix both; a memoised full-table scan is still a full-table scan. |
| S23-T08 | **Parallelise the layout waterfalls.** `src/app/app/layout.tsx` (notifications count and space permissions have no dependency on each other) and `src/app/app/initiatives/[id]/layout.tsx` (five sequential awaits, zero `Promise.all`; the `initiatives` lookup needs only a route param and can start immediately). | TBD | Not Started | Layout awaits sit *outside* the `loading.tsx` boundary, so this latency is the part where the user still sees the previous page. Highest perceived value per line changed. |

## C — Nothing waits for work that is not theirs

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T09 | **Delete the conference mount prefetch.** Remove the 120-item AI enrichment queue fired from `useEffect` on the conferences list. Enrichment becomes either on-demand for the selected conference (via a **route handler**, off the action queue) or a job the existing discovery cron does. | TBD | Not Started | **The single highest-impact change for the reported complaint.** Note the failure-path bug while removing it: the error branch skips `revalidatePath`, so nothing cancels the loop and it grinds all 120. Whatever replaces it must not be able to fail open the same way. |
| S23-T10 | **Reads leave the action queue.** Convert the two 4-second pollers (`use-conference-run`, `use-org-newsfeed-run`) and the contact search from Server Actions to route handlers. Server Actions mutate; route handlers read. | TBD | Not Started | Each poll tick currently takes a turn in the same serialized queue as the user's clicks *and* does its own `getUser()` + `profiles`. Route handlers run in parallel — this is the documented Next.js remedy, not a workaround. |
| S23-T11 | **Notification email off the click path.** ~11 sites `await` a Resend send inline (`dashboard/actions.ts:224`, `campus-log`, `events`, `member-onboarding`, `transcripts`, `whatsapp/digest`). Move to `after()`. Give bulk guest invites the same treatment — it loops guests sending an email *and* a WhatsApp per iteration, while the single-guest path beside it already uses `after()` correctly. | TBD | Not Started | Changing a task's owner should not block on an SMTP provider. Deferred work needs somewhere to report failure (concept §9) — decide where before moving the first one. |
| S23-T12 | **Bound the remaining inline AI.** "Suggest guests" (90 s / 180 s), intake structuring, publishing drafts, campus briefings, meeting summary (map-reduce: several sequential calls) all `await` a model from a click. Each either moves to the run-lock + poll pattern, or keeps its inline call **and** gains an honest progress surface with a cancel. | TBD | Not Started | Not all of these must become background jobs — a 5 s wait with a good progress surface is acceptable. A 180 s wait behind a disabled button is not. `find-names-button.tsx`'s rotating narration is the best existing example; `campus-briefing-panel` is second. |
| S23-T13 | **Drop the per-render write.** `auto_advance_conference_stage` runs as a sequential write RPC after every render of the conference detail page, including every re-render caused by a checkbox. Move it to the transitions that can actually change a stage. | TBD | Not Started | A write on a read path is also an RLS and audit smell, not only a latency one. |

## D — Answer the person before the database

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T14 | **Optimistic UI on the top ~20 interactions.** Checkbox toggles, status and stage changes, owner assignment, add/remove from list, task ticks. `useOptimistic`, with a visible rollback on failure. | TBD | Not Started | Currently **zero** uses of `useOptimistic` in the repo. Two precedents to generalise: `comms-crm-pipeline-board.tsx:51` (hand-rolled, with a good comment on the flicker trap) and `unified-task-status-control.tsx`. **Exercise every rollback by forcing a failure** — the happy path is not the risk. |
| S23-T15 | **Scope every pending flag to its own control.** At least six components share one `useTransition` across a whole list (campus meeting checklist, event task checklist, connection-check panel, route explorer, conferences shell, transcript panel), so touching one row freezes all rows. | TBD | Not Started | `unified-task-status-control.tsx` is the pattern to copy. `event-task-checklist` and `campus-meeting-checklist` are near-duplicates — consider extracting one component rather than fixing the same file twice. |
| S23-T16 | **Remove the artificial delays.** `components/ui/client-buttons.tsx` holds modals open with `setTimeout(…, 1000–4000)` before refreshing, in seven admin/initiative/task modals, none of which use `useTransition`. | TBD | Not Started | Four seconds of deliberate latency on top of real latency. If the delay exists so a success message can be read, the message should persist through the refresh instead. |

## E — Invalidate what changed

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T17 | **Delete the double refresh.** Remove `router.refresh()` wherever the action already called `revalidatePath` — a dozen-plus components across every space. `revalidatePath` already ships a fresh RSC payload in the action's own response. | TBD | Not Started | Because `router.refresh()` sits *inside* `startTransition`, it also keeps the button disabled for a second full render. Contact assignment does a **triple** round trip (action → re-read action → refresh) and is the place to start. |
| S23-T18 | **Narrow the scope.** Audit the 234 `revalidatePath` sites. Worst first: `settings-actions.ts` revalidates `/app` at layout scope (the entire authenticated tree); `transcripts/actions.ts` hits five paths, two layout-scoped; all 15 `network` write actions revalidate the podcast planner. | TBD | Not Started | Cross-module revalidation is a boundary violation wearing a performance costume — `network` writes should not know the planner's route. May be worth a `revalidateTag` foundation; decide once, in this task, rather than per-call-site. |
| S23-T19 | **Stream.** A `loading.tsx` for every route segment (7 exist for 63 pages) and `<Suspense>` around slow panels — there is currently **no `<Suspense>` anywhere** in the authenticated tree. | TBD | Not Started | Note the limit honestly: `router.refresh()` does not trigger `loading.tsx`, so this helps navigation, not post-mutation waits. Those are D's job. |
| S23-T20 | **Trim the payload and the obvious query waste.** The conferences list ships every conference's full AI `detail` blob to the browser though one is displayed; `conference_contact_assignments` is scanned whole with no filter or limit on every list load; the CRM interaction fallback uses a leading-wildcard `ilike` that no index can serve. | TBD | Not Started | **Gated on S23-T04.** Hundreds of rows over a fast link are cheap — do this only if measurement says the payload or the scans are actually material. |

## F — Keep it

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S23-T21 | **Four governance gates.** (1) `auth.getUser()` only inside the canonical kernel helper. (2) No `revalidatePath('/app', 'layout')`, and no action revalidating 3+ paths without a justification comment. (3) No `runAiMessage` or Resend send reachable from a Server Action outside `after()` or an annotated long-run route. (4) No route reads `process.env.CRON_SECRET` directly — the guard is `denyUnauthorizedCron` (added after the fail-open exposure found while planning this sprint). | TBD | Not Started | Structural, so deterministic — unlike a timing budget, which is noisy in CI and trains people to ignore it. **Demonstrate each gate failing** on a deliberate violation, then revert. A gate never seen to fail is not known to work. |
| S23-T22 | **Close the loop: re-measure.** Re-run S23-T03's five journeys and put the before/after table in the sprint outcome. Anything that missed its budget is recorded as missed, with why. | TBD | Not Started | This is the acceptance criterion for the sprint as a whole. Honest misses are more useful than a table of green ticks. |
| S23-T23 | **Documentation.** Concept marked built; `IMPLEMENTATION_GUIDE.md` gains a Responsiveness section with the §3 budgets and §4 principles; `AGENTS.md` §6 gains the one-line guardrail; `MONITORING.md` records what is now measured and where to look; `CHANGELOG`; `REQ-PERF-*` rows in `TRACEABILITY.md`; docs index; sprints README. | TBD | Not Started | Same PR as the behaviour it documents (AGENTS.md §8). The `IMPLEMENTATION_GUIDE` section is the one that changes future code — write it for someone who has never read this sprint. |

## Found while planning — not this sprint's work

**The five cron routes are publicly invocable in production.** All of them use the idiom
`if (expected && provided !== expected) return 401`, which **fails open when `CRON_SECRET` is
unset** — and it is unset in production: an anonymous `GET` to `/api/comms/digest` returned `200`,
not `401`. That endpoint sends email to every comms user whose configured digest minute matches;
`/api/comms/newsfeed` and `/api/comms/conferences` start fan-out AI jobs with a 300-second budget.
So the exposure is unauthenticated email sending and unauthenticated spend, by anyone who guesses
the path.

**Fixed the same day, on its own branch** (`fix/cron-auth-fail-closed`), because it is a security
and cost issue rather than a responsiveness one and should not wait for a sprint. One kernel guard,
`denyUnauthorizedCron`, failing closed; 32 tests, confirmed to fail against the old code. Full
account in [`docs/changes/2026-08-21-cron-auth-fail-closed.md`](../../docs/changes/2026-08-21-cron-auth-fail-closed.md).

**Two things it leaves for this sprint.** `CRON_SECRET` must be set in Vercel — until it is, the
scheduled jobs are off rather than open, which is the right way round but not a working state. And
S23-T21 gains a fourth gate: no route may read `process.env.CRON_SECRET` directly. Worth noting why
the original survived, since it is the same failure mode the rest of this sprint's gates are meant
to prevent — the tests set the secret in every case and only ever presented a *wrong* one, so the
branch that actually shipped was never executed by a test, and the environment reference had always
documented the behaviour we wanted rather than the behaviour we had.

## Also found: the test suite is not deterministic

Adding two test files to the suite made **other, untouched** tests fail — `invite-user-account`,
`resend-invitation` and the dead-code scan — with the signature of accumulated mock state
("expected 1 call, got 2"). They pass in isolation, they pass in a three-file run alongside the new
files, `main` passes cleanly, and the combined branch then passed three full runs in a row. Two
runs failed with *different* sets of files. So it is a flake, not a defect, and the new tests only
exposed it.

The likely mechanism is load rather than leakage: Vitest isolates files by default, but
`invite-user-account` takes ~14 s and `resend-invitation` ~6.5 s, which is extraordinary for unit
tests and points at real timers or waits. Two more files in the pool changes the scheduling enough
to tip them over.

This matters here because the sprint will be judged on measurements, and a suite that fails
randomly makes every "did this help?" answer unreliable — and it means CI can go red for reasons
nobody changed. Worth a task of its own: find what those two files are actually waiting on. Not
scoped into this sprint, because it is test infrastructure rather than product responsiveness.

## Outcome

*To be written when the sprint closes. Must contain the before/after table from S23-T22, and an
honest account of any budget not met.*
