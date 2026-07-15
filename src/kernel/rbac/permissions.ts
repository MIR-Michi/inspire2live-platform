/**
 * permissions.ts — Unified Permission Resolver (Phase 2)
 *
 * THREE exported APIs:
 *
 * 1. resolveAccessFromRole(role, space)
 *    Pure synchronous function. Uses role-defaults matrix only.
 *    Used by: middleware, client components, any sync context.
 *
 * 2. resolveAccess(userId, role, space, supabase, scopeType?, scopeId?)
 *    Async. Checks DB overrides first, falls back to role defaults.
 *    Used by: Server Components, Server Actions.
 *
 * 3. canAccess(level, minimum)
 *    Helper: returns true if level >= minimum.
 *    e.g. canAccess('edit', 'view') === true
 *
 * Access level order: invisible < view < edit < manage
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformRole } from './platform-roles'
import { normalizeRole } from './platform-roles'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccessLevel = 'invisible' | 'view' | 'edit' | 'manage'

export type PlatformSpace =
  | 'dashboard'
  | 'comms'
  | 'initiatives'
  | 'tasks'
  | 'congress'
  | 'resources'
  | 'partners'
  | 'network'
  | 'board'
  | 'bureau'
  | 'notifications'
  | 'profile'
  | 'admin'

export type ScopeType = 'global' | 'congress' | 'initiative'

export const PLATFORM_SPACES: PlatformSpace[] = [
  'dashboard',
  'comms',
  'initiatives',
  'tasks',
  'congress',
  'resources',
  'partners',
  'network',
  'board',
  'bureau',
  'notifications',
  'profile',
  'admin',
]

// ─── Access level ordering ────────────────────────────────────────────────────

const ACCESS_ORDER: AccessLevel[] = ['invisible', 'view', 'edit', 'manage']

export function accessLevelIndex(level: AccessLevel): number {
  return ACCESS_ORDER.indexOf(level)
}

/**
 * Returns true if `level` is at least as permissive as `minimum`.
 * canAccess('edit', 'view') === true
 * canAccess('view', 'edit') === false
 */
export function canAccess(level: AccessLevel, minimum: AccessLevel): boolean {
  return accessLevelIndex(level) >= accessLevelIndex(minimum)
}

// ─── Role × Space defaults matrix ────────────────────────────────────────────
//
// This is the authoritative default access matrix.
// PlatformAdmin gets 'manage' everywhere (hard-coded, never depends on this table).
// Overrides are stored in user_space_permissions (DB).
//
// Format: ROLE_SPACE_DEFAULTS[role][space] = AccessLevel

type SpaceDefaults = Record<PlatformSpace, AccessLevel>

