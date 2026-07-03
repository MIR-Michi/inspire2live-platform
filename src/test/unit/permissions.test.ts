/**
 * permissions.test.ts — Phase 5
 *
 * Unit tests for @/lib/permissions covering:
 *   - accessLevelIndex   (ordering helper)
 *   - canAccess          (comparison helper)
 *   - resolveAccessFromRole  (sync, role-defaults matrix)
 *   - ROLE_SPACE_DEFAULTS    (matrix completeness & spot-checks)
 *   - resolveAccess      (async, with mocked Supabase)
 *   - resolveAllSpaces   (async, with mocked Supabase)
 */

import { describe, expect, it } from 'vitest'
import {
  accessLevelIndex,
  canAccess,
  resolveAccessFromRole,
  resolveAccess,
  resolveAllSpaces,
  ROLE_SPACE_DEFAULTS,
  PLATFORM_SPACES,
} from '@/lib/permissions'
import type { AccessLevel } from '@/lib/permissions'

// ─── Minimal Supabase mock ────────────────────────────────────────────────────
//
// Creates a chainable builder whose final await resolves to { data, error }.
// Works for both resolveAccess (.in() terminator) and resolveAllSpaces
// (second .eq() terminator) because every method returns the same thenable.

function makeSupabaseMock(rows: Record<string, unknown>[]) {
  const resolved = { data: rows, error: null }
  const builder: Record<string, unknown> = {
    then: (fn: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (...a: unknown[]) => unknown) => Promise.resolve(resolved).catch(fn),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
  }
  builder.from = () => builder
  builder.select = () => builder
  builder.eq = () => builder
  builder.in = () => builder
  return builder as unknown as import('@supabase/supabase-js').SupabaseClient
}

// ─── accessLevelIndex ─────────────────────────────────────────────────────────

describe('accessLevelIndex', () => {
  it('returns 0 for invisible', () => expect(accessLevelIndex('invisible')).toBe(0))
  it('returns 1 for view',      () => expect(accessLevelIndex('view')).toBe(1))
  it('returns 2 for edit',      () => expect(accessLevelIndex('edit')).toBe(2))
  it('returns 3 for manage',    () => expect(accessLevelIndex('manage')).toBe(3))

  it('invisible < view < edit < manage is strictly increasing', () => {
    const levels: AccessLevel[] = ['invisible', 'view', 'edit', 'manage']
    for (let i = 0; i < levels.length - 1; i++) {
      expect(accessLevelIndex(levels[i])).toBeLessThan(accessLevelIndex(levels[i + 1]))
    }
  })
})

// ─── canAccess ───────────────────────────────────────────────────────────────

describe('canAccess', () => {
  it('exact match is true', () => {
    expect(canAccess('view', 'view')).toBe(true)
    expect(canAccess('manage', 'manage')).toBe(true)
  })

  it('higher level satisfies lower minimum', () => {
    expect(canAccess('edit', 'view')).toBe(true)
    expect(canAccess('manage', 'invisible')).toBe(true)
    expect(canAccess('manage', 'view')).toBe(true)
    expect(canAccess('manage', 'edit')).toBe(true)
  })

  it('lower level does NOT satisfy higher minimum', () => {
    expect(canAccess('view', 'edit')).toBe(false)
    expect(canAccess('invisible', 'view')).toBe(false)
    expect(canAccess('edit', 'manage')).toBe(false)
  })

  it('invisible never satisfies any non-invisible minimum', () => {
    expect(canAccess('invisible', 'view')).toBe(false)
    expect(canAccess('invisible', 'edit')).toBe(false)
    expect(canAccess('invisible', 'manage')).toBe(false)
  })
})

// ─── resolveAccessFromRole ────────────────────────────────────────────────────

