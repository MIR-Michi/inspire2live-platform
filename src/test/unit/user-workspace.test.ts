import { describe, expect, it } from 'vitest'
import { getUserWorkspaceLabel, isCommsUser, normalizeUserType } from '@/lib/user-workspace'

describe('user workspace helpers', () => {
  it('normalizes unknown workspace values to default', () => {
    expect(normalizeUserType('comms')).toBe('comms')
    expect(normalizeUserType('board')).toBe('board')
    expect(normalizeUserType('unexpected')).toBe('default')
    expect(normalizeUserType(null)).toBe('default')
  })

  it('recognizes comms users through user_type and legacy comms_team fallback', () => {
    expect(isCommsUser({ user_type: 'comms', comms_team: false })).toBe(true)
    expect(isCommsUser({ user_type: 'default', comms_team: true })).toBe(true)
    expect(isCommsUser({ user_type: 'default', comms_team: false })).toBe(false)
  })

  it('returns human workspace labels', () => {
    expect(getUserWorkspaceLabel({ user_type: 'comms', comms_team: false })).toBe('Communications')
    expect(getUserWorkspaceLabel({ user_type: 'partner', comms_team: false })).toBe('Partner')
    expect(getUserWorkspaceLabel({ user_type: 'unknown', comms_team: false })).toBe('Platform')
  })
})