export const ROLE_SPACE_DEFAULTS: Record<PlatformRole, SpaceDefaults> = {
  PatientAdvocate: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'edit',
    tasks:         'edit',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  Clinician: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'edit',
    tasks:         'edit',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  Researcher: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'edit',
    tasks:         'edit',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  Moderator: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'view',
    tasks:         'invisible',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  Comms: {
    dashboard:     'view',
    comms:         'edit',
    initiatives:   'view',
    tasks:         'invisible',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  HubCoordinator: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'manage',
    tasks:         'manage',
    congress:      'view',
    resources:     'manage',
    partners:      'manage',
    network:       'view',
    board:         'invisible',
    bureau:        'manage',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  IndustryPartner: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'invisible',
    tasks:         'invisible',
    congress:      'view',
    resources:     'view',
    partners:      'edit',
    network:       'view',
    board:         'invisible',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  BoardMember: {
    dashboard:     'view',
    comms:         'invisible',
    initiatives:   'view',
    tasks:         'invisible',
    congress:      'view',
    resources:     'view',
    partners:      'invisible',
    network:       'view',
    board:         'manage',
    bureau:        'invisible',
    notifications: 'view',
    profile:       'edit',
    admin:         'invisible',
  },
  PlatformAdmin: {
    dashboard:     'manage',
    comms:         'manage',
    initiatives:   'manage',
    tasks:         'manage',
    congress:      'manage',
    resources:     'manage',
    partners:      'manage',
    network:       'manage',
    board:         'manage',
    bureau:        'manage',
    notifications: 'manage',
    profile:       'manage',
    admin:         'manage',
  },
  // Superadmin shares every permission with PlatformAdmin (manage everywhere).
  // The only difference — the ability to view-as another role/user — is an
  // app-layer capability gated by isSuperadmin(), not a space in this matrix.
  Superadmin: {
    dashboard:     'manage',
    comms:         'manage',
    initiatives:   'manage',
    tasks:         'manage',
    congress:      'manage',
    resources:     'manage',
    partners:      'manage',
    network:       'manage',
    board:         'manage',
    bureau:        'manage',
    notifications: 'manage',
    profile:       'manage',
    admin:         'manage',
  },
}

// ─── Sync resolver (pure, no DB) ──────────────────────────────────────────────

/**
 * Returns the default access level for a given role + space.
 * PlatformAdmin always returns 'manage'.
 * Safe to call in middleware, client components, or any sync context.
 */
export function resolveAccessFromRole(
  role: string | null | undefined,
  space: PlatformSpace
): AccessLevel {
  const normalized = normalizeRole(role)
  // PlatformAdmin is always manage — no override can reduce this
  if (normalized === 'PlatformAdmin' || normalized === 'Superadmin') return 'manage'
  return ROLE_SPACE_DEFAULTS[normalized][space] ?? 'invisible'
}

// ─── Async resolver (DB overrides + role defaults) ────────────────────────────

/**
 * Returns the effective access level for a user on a space.
 *
 * Precedence:
 * 1. PlatformAdmin → always 'manage' (no DB lookup needed)
 * 2. Explicit user_space_permissions override (global scope checked first,
 *    then scoped if scopeType + scopeId are provided)
 * 3. Role-based default from ROLE_SPACE_DEFAULTS
 *
 * @param userId   - The user's UUID
 * @param role     - The user's platform role (from profiles.role)
 * @param space    - The platform space to check
 * @param supabase - A Supabase server client instance
 * @param scopeType - Optional scope ('congress' | 'initiative')
 * @param scopeId   - Optional scope entity UUID
 */
export async function resolveAccess(
  userId: string,
  role: string | null | undefined,
  space: PlatformSpace,
  supabase: SupabaseClient,
  scopeType?: ScopeType,
  scopeId?: string
): Promise<AccessLevel> {
  const normalized = normalizeRole(role)

  // PlatformAdmin always has full manage — skip DB lookup
  if (normalized === 'PlatformAdmin' || normalized === 'Superadmin') return 'manage'

  // Look up overrides: fetch global + scoped in one query
  const { data: overrides } = await supabase
    .from('user_space_permissions')
    .select('access_level, scope_type, scope_id')
    .eq('user_id', userId)
    .eq('space', space)
    .in('scope_type', scopeType ? ['global', scopeType] : ['global'])

  if (overrides && overrides.length > 0) {
    // If we have a scoped override matching scopeId, prefer it over global
    if (scopeType && scopeId) {
      const scoped = overrides.find(
        (o) => o.scope_type === scopeType && o.scope_id === scopeId
      )
      if (scoped) return scoped.access_level as AccessLevel
    }
    // Fall back to global override
    const global = overrides.find((o) => o.scope_type === 'global')
    if (global) return global.access_level as AccessLevel
  }

  // No override — use role default
  return ROLE_SPACE_DEFAULTS[normalized][space] ?? 'invisible'
}

/**
 * Returns all visible space access levels for a user in one DB round-trip.
 * Useful for building nav menus in Server Components.
 */
export async function resolveAllSpaces(
  userId: string,
  role: string | null | undefined,
  supabase: SupabaseClient
): Promise<Record<PlatformSpace, AccessLevel>> {
  const normalized = normalizeRole(role)

  // PlatformAdmin: everything is manage
  if (normalized === 'PlatformAdmin' || normalized === 'Superadmin') {
    return Object.fromEntries(
      PLATFORM_SPACES.map((s) => [s, 'manage' as AccessLevel])
    ) as Record<PlatformSpace, AccessLevel>
  }

  // Fetch all global overrides for this user in one query
  const { data: overrides } = await supabase
    .from('user_space_permissions')
    .select('space, access_level')
    .eq('user_id', userId)
    .eq('scope_type', 'global')

  const overrideMap = new Map<string, AccessLevel>(
    (overrides ?? []).map((o) => [o.space, o.access_level as AccessLevel])
  )

  return Object.fromEntries(
    PLATFORM_SPACES.map((space) => [
      space,
      overrideMap.get(space) ?? ROLE_SPACE_DEFAULTS[normalized][space] ?? 'invisible',
    ])
  ) as Record<PlatformSpace, AccessLevel>
}
