import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every scheduled route refuses an unauthenticated caller — including when
 * `CRON_SECRET` is absent from the environment.
 *
 * The existing route test only ever set the secret and then presented a *wrong*
 * one, so the branch that actually shipped to production — variable unset,
 * comparison skipped, job runs for anyone — was never executed by a test. These
 * routes hold the service-role client, so what got through could send email to
 * the whole comms team and start fan-out AI jobs.
 *
 * Each case therefore asserts two things: the status is a refusal, and the
 * expensive side effect behind the route was never reached.
 */

// ─── side-effect spies, asserted to stay untouched ───────────────────────────
const sendScheduledCommsDigests = vi.fn()
const runOrgNewsfeedJob = vi.fn()
const markConferenceRunStarted = vi.fn()
const executeAndRecordConferenceRun = vi.fn()
const runRadarScan = vi.fn()
const claimRadarRun = vi.fn()
const purgeInactivePeople = vi.fn()
const anonymiseClosedCards = vi.fn()

const EXPENSIVE = [
  sendScheduledCommsDigests,
  runOrgNewsfeedJob,
  markConferenceRunStarted,
  executeAndRecordConferenceRun,
  runRadarScan,
  claimRadarRun,
  purgeInactivePeople,
  anonymiseClosedCards,
]

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/comms-access', () => ({ canAccessCommsWorkspace: () => true }))
vi.mock('@/lib/ai/feature-flag', () => ({ isAiEnabled: () => true }))
vi.mock('@/kernel/settings', () => ({ resolveSetting: async () => undefined }))
vi.mock('@/modules/settings-registry', () => ({ findSettingsPanel: () => null }))

vi.mock('@/lib/comms-digest', () => ({
  sendScheduledCommsDigests: (...args: unknown[]) => sendScheduledCommsDigests(...args),
}))
vi.mock('@/lib/ai/org-newsfeed-job', () => ({
  runOrgNewsfeedJob: (...args: unknown[]) => runOrgNewsfeedJob(...args),
}))
vi.mock('@/lib/ai/conference-run', () => ({
  markConferenceRunStarted: (...args: unknown[]) => markConferenceRunStarted(...args),
  executeAndRecordConferenceRun: (...args: unknown[]) => executeAndRecordConferenceRun(...args),
}))
vi.mock('@/modules/network', () => ({
  purgeInactivePeople: (...args: unknown[]) => purgeInactivePeople(...args),
  resolveRetentionMonths: async () => 18,
}))
vi.mock('@/modules/podcast-planning', () => ({
  countPendingProposals: async () => 0,
  planningAdminDb: async () => ({}),
  resolveRadarConfig: async () => ({ enabled: true, intervalDays: 14, monthlyBudgetUsd: 10 }),
  readRadarStatusRow: async () => ({ finishedAt: null }),
  checkRadarBudget: async () => ({ withinBudget: true, spentUsd: 0, reason: '' }),
  finishRadarRun: async () => undefined,
  reportRadarProgress: async () => undefined,
  asksForRehearsal: () => false,
  runRadarScan: (...args: unknown[]) => runRadarScan(...args),
  claimRadarRun: (...args: unknown[]) => claimRadarRun(...args),
  anonymiseClosedCards: (...args: unknown[]) => anonymiseClosedCards(...args),
}))

import { GET as digest } from '@/app/api/comms/digest/route'
import { GET as newsfeed } from '@/app/api/comms/newsfeed/route'
import { GET as conferences } from '@/app/api/comms/conferences/route'
import { GET as radar } from '@/app/api/comms/podcast/radar/route'
import { GET as retention } from '@/app/api/comms/podcast/retention/route'

const ROUTES: Array<[string, (request: Request) => Promise<Response>]> = [
  ['/api/comms/digest', digest],
  ['/api/comms/newsfeed', newsfeed],
  ['/api/comms/conferences', conferences],
  ['/api/comms/podcast/radar', radar],
  ['/api/comms/podcast/retention', retention],
]

function request(path: string, authHeader?: string) {
  return new Request(`https://example.com${path}`, {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

let saved: string | undefined

beforeEach(() => {
  saved = process.env.CRON_SECRET
})

afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = saved
  vi.clearAllMocks()
})

describe.each(ROUTES)('%s', (path, handler) => {
  it('refuses and does no work when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await handler(request(path, 'Bearer anything'))
    expect(res.status).toBe(503)
    for (const spy of EXPENSIVE) expect(spy).not.toHaveBeenCalled()
  })

  it('refuses and does no work when the secret is wrong', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const res = await handler(request(path, 'Bearer not-the-real-secret'))
    expect(res.status).toBe(401)
    for (const spy of EXPENSIVE) expect(spy).not.toHaveBeenCalled()
  })

  it('refuses and does no work when no credential is presented', async () => {
    process.env.CRON_SECRET = 'the-real-secret'
    const res = await handler(request(path))
    expect(res.status).toBe(401)
    for (const spy of EXPENSIVE) expect(spy).not.toHaveBeenCalled()
  })
})
