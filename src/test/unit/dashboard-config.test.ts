import { describe, expect, it } from 'vitest'
import { getDashboardConfig } from '@/lib/dashboard-config'

describe('getDashboardConfig', () => {
  it('returns the comms dashboard blocks for comms users', () => {
    expect(getDashboardConfig('comms')).toMatchObject({
      userType: 'comms',
      blocks: ['whats_up_today', 'this_week', 'needs_attention', 'content_ready', 'notifications'],
    })
  })

  it('falls board and partner workspaces back to the shared default dashboard structure', () => {
    expect(getDashboardConfig('board')).toMatchObject({
      userType: 'board',
      blocks: ['role_summary', 'notifications', 'newsfeed'],
    })
    expect(getDashboardConfig('partner')).toMatchObject({
      userType: 'partner',
      blocks: ['role_summary', 'notifications', 'newsfeed'],
    })
  })
})

