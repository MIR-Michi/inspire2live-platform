import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * kernel/identity/cron-auth — the one gate in front of every scheduled route.
 *
 * These routes run with the **service-role** client, so RLS is not standing
 * behind them: whatever reaches the handler can send email to the whole comms
 * team or start a fan-out AI job. The shared secret is the only thing between
 * the open internet and that, which is why the check lives here once instead of
 * being retyped per route.
 *
 * **It fails closed.** Each route used to inline
 * `if (expected && provided !== expected) return 401`, which skips the whole
 * comparison when `CRON_SECRET` is unset — so a deployment that never set the
 * variable served every scheduled job to anonymous callers, and did it quietly,
 * because an unset secret looks identical to a correctly authorised cron. That
 * is not hypothetical: production answered `200` to an unauthenticated `GET` of
 * the digest route on 2026-08-21. A missing secret is now a refusal.
 *
 * The refusal is a **503, not a 401**, when the secret is absent. Nothing is
 * wrong with the caller in that case — the server is misconfigured — and a
 * scheduled job that starts failing loudly is the point: a red cron in the
 * Vercel dashboard is how an operator finds out, whereas a 401 reads like
 * someone else's problem and would be ignored.
 */

/** `Authorization: Bearer <secret>` — the header Vercel Cron sends. */
function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.replace(/^Bearer\s+/i, '').trim()
}

/**
 * Compare via fixed-length digests so the comparison is constant-time *and*
 * `timingSafeEqual` cannot throw on a length mismatch — a plain `!==` leaks the
 * length of the secret and, in principle, its prefix.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Returns a response to send when the caller may **not** run the job, or `null`
 * when it may. Shaped this way on purpose: a route that forgets to return the
 * value still reads oddly, whereas a boolean that is never checked looks fine.
 *
 * ```ts
 * const denied = denyUnauthorizedCron(request)
 * if (denied) return denied
 * ```
 */
export function denyUnauthorizedCron(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET?.trim() ?? ''

  if (expected === '') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'CRON_SECRET is not configured on this deployment, so scheduled jobs cannot be authenticated and will not run.',
      },
      { status: 503 }
    )
  }

  if (!secretsMatch(bearerToken(request), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
