import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { denyUnauthorizedCron } from '@/kernel/identity/cron-auth'

const SECRET = 'a-real-cron-secret'

function request(authHeader?: string) {
  return new Request('https://example.com/api/comms/digest', {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  })
}

let saved: string | undefined

beforeEach(() => {
  saved = process.env.CRON_SECRET
})

afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = saved
})

describe('denyUnauthorizedCron — the gate in front of every scheduled job', () => {
  describe('when CRON_SECRET is not configured', () => {
    // This is the case the old inline guard skipped entirely, and the reason
    // production served the digest job to anonymous callers. If any assertion
    // in this block is ever relaxed, that exposure is back.
    it('refuses when the variable is unset', async () => {
      delete process.env.CRON_SECRET
      const denied = denyUnauthorizedCron(request(`Bearer ${SECRET}`))
      expect(denied).not.toBeNull()
      expect(denied?.status).toBe(503)
    })

    it('refuses when the variable is empty or only whitespace', () => {
      for (const value of ['', '   ', '\t\n']) {
        process.env.CRON_SECRET = value
        expect(denyUnauthorizedCron(request(`Bearer ${SECRET}`))?.status).toBe(503)
      }
    })

    it('refuses a caller presenting no credential at all', () => {
      delete process.env.CRON_SECRET
      expect(denyUnauthorizedCron(request())).not.toBeNull()
    })

    it('explains that the server is misconfigured rather than blaming the caller', async () => {
      delete process.env.CRON_SECRET
      const body = await denyUnauthorizedCron(request())!.json()
      expect(body.error).toMatch(/CRON_SECRET/)
      expect(body.error).not.toMatch(/unauthori[sz]ed/i)
    })
  })

  describe('when CRON_SECRET is configured', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = SECRET
    })

    it('allows the matching bearer token', () => {
      expect(denyUnauthorizedCron(request(`Bearer ${SECRET}`))).toBeNull()
    })

    it('accepts the scheme case-insensitively, as senders spell it differently', () => {
      for (const header of [`bearer ${SECRET}`, `BEARER ${SECRET}`, `Bearer  ${SECRET}`]) {
        expect(denyUnauthorizedCron(request(header))).toBeNull()
      }
    })

    it('accepts a bare token without the scheme', () => {
      expect(denyUnauthorizedCron(request(SECRET))).toBeNull()
    })

    it('rejects a wrong token with 401', () => {
      expect(denyUnauthorizedCron(request('Bearer wrong'))?.status).toBe(401)
    })

    it('rejects a missing header with 401', () => {
      expect(denyUnauthorizedCron(request())?.status).toBe(401)
    })

    it('rejects a prefix of the secret, which a truncating comparison would let through', () => {
      expect(denyUnauthorizedCron(request(`Bearer ${SECRET.slice(0, -1)}`))?.status).toBe(401)
      expect(denyUnauthorizedCron(request(`Bearer ${SECRET}x`))?.status).toBe(401)
    })

    it('is case-sensitive about the secret itself', () => {
      expect(denyUnauthorizedCron(request(`Bearer ${SECRET.toUpperCase()}`))?.status).toBe(401)
    })

    it('tolerates surrounding whitespace on both sides', () => {
      process.env.CRON_SECRET = `  ${SECRET}  `
      expect(denyUnauthorizedCron(request(`Bearer  ${SECRET} `))).toBeNull()
    })
  })
})
