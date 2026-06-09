'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/role-access'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'inactive'

const VALID_STATUSES = new Set<AccountStatus>(['active', 'inactive'])

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

// ─── setUserStatus ────────────────────────────────────────────────────────────

/**
 * Activates or deactivates a user account. Deactivated users are blocked from
 * the app in middleware. Records an audit-log entry.
 */
export async function setUserStatus(
  targetUserId: string,
  status: AccountStatus
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { error: authError ?? 'Unauthorized' }

  if (!targetUserId) return { error: 'Invalid target user id' }
  if (!VALID_STATUSES.has(status)) return { error: 'Invalid status value' }
  if (targetUserId === adminId) return { error: 'You cannot change your own account status' }

  // Read current value for the audit log
  const { data: existing } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', targetUserId)
    .maybeSingle()

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', targetUserId)

  if (updateError) return { error: updateError.message }

  await supabase
    .from('permission_audit_log')
    .insert({
      target_user_id: targetUserId,
      changed_by: adminId,
      change_type: 'status_change',
      previous_value: existing?.status ? { status: existing.status } : null,
      new_value: { status },
    })

  revalidatePath('/app/admin/users')
  return { error: null }
}

// ─── deleteUser ────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a user. Removes the auth.users record (which cascades to
 * the profile and owned rows). Records an audit-log entry before deletion.
 * Requires the service-role key.
 */
export async function deleteUser(
  targetUserId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { error: authError ?? 'Unauthorized' }

  if (!targetUserId) return { error: 'Invalid target user id' }
  if (targetUserId === adminId) return { error: 'You cannot delete your own account' }

  // Snapshot the profile for the audit log before it is cascade-deleted
  const { data: existing } = await supabase
    .from('profiles')
    .select('name, email, role')
    .eq('id', targetUserId)
    .maybeSingle()

  // Append the audit entry first — the profile FK cascades away on delete, but
  // permission_audit_log.target_user_id has no FK so the record survives.
  await supabase
    .from('permission_audit_log')
    .insert({
      target_user_id: targetUserId,
      changed_by: adminId,
      change_type: 'user_deleted',
      previous_value: existing
        ? { name: existing.name, email: existing.email, role: existing.role }
        : null,
      new_value: null,
    })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Server is not configured for user deletion (missing service role key)' }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId)
  if (deleteError) return { error: deleteError.message }

  revalidatePath('/app/admin/users')
  return { error: null }
}
