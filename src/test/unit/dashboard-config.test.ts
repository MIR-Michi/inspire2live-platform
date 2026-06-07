import { describe, expect, it } from 'vitest'
import { getDashboardConfig } from '@/lib/dashboard-config'

describe('getDashboardConfig', () => {
  it('returns the comms dashboard blocks for the Comms role', () => {
    expect(getDashboardConfig('Comms')).toMatchObject({
      variant: 'comms',
      blocks: ['whats_up_today', 'this_week', 'needs_attention', 'content_ready', 'notifications'],
    })
  })

  it('falls other roles back to the shared default dashboard structure', () => {
    expect(getDashboardConfig('BoardMember')).toMatchObject({
      variant: 'default',
      blocks: ['role_summary', 'notifications', 'newsfeed'],
    })
    expect(getDashboardConfig('IndustryPartner')).toMatchObject({
      variant: 'default',
      blocks: ['role_summary', 'notifications', 'newsfeed'],
    })
    expect(getDashboardConfig('PatientAdvocate')).toMatchObject({
      variant: 'default',
      blocks: ['role_summary', 'notifications', 'newsfeed'],
    })
  })
})
