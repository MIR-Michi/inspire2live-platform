import { describe, it, expect } from 'vitest'
import { normalizeRole, isPlatformAdmin, isSuperadmin } from '@/lib/platform-roles'
import { resolveAccessFromRole, ROLE_SPACE_DEFAULTS, PLATFORM_SPACES } from '@/lib/permissions'
import { ROLE_LABELS } from '@/lib/role-access'

describe('Superadmin role', () => {
  it('normalizes canonical and legacy spellings', () => {
    expect(normalizeRole('Superadmin')).toBe('Superadmin')
    expect(normalizeRole('superadmin')).toBe('Superadmin')
    expect(normalizeRole('super_admin')).toBe('Superadmin')
    expect(normalizeRole('super admin')).toBe('Superadmin')
  })

  it('has a label and a defaults entry', () => {
    expect(ROLE_LABELS.Superadmin).toBe('Superadmin')
    expect(ROLE_SPACE_DEFAULTS.Superadmin).toBeDefined()
  })

  describe('isPlatformAdmin — full admin rights for both tiers', () => {
    it('is true for PlatformAdmin and Superadmin', () => {
      expect(isPlatformAdmin('PlatformAdmin')).toBe(true)
      expect(isPlatformAdmin('Superadmin')).toBe(true)
    })
    it('is false for every non-admin role', () => {
      for (const role of ['PatientAdvocate', 'Clinician', 'Researcher', 'Moderator', 'Comms', 'HubCoordinator', 'IndustryPartner', 'BoardMember']) {
        expect(isPlatformAdmin(role), role).toBe(false)
      }
    })
  })

  describe('isSuperadmin — the elevated view-as tier only', () => {
    it('is true only for Superadmin', () => {
      expect(isSuperadmin('Superadmin')).toBe(true)
      expect(isSuperadmin('PlatformAdmin')).toBe(false)
      expect(isSuperadmin('Comms')).toBe(false)
    })
  })

  it('grants Superadmin manage access to every space (identical to PlatformAdmin)', () => {
    for (const space of PLATFORM_SPACES) {
      expect(resolveAccessFromRole('Superadmin', space), space).toBe('manage')
      expect(resolveAccessFromRole('Superadmin', space)).toBe(resolveAccessFromRole('PlatformAdmin', space))
    }
  })
})
