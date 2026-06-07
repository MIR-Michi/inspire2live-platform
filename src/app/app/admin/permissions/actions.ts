'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/role-access'
import { PLATFORM_SPACES } from '@/lib/permissions'
import type { AccessLevel, PlatformSpace, ScopeType } from '@/lib/permissions'
import type { PlatformRole } from '@/lib/platform-roles'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionOverrideInput = {
  targetUserId: string
  space: PlatformSpace
  accessLevel: AccessLevel
  scopeType?: ScopeType
  scopeId?: string
}

export type SetRoleDefaultInput = {
  role: PlatformRole
  space: PlatformSpace
  accessLevel: AccessLevel
}

const VALID_LEVELS = new Set<AccessLevel>(['invisible', 'view', 'edit', 'manage'])
const VALID_SPACES = new Set<PlatformSpace>(PLATFORM_SPACES)
const VALID_SCOPES = new Set<ScopeType>(['global', 'congress', 'initiative'])

const VALID_ROLES = new Set<PlatformRole>([
  'PatientAdvocate',
  'Clinician',
  'Researcher',
  'Moderator',
  'Comms',
  'HubCoordinator',
  'IndustryPartner',
  'BoardMember',
  'PlatformAdmin',
])

function validateScope(scopeType: ScopeType, scopeId?: string) {
  if (!VALID_SCOPES.has(scopeType)) return 'Invalid scope type value'

  if (scopeType === 'global' && scopeId) {
    return 'scopeId must be empty when scopeType is global'
  }

  if (scopeType !== 'global' && !scopeId) {
    return 'scopeId is required for scoped permissions'
  }

  return null
}

function withScopeIdFilter<TQuery extends { eq: (column: 'scope_id', value: string) => TQuery; is: (column: 'scope_id', value: null) => TQuery }>(
  query: TQuery,
  scopeId?: string
) {
  return scopeId ? query.eq('scope_id', scopeId) : query.is('scope_id', null)
}

// ─── Guard: caller must be PlatformAdmin ─────────────────────────────────────

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', adminId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const normalized = normalizeRole(profile?.role)
  if (normalized !== 'PlatformAdmin') {
    return { error: 'Forbidden: PlatformAdmin only', adminId: null }
  }

  return { error: null, adminId: user.id }
}

// ─── setPermissionOverride ────────────────────────────────────────────────────

/**
 * Upserts a permission override for a user on a space.
 * Also appends an audit log entry.
 */
export async function setPermissionOverride(
  input: PermissionOverrideInput
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { error: authError ?? 'Unauthorized' }

  const { targetUserId, space, accessLevel, scopeType = 'global', scopeId } = input

  if (!targetUserId) return { error: 'Invalid target user id' }
  if (!VALID_SPACES.has(space)) return { error: 'Invalid space value' }
  if (!VALID_LEVELS.has(accessLevel)) return { error: 'Invalid access level value' }

  const scopeError = validateScope(scopeType, scopeId)
  if (scopeError) return { error: scopeError }

  // Read current value for audit log
  const existingQuery = supabase
    .from('user_space_permissions')
    .select('access_level')
    .eq('user_id', targetUserId)
    .eq('space', space)
    .eq('scope_type', scopeType)

  const { data: existing } = await withScopeIdFilter(existingQuery, scopeId).maybeSingle()

  // Upsert the override
  const { error: upsertError } = await supabase
    .from('user_space_permissions')
    .upsert(
      {
        user_id: targetUserId,
        space,
        access_level: accessLevel,
        scope_type: scopeType,
        scope_id: scopeId ?? null,
        granted_by: adminId,
      },
      { onConflict: 'user_id,space,scope_type,scope_id', ignoreDuplicates: false }
    )

  if (upsertError) return { error: upsertError.message }

  // Append audit log
  await supabase
    .from('permission_audit_log')
    .insert({
      target_user_id: targetUserId,
      changed_by: adminId,
      change_type: 'permission_override',
      previous_value: existing ? { space, access_level: existing.access_level } : null,
      new_value: { space, access_level: accessLevel, scope_type: scopeType },
    })

  revalidatePath('/app/admin/permissions')
  return { error: null }
}

// ─── removePermissionOverride ─────────────────────────────────────────────────

/**
 * Removes a specific permission override (restores role-based default).
 * Also appends an audit log entry.
 */
export async function removePermissionOverride(
  targetUserId: string,
  space: PlatformSpace,
  scopeType: ScopeType = 'global',
  scopeId?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { error: authError ?? 'Unauthorized' }

  if (!targetUserId) return { error: 'Invalid target user id' }
  if (!VALID_SPACES.has(space)) return { error: 'Invalid space value' }

  const scopeError = validateScope(scopeType, scopeId)
  if (scopeError) return { error: scopeError }

  // Read current value for audit log
  const existingQuery = supabase
    .from('user_space_permissions')
    .select('access_level')
    .eq('user_id', targetUserId)
    .eq('space', space)
    .eq('scope_type', scopeType)

  const { data: existing } = await withScopeIdFilter(existingQuery, scopeId).maybeSingle()

  const deleteQuery = supabase
    .from('user_space_permissions')
    .delete()
    .eq('user_id', targetUserId)
    .eq('space', space)
    .eq('scope_type', scopeType)

  const { error: deleteError } = await withScopeIdFilter(deleteQuery, scopeId)

  if (deleteError) return { error: deleteError.message }

  // Append audit log
  await supabase
    .from('permission_audit_log')
    .insert({
      target_user_id: targetUserId,
      changed_by: adminId,
      change_type: 'permission_override',
      previous_value: existing ? { space, access_level: existing.access_level } : null,
      new_value: { space, access_level: 'default (removed override)', scope_type: scopeType },
    })

  revalidatePath('/app/admin/permissions')
  return { error: null }
}

// ─── setRoleDefaultOverride (Phase 2) ─────────────────────────────────────────

/**
 * Upserts a role default override entry for platform scope.
 * This does not remove static defaults — it stores override rows only.
 */
export async function setRoleDefaultOverride(
  input: SetRoleDefaultInput
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { error: authError ?? 'Unauthorized' }

  const { role, space, accessLevel } = input

  if (!VALID_ROLES.has(role)) return { error: 'Invalid role value' }
  if (!VALID_SPACES.has(space)) return { error: 'Invalid space value' }
  if (!VALID_LEVELS.has(accessLevel)) return { error: 'Invalid access level value' }

  const { error: upsertError } = await supabase
    .from('role_space_default_overrides')
    .upsert(
      { role, space, access_level: accessLevel, updated_by: adminId },
      { onConflict: 'role,space', ignoreDuplicates: false }
    )

  if (upsertError) {
    if ((upsertError as { code?: string }).code === '42P01') {
      return { error: 'role defaults table missing (migration 00023 required)' }
    }
    return { error: upsertError.message }
  }

  revalidatePath('/app/admin/permissions')
  return { error: null }
}
