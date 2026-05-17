import { describe, expect, it } from 'vitest'
import { canAccessAppPath, getSideNavItems, normalizeRole } from '@/lib/role-access'

describe('normalizeRole', () => {
  it('falls back to PatientAdvocate for unknown values', () => {
    expect(normalizeRole('UnknownRole')).toBe('PatientAdvocate')
    expect(normalizeRole(undefined)).toBe('PatientAdvocate')
    expect(normalizeRole(null)).toBe('PatientAdvocate')
  })

  it('keeps known role values', () => {
    expect(normalizeRole('BoardMember')).toBe('BoardMember')
    expect(normalizeRole('PlatformAdmin')).toBe('PlatformAdmin')
  })
})

describe('canAccessAppPath', () => {
  it('allows public paths', () => {
    expect(canAccessAppPath('PatientAdvocate', '/login')).toBe(true)
    expect(canAccessAppPath('PatientAdvocate', '/')).toBe(true)
  })

  it('blocks BoardMember from bureau and tasks routes', () => {
    expect(canAccessAppPath('BoardMember', '/app/bureau')).toBe(false)
    expect(canAccessAppPath('BoardMember', '/app/tasks')).toBe(false)
  })

  it('allows HubCoordinator to access bureau', () => {
    expect(canAccessAppPath('HubCoordinator', '/app/bureau')).toBe(true)
  })

  it('blocks IndustryPartner from tasks, allows partners', () => {
    expect(canAccessAppPath('IndustryPartner', '/app/tasks')).toBe(false)
    expect(canAccessAppPath('IndustryPartner', '/app/partners')).toBe(true)
  })

  it('allows PatientAdvocate to access stories', () => {
    expect(canAccessAppPath('PatientAdvocate', '/app/stories')).toBe(true)
  })
})

describe('getSideNavItems', () => {
  it('returns board-specific dashboard label', () => {
    const boardItems = getSideNavItems('BoardMember')
    expect(boardItems[0]?.label).toBe('Board Overview')
  })

  it('returns bureau entry for PlatformAdmin', () => {
    const adminItems = getSideNavItems('PlatformAdmin')
    expect(adminItems.some((item) => item.key === 'bureau')).toBe(true)
  })

  it('includes stories entry for PatientAdvocate', () => {
    const items = getSideNavItems('PatientAdvocate')
    expect(items.some((item) => item.key === 'stories')).toBe(true)
  })

  it('includes communications entry only when showComms is enabled for Moderator', () => {
    const hidden = getSideNavItems('Moderator')
    const visible = getSideNavItems('Moderator', { showComms: true })
    expect(hidden.some((item) => item.key === 'comms')).toBe(false)
    expect(visible.some((item) => item.key === 'comms')).toBe(true)
  })
})