describe('resolveAccessFromRole', () => {
  // PlatformAdmin is hardcoded to 'manage' for every space regardless of matrix
  it('PlatformAdmin returns manage for all spaces', () => {
    for (const space of PLATFORM_SPACES) {
      expect(resolveAccessFromRole('PlatformAdmin', space)).toBe('manage')
    }
  })

  // Unknown / null / undefined role falls back to PatientAdvocate defaults
  it('falls back to PatientAdvocate for unknown role', () => {
    expect(resolveAccessFromRole('WeirdRole', 'dashboard')).toBe(
      ROLE_SPACE_DEFAULTS.PatientAdvocate.dashboard
    )
    expect(resolveAccessFromRole(null, 'initiatives')).toBe(
      ROLE_SPACE_DEFAULTS.PatientAdvocate.initiatives
    )
    expect(resolveAccessFromRole(undefined, 'profile')).toBe(
      ROLE_SPACE_DEFAULTS.PatientAdvocate.profile
    )
  })

  // Spot-checks per role from the matrix
  it('PatientAdvocate: view dashboard, edit initiatives, invisible partners', () => {
    expect(resolveAccessFromRole('PatientAdvocate', 'dashboard')).toBe('view')
    expect(resolveAccessFromRole('PatientAdvocate', 'initiatives')).toBe('edit')
    expect(resolveAccessFromRole('PatientAdvocate', 'partners')).toBe('invisible')
    expect(resolveAccessFromRole('PatientAdvocate', 'admin')).toBe('invisible')
  })

  it('HubCoordinator: manage bureau, manage partners, invisible board', () => {
    expect(resolveAccessFromRole('HubCoordinator', 'bureau')).toBe('manage')
    expect(resolveAccessFromRole('HubCoordinator', 'partners')).toBe('manage')
    expect(resolveAccessFromRole('HubCoordinator', 'board')).toBe('invisible')
    expect(resolveAccessFromRole('HubCoordinator', 'admin')).toBe('invisible')
  })

  it('BoardMember: manage board, invisible tasks, invisible bureau', () => {
    expect(resolveAccessFromRole('BoardMember', 'board')).toBe('manage')
    expect(resolveAccessFromRole('BoardMember', 'tasks')).toBe('invisible')
    expect(resolveAccessFromRole('BoardMember', 'bureau')).toBe('invisible')
  })

  it('IndustryPartner: edit partners, invisible tasks, invisible initiatives', () => {
    expect(resolveAccessFromRole('IndustryPartner', 'partners')).toBe('edit')
    expect(resolveAccessFromRole('IndustryPartner', 'tasks')).toBe('invisible')
    expect(resolveAccessFromRole('IndustryPartner', 'initiatives')).toBe('invisible')
  })

  it('Moderator: invisible tasks, invisible comms, invisible admin', () => {
    expect(resolveAccessFromRole('Moderator', 'tasks')).toBe('invisible')
    expect(resolveAccessFromRole('Moderator', 'comms')).toBe('invisible')
    expect(resolveAccessFromRole('Moderator', 'admin')).toBe('invisible')
  })

  it('Clinician: edit initiatives, invisible partners, invisible board', () => {
    expect(resolveAccessFromRole('Clinician', 'initiatives')).toBe('edit')
    expect(resolveAccessFromRole('Clinician', 'partners')).toBe('invisible')
    expect(resolveAccessFromRole('Clinician', 'board')).toBe('invisible')
  })

  it('Researcher: edit tasks, invisible admin', () => {
    expect(resolveAccessFromRole('Researcher', 'tasks')).toBe('edit')
    expect(resolveAccessFromRole('Researcher', 'admin')).toBe('invisible')
  })
})

// ─── ROLE_SPACE_DEFAULTS matrix completeness ──────────────────────────────────

describe('ROLE_SPACE_DEFAULTS matrix completeness', () => {
  const roles = Object.keys(ROLE_SPACE_DEFAULTS) as (keyof typeof ROLE_SPACE_DEFAULTS)[]
  const validLevels = new Set<string>(['invisible', 'view', 'edit', 'manage'])

  it('every role has an entry for every platform space', () => {
    for (const role of roles) {
      for (const space of PLATFORM_SPACES) {
        expect(
          ROLE_SPACE_DEFAULTS[role][space],
          `${role}.${space} must be defined`
        ).toBeDefined()
      }
    }
  })

  it('every entry is a valid AccessLevel value', () => {
    for (const role of roles) {
      for (const space of PLATFORM_SPACES) {
        expect(
          validLevels.has(ROLE_SPACE_DEFAULTS[role][space]),
          `${role}.${space} = "${ROLE_SPACE_DEFAULTS[role][space]}" is not a valid AccessLevel`
        ).toBe(true)
      }
    }
  })

  it('no role has admin access except PlatformAdmin', () => {
    for (const role of roles) {
      if (role === 'PlatformAdmin') continue
      expect(
        ROLE_SPACE_DEFAULTS[role].admin,
        `${role} should NOT have admin access`
      ).toBe('invisible')
    }
  })
})

// ─── resolveAccess (async, mocked Supabase) ──────────────────────────────────

