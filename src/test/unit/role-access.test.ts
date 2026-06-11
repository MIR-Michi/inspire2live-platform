import { describe, expect, it } from 'vitest'
import { canAccessAppPath, getSideNavSections, normalizeRole } from '@/lib/role-access'
import { ROLE_SPACE_DEFAULTS } from '@/lib/permissions'
import type { PlatformRole } from '@/lib/platform-roles'

// The unified nav is permission-driven: it filters the single MASTER_NAV tree by a
// role's resolved space access. Tests feed the role-default matrix as the spaces map
// (server adds DB overrides on top in production).
const spacesFor = (role: PlatformRole) => ROLE_SPACE_DEFAULTS[role]
const labelsIn = (role: PlatformRole) =>
  getSideNavSections(role, spacesFor(role)).flatMap((s) => s.items.map((i) => i.label))

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

describe('getSideNavSections — Comms blueprint + permission-driven tree', () => {
  it('starts with Overview/Dashboard for every role', () => {
    const sections = getSideNavSections('PatientAdvocate', spacesFor('PatientAdvocate'))
    expect(sections.length).toBeGreaterThan(1)
    expect(sections.every((s) => s.label && s.items.length > 0)).toBe(true)
    expect(sections[0]?.label).toBe('Overview')
    expect(sections[0]?.items[0]?.href).toBe('/app/dashboard')
  })

  it('gives Comms its exact curated blueprint — not a permission-expanded menu', () => {
    const sections = getSideNavSections('Comms', spacesFor('Comms'))
    // Comms shows ONLY its blueprint: comms workspace items + congress + library.
    expect(labelsIn('Comms')).toEqual([
      'Dashboard',
      'Planner',
      'Campus',
      'WhatsApp',
      'CRM',
      'Annual Congress',
      'Podcast',
      'All events',
      'Library',
    ])
    // Even though Comms *can* access these spaces, they must NOT clutter its menu.
    expect(labelsIn('Comms')).not.toContain('Initiatives')
    expect(labelsIn('Comms')).not.toContain('Network')
    expect(labelsIn('Comms')).not.toContain('Stories')
    expect(labelsIn('Comms')).not.toContain('Resources')
    // Comms dashboard is its own toggle page, not the shared one.
    const dashboard = sections.flatMap((s) => s.items).find((i) => i.id === 'comms-dashboard')
    expect(dashboard?.href).toBe('/app/comms/dashboard')
    const campus = sections.flatMap((s) => s.items).find((i) => i.label === 'Campus')
    expect(campus?.badge).toBe('campus')
  })

  it('never surfaces Profile, Tasks, Bureau, or Partners as nav items', () => {
    for (const role of Object.keys(ROLE_SPACE_DEFAULTS) as PlatformRole[]) {
      const labels = labelsIn(role)
      expect(labels).not.toContain('Profile')
      expect(labels).not.toContain('Tasks')
      expect(labels).not.toContain('My Tasks')
      expect(labels).not.toContain('Bureau')
      expect(labels).not.toContain('Partners')
    }
  })

  it('hides comms items from roles without comms access (Moderator)', () => {
    const labels = labelsIn('Moderator')
    expect(labels).not.toContain('Planner')
    expect(labels).not.toContain('CRM')
    // but shared spaces it can view are present
    expect(labels).toContain('Stories')
    expect(labels).toContain('Initiatives')
  })

  it('shows the full extended tree for PlatformAdmin, incl. User Management', () => {
    const sections = getSideNavSections('PlatformAdmin', spacesFor('PlatformAdmin'))
    const account = sections.find((s) => s.label === 'Account')
    expect(account?.items.some((i) => i.id === 'admin')).toBe(true)
    const labels = sections.flatMap((s) => s.items.map((i) => i.label))
    expect(labels).toEqual(expect.arrayContaining(['Planner', 'CRM', 'Board', 'User Management']))
  })

  it('reveals comms items to a NON-comms role when a space override grants access', () => {
    const base = spacesFor('PatientAdvocate')
    expect(labelsIn('PatientAdvocate')).not.toContain('Planner')
    const withComms = { ...base, comms: 'view' as const }
    const labels = getSideNavSections('PatientAdvocate', withComms).flatMap((s) =>
      s.items.map((i) => i.label),
    )
    expect(labels).toContain('Planner')
  })

  it('uses the comms dashboard for Comms and the shared dashboard for everyone else', () => {
    for (const role of Object.keys(ROLE_SPACE_DEFAULTS) as PlatformRole[]) {
      const items = getSideNavSections(role, spacesFor(role)).flatMap((s) => s.items)
      const dashboard = items.find((i) => i.id === 'dashboard' || i.id === 'comms-dashboard')
      const congress = items.find((i) => i.id === 'congress')
      expect(dashboard?.href).toBe(role === 'Comms' ? '/app/comms/dashboard' : '/app/dashboard')
      if (congress) expect(congress.href).toBe('/app/congress')
    }
  })
})
