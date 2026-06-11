import { describe, expect, it } from 'vitest'
import {
  canAccessAppPath,
  getSideNavItems,
  getSideNavSections,
  normalizeRole,
} from '@/lib/role-access'

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

describe('getSideNavSections', () => {
  it('groups every role into labelled sections', () => {
    const sections = getSideNavSections('PatientAdvocate')
    expect(sections.length).toBeGreaterThan(1)
    expect(sections.every((s) => s.label && s.items.length > 0)).toBe(true)
    expect(sections[0]?.label).toBe('Overview')
  })

  it('preserves the Comms blueprint workspace items and campus badge', () => {
    const sections = getSideNavSections('Comms')
    const workspace = sections.find((s) => s.label === 'Workspace')
    expect(workspace?.items.map((i) => i.label)).toEqual([
      'Planner',
      'Campus',
      'WhatsApp',
      'CRM',
    ])
    const campus = workspace?.items.find((i) => i.label === 'Campus')
    expect(campus?.badge).toBe('campus')
  })

  it('drops items whose space resolves to invisible', () => {
    // BoardMember has no tasks access — it must never surface in any section.
    const sections = getSideNavSections('BoardMember')
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems.some((i) => i.key === 'tasks')).toBe(false)
  })

  it('exposes User Management for PlatformAdmin under Account', () => {
    const sections = getSideNavSections('PlatformAdmin')
    const account = sections.find((s) => s.label === 'Account')
    expect(account?.items.some((i) => i.key === 'admin')).toBe(true)
  })
})