describe('resolveAccess', () => {
  const USER_ID = 'user-abc'

  it('PlatformAdmin always returns manage without DB lookup', async () => {
    // Supabase mock that would return an override — should never be consulted
    const supabase = makeSupabaseMock([
      { space: 'dashboard', access_level: 'invisible', scope_type: 'global', scope_id: null },
    ])
    const result = await resolveAccess(USER_ID, 'PlatformAdmin', 'dashboard', supabase)
    expect(result).toBe('manage')
  })

  it('no override → returns role default', async () => {
    const supabase = makeSupabaseMock([]) // empty override list
    const result = await resolveAccess(USER_ID, 'PatientAdvocate', 'initiatives', supabase)
    expect(result).toBe('edit') // PatientAdvocate default for initiatives
  })

  it('global override → uses override instead of role default', async () => {
    const supabase = makeSupabaseMock([
      { space: 'initiatives', access_level: 'view', scope_type: 'global', scope_id: null },
    ])
    const result = await resolveAccess(USER_ID, 'PatientAdvocate', 'initiatives', supabase)
    expect(result).toBe('view') // overridden down from edit → view
  })

  it('scoped override takes precedence over global override', async () => {
    const CONGRESS_ID = 'congress-123'
    const supabase = makeSupabaseMock([
      // global: view
      { space: 'congress', access_level: 'view', scope_type: 'global', scope_id: null },
      // scoped: manage
      { space: 'congress', access_level: 'manage', scope_type: 'congress', scope_id: CONGRESS_ID },
    ])
    const result = await resolveAccess(
      USER_ID, 'Clinician', 'congress', supabase, 'congress', CONGRESS_ID
    )
    expect(result).toBe('manage') // scoped wins
  })

  it('global override used when no scoped match', async () => {
    const supabase = makeSupabaseMock([
      { space: 'congress', access_level: 'manage', scope_type: 'global', scope_id: null },
      // scoped entry for a DIFFERENT scope_id — should NOT match
      { space: 'congress', access_level: 'invisible', scope_type: 'congress', scope_id: 'other-congress' },
    ])
    const result = await resolveAccess(
      USER_ID, 'Clinician', 'congress', supabase, 'congress', 'congress-123'
    )
    expect(result).toBe('manage') // global override wins since scoped doesn't match our id
  })

  it('unknown role with no override falls back to PatientAdvocate default', async () => {
    const supabase = makeSupabaseMock([])
    const result = await resolveAccess(USER_ID, 'MadeUpRole', 'dashboard', supabase)
    expect(result).toBe(ROLE_SPACE_DEFAULTS.PatientAdvocate.dashboard)
  })
})

// ─── resolveAllSpaces (async, mocked Supabase) ───────────────────────────────

describe('resolveAllSpaces', () => {
  const USER_ID = 'user-abc'

  it('PlatformAdmin returns manage for every space (no DB needed)', async () => {
    const supabase = makeSupabaseMock([]) // empty — should never matter
    const spaces = await resolveAllSpaces(USER_ID, 'PlatformAdmin', supabase)
    for (const space of PLATFORM_SPACES) {
      expect(spaces[space], `${space} should be manage`).toBe('manage')
    }
  })

  it('returns role defaults when no overrides exist', async () => {
    const supabase = makeSupabaseMock([])
    const spaces = await resolveAllSpaces(USER_ID, 'BoardMember', supabase)
    expect(spaces.board).toBe('manage')
    expect(spaces.tasks).toBe('invisible')
    expect(spaces.bureau).toBe('invisible')
    expect(spaces.admin).toBe('invisible')
  })

  it('applies global override for a specific space', async () => {
    const supabase = makeSupabaseMock([
      // Grant HubCoordinator-level access to board (normally invisible)
      { space: 'board', access_level: 'view', scope_type: 'global', scope_id: null },
    ])
    const spaces = await resolveAllSpaces(USER_ID, 'PatientAdvocate', supabase)
    expect(spaces.board).toBe('view')  // overridden
    // Other spaces should still use PatientAdvocate defaults
    expect(spaces.dashboard).toBe(ROLE_SPACE_DEFAULTS.PatientAdvocate.dashboard)
    expect(spaces.initiatives).toBe(ROLE_SPACE_DEFAULTS.PatientAdvocate.initiatives)
  })

  it('result covers all PLATFORM_SPACES', async () => {
    const supabase = makeSupabaseMock([])
    const spaces = await resolveAllSpaces(USER_ID, 'Researcher', supabase)
    for (const space of PLATFORM_SPACES) {
      expect(spaces[space], `${space} must be present`).toBeDefined()
    }
  })

  it('multiple overrides applied correctly', async () => {
    const supabase = makeSupabaseMock([
      { space: 'bureau', access_level: 'manage', scope_type: 'global', scope_id: null },
      { space: 'board',  access_level: 'view',   scope_type: 'global', scope_id: null },
    ])
    const spaces = await resolveAllSpaces(USER_ID, 'Clinician', supabase)
    expect(spaces.bureau).toBe('manage') // overridden (default: invisible)
    expect(spaces.board).toBe('view')    // overridden (default: invisible)
    expect(spaces.congress).toBe(ROLE_SPACE_DEFAULTS.Clinician.congress) // unchanged
  })
})
