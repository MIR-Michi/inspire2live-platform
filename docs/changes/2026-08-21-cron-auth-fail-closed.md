# The cron routes were open to the internet

**Date:** 2026-08-21
**Author:** Michael
**Type:** Fix (security)
**Severity:** High — unauthenticated email sending and unauthenticated AI spend in production
**Related:** [`ENVIRONMENT_REFERENCE.md`](../ENVIRONMENT_REFERENCE.md) ·
[`sprints/sprint-23-responsiveness/tasks.md`](../../sprints/sprint-23-responsiveness/tasks.md) (where it was found)

## What was wrong

All five scheduled routes guarded themselves like this:

```ts
const expected = process.env.CRON_SECRET
const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
if (expected && provided !== expected) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

The `expected &&` makes the whole check **conditional on the secret existing**. With `CRON_SECRET`
unset, the comparison never runs and every caller is treated as the scheduler.

`CRON_SECRET` was unset in production. An anonymous `GET https://…/api/comms/digest` returned
**`200`, not `401`**.

What that exposed, to anyone who guessed a path:

| Route | What an anonymous caller could trigger |
|---|---|
| `/api/comms/digest` | Sends the digest email to every comms user whose configured digest minute matches |
| `/api/comms/newsfeed` | Starts the org-newsfeed fan-out AI job (300 s budget) |
| `/api/comms/conferences` | Starts conference discovery — ~36 AI lanes with web search |
| `/api/comms/podcast/radar` | Starts the Radar scan |
| `/api/comms/podcast/retention` | Runs the retention purge (deletes people records, anonymises cards) |

These routes use the **service-role** client, so RLS is not standing behind them. The shared secret
was the only control, and it was switched off by its own absence.

## How it survived

Three things had to line up, and all three did.

**The test only ever tested the safe half.** `newsfeed-cron-auth.test.ts` had four cases; every one
of them set `CRON_SECRET` and then presented a *wrong* secret. The branch that shipped — variable
unset — was never executed by a test.

**The documentation described the behaviour we wanted, so reading it was reassuring.**
`ENVIRONMENT_REFERENCE.md` said "If missing: Cron endpoints will reject requests (401)". It had
said that since the variable was introduced. It was never true.

**It was noticed and filed as a note.** Sprint 22's task list records, next to S22-T15, "the auth
idiom fails **open** when `CRON_SECRET` is unset" — written as a caveat about the pattern rather
than as live exposure, and never followed up.

## The fix

One guard, in the kernel, used by all five routes: `denyUnauthorizedCron`
(`src/kernel/identity/cron-auth.ts`). Five copies of a security check is four too many, and it is
now one place to read, test, and point a future governance rule at.

Three changes of behaviour beyond deduplication:

- **A missing secret refuses.** No secret, no run.
- **The refusal is `503`, not `401`.** Nothing is wrong with the caller when the server has no
  secret configured; the server is broken. And a scheduled job that starts failing loudly is the
  point — a red cron in the Vercel dashboard is how an operator learns the variable is missing.
- **Constant-time comparison.** The tokens are compared as SHA-256 digests, which is both
  timing-safe and immune to the length-mismatch throw in `timingSafeEqual`. `!==` on a secret leaks
  its length and, in principle, its prefix.

The signature returns `NextResponse | null` rather than a boolean, so the call site reads
`const denied = denyUnauthorizedCron(request); if (denied) return denied`. A boolean that nobody
checks looks like working code; an unused response does not.

## Verification

- 32 tests across three files: the helper in isolation (unset, empty, whitespace-only, missing
  header, wrong token, a prefix and a superstring of the real one, case sensitivity, the `Bearer`
  scheme spelled three ways) and every one of the five routes asserting both a refusal **and** that
  the expensive side effect behind it was never reached.
- **The tests were confirmed to fail against the old code.** Reintroducing the fail-open branch
  turns 10 of them red across all five routes; reverting turns them green. A test written after a
  bug is worth what it catches, so it was made to catch it.
- Five gates green.

## Follow-ups

1. **Set `CRON_SECRET` in Vercel.** Until it is set, the scheduled jobs are now *off* rather than
   open. That is the right way round, but it is not a working state — the digest, discovery,
   newsfeed, Radar and retention crons will all 503 until the variable exists.
2. **Check what was triggered.** The exposure window is however long the variable has been unset.
   Resend's send log and `ai_usage_log` will show whether anything ran that should not have. Two
   calls on 2026-08-21 around 10:40 CEST were mine, from the probe that found this: a `GET` of the
   digest route (which returned 200 — it only sends to recipients whose local time matches their
   configured digest minute exactly, so probably nothing went out, but the response body was not
   captured) and a `GET` of the newsfeed route (which timed out client-side after 25 s, consistent
   with an AI run having started server-side).
3. **A governance gate** asserting no route under `src/app/api/**` reads `process.env.CRON_SECRET`
   directly is proposed as Sprint 23's S23-T21 — the same shape of rule as the other two there.
