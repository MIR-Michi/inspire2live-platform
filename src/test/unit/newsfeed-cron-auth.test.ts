import { afterEach, describe, expect, it, vi } from 'vitest'

const runOrgNewsfeedJob = vi.fn()
const isAiEnabled = vi.fn(() => true)

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/ai/feature-flag', () => ({ isAiEnabled: () => isAiEnabled() }))
vi.mock('@/lib/ai/org-newsfeed-job', () => ({ runOrgNewsfeedJob: (...args: unknown[]) => runOrgNewsfeedJob(...args) }))

import { GET } from '@/app/api/comms/newsfeed/route'

function request(authHeader?: string) {
  return new Request('https://example.com/api/comms/newsfeed', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('newsfeed cron route auth', () => {
  afterEach(() => {
    vi.clearAllMocks()
    isAiEnabled.mockReturnValue(true)
    delete process.env.CRON_SECRET
  })

  it('rejects a wrong CRON_SECRET with 401', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await GET(request('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(runOrgNewsfeedJob).not.toHaveBeenCalled()
  })

  it('returns 503 when AI is disabled', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    isAiEnabled.mockReturnValue(false)
    const res = await GET(request('Bearer expected-secret'))
    expect(res.status).toBe(503)
    expect(runOrgNewsfeedJob).not.toHaveBeenCalled()
  })

  it('runs the job with a matching secret', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    runOrgNewsfeedJob.mockResolvedValue({ ok: true, generated: 3, inserted: 2, skipped: null })
    const res = await GET(request('Bearer expected-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, inserted: 2 })
    expect(runOrgNewsfeedJob).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the job throws', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    runOrgNewsfeedJob.mockRejectedValue(new Error('boom'))
    const res = await GET(request('Bearer expected-secret'))
    expect(res.status).toBe(500)
  })
})
