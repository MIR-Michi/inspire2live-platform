'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/role-access'
import { DEMO_EMAILS } from './constants'

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

// ─── Shared helpers (not exported — only async functions may be exported from
//     a 'use server' module, but internal helpers can be any shape) ───────────

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Removes one account. Prefers the Auth Admin API (which cascades profiles +
 * owned rows). If the auth.users record is missing/malformed — common for
 * accounts seeded directly into public.profiles, which surface as
 * "User not found" — it falls back to deleting the profile row directly.
 */
async function removeAccount(admin: AdminClient, id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.auth.admin.deleteUser(id)
  if (!error) return { ok: true }

  const msg = (error.message || '').toLowerCase()
  const isMissing =
    msg.includes('not found') ||
    msg.includes('user_not_found') ||
    (typeof (error as { status?: number }).status === 'number' && (error as { status?: number }).status === 404)

  if (!isMissing) return { ok: false, error: error.message }

  // Orphan profile: no usable auth.users row. Delete the profile directly.
  const { error: profileError } = await admin.from('profiles').delete().eq('id', id)
  if (profileError) return { ok: false, error: profileError.message }
  return { ok: true }
}

/**
 * Cleans up all content owned by the given users in FK dependency order so the
 * accounts (or their profiles) can be removed without RESTRICT violations.
 * Returns any non-ignorable error messages encountered.
 */
async function cleanupUserContent(admin: AdminClient, targetIds: string[]): Promise<string[]> {
  const errors: string[] = []
  if (!targetIds.length) return errors

  // Wrap each operation: swallow "relation does not exist" errors for optional tables.
  // PromiseLike<unknown> accepts PostgrestFilterBuilder (a thenable, not a full Promise).
  const tryOp = async (desc: string, fn: () => PromiseLike<unknown>) => {
    try {
      const result = await fn() as { error?: { message?: string } | null }
      const msg = result?.error?.message
      if (msg && !msg.includes('does not exist') && !msg.includes('42P01')) {
        errors.push(`${desc}: ${msg}`)
      }
    } catch {
      // table not present in this environment — skip
    }
  }

  // Capture parent entity IDs before we start deleting
  const initIds = (await admin.from('initiatives').select('id').in('lead_id', targetIds))
    .data?.map(r => r.id) ?? []
  const hubIds = (await admin.from('hubs').select('id').in('coordinator_id', targetIds))
    .data?.map(r => r.id) ?? []

  // ── 1. NULL nullable references ──────────────────────────────────────────
  await tryOp('content_calendar.author_id',
    () => admin.from('content_calendar').update({ author_id: null }).in('author_id', targetIds))
  await tryOp('campus_sessions.created_by',
    () => admin.from('campus_sessions').update({ created_by: null }).in('created_by', targetIds))
  await tryOp('campus_members.platform_profile_id',
    () => admin.from('campus_members').update({ platform_profile_id: null }).in('platform_profile_id', targetIds))
  await tryOp('intake_items.reviewed_by',
    () => admin.from('intake_items').update({ reviewed_by: null }).in('reviewed_by', targetIds))
  await tryOp('intake_classification_corrections.corrected_by',
    () => admin.from('intake_classification_corrections').update({ corrected_by: null }).in('corrected_by', targetIds))
  await tryOp('intake_classifier_rules.created_by',
    () => admin.from('intake_classifier_rules').update({ created_by: null }).in('created_by', targetIds))
  await tryOp('intake_classifier_training_examples.created_by',
    () => admin.from('intake_classifier_training_examples').update({ created_by: null }).in('created_by', targetIds))
  await tryOp('media_assets.contributed_by',
    () => admin.from('media_assets').update({ contributed_by: null }).in('contributed_by', targetIds))
  await tryOp('media_recovery_requests.requested_by',
    () => admin.from('media_recovery_requests').update({ requested_by: null }).in('requested_by', targetIds))
  await tryOp('congress_sessions.session_lead_id',
    () => admin.from('congress_sessions').update({ session_lead_id: null }).in('session_lead_id', targetIds))
  await tryOp('congress_sessions.note_taker_id',
    () => admin.from('congress_sessions').update({ note_taker_id: null }).in('note_taker_id', targetIds))
  await tryOp('congress_decisions.owner_id',
    () => admin.from('congress_decisions').update({ owner_id: null }).in('owner_id', targetIds))
  await tryOp('discussions.decision_made_by',
    () => admin.from('discussions').update({ decision_made_by: null }).in('decision_made_by', targetIds))
  await tryOp('partner_engagements.reviewer_id',
    () => admin.from('partner_engagements').update({ reviewer_id: null }).in('reviewer_id', targetIds))

  // ── 2. Delete owned content, children before parents ─────────────────────

  // Permission audit log
  await tryOp('permission_audit_log (changed_by)',
    () => admin.from('permission_audit_log').delete().in('changed_by', targetIds))
  await tryOp('permission_audit_log (target_user_id)',
    () => admin.from('permission_audit_log').delete().in('target_user_id', targetIds))

  // Partners
  const engagementIds = (await admin.from('partner_engagements').select('id').in('partner_id', targetIds))
    .data?.map(r => r.id) ?? []
  if (engagementIds.length) {
    await tryOp('partner_audit_entries (engagement)',
      () => admin.from('partner_audit_entries').delete().in('engagement_id', engagementIds))
  }
  await tryOp('partner_audit_entries (actor)',
    () => admin.from('partner_audit_entries').delete().in('actor_id', targetIds))
  await tryOp('partner_engagements',
    () => admin.from('partner_engagements').delete().in('partner_id', targetIds))

  // Congress topics + votes
  const topicIds = (await admin.from('congress_topics').select('id').in('submitter_id', targetIds))
    .data?.map(r => r.id) ?? []
  if (topicIds.length) {
    await tryOp('topic_votes',
      () => admin.from('topic_votes').delete().in('topic_id', topicIds))
  }
  await tryOp('congress_topics',
    () => admin.from('congress_topics').delete().in('submitter_id', targetIds))

  // Tasks (collect IDs so we can delete their comments too)
  const taskIdsByUser = (await admin.from('tasks').select('id').in('assignee_id', targetIds))
    .data?.map(r => r.id) ?? []
  const taskIdsByReporter = (await admin.from('tasks').select('id').in('reporter_id', targetIds))
    .data?.map(r => r.id) ?? []
  const taskIdsByInit = initIds.length
    ? (await admin.from('tasks').select('id').in('initiative_id', initIds)).data?.map(r => r.id) ?? []
    : []
  const allTaskIds = [...new Set([...taskIdsByUser, ...taskIdsByReporter, ...taskIdsByInit])]
  if (allTaskIds.length) {
    await tryOp('task_comments (task)',
      () => admin.from('task_comments').delete().in('task_id', allTaskIds))
  }
  await tryOp('task_comments (author)',
    () => admin.from('task_comments').delete().in('author_id', targetIds))
  await tryOp('tasks (assignee)', () => admin.from('tasks').delete().in('assignee_id', targetIds))
  await tryOp('tasks (reporter)', () => admin.from('tasks').delete().in('reporter_id', targetIds))
  if (initIds.length) {
    await tryOp('tasks (initiative)', () => admin.from('tasks').delete().in('initiative_id', initIds))
  }

  // Discussions (replies first)
  const discIdsByUser = (await admin.from('discussions').select('id').in('author_id', targetIds))
    .data?.map(r => r.id) ?? []
  const discIdsByInit = initIds.length
    ? (await admin.from('discussions').select('id').in('initiative_id', initIds)).data?.map(r => r.id) ?? []
    : []
  const allDiscIds = [...new Set([...discIdsByUser, ...discIdsByInit])]
  if (allDiscIds.length) {
    await tryOp('discussion_replies (discussion)',
      () => admin.from('discussion_replies').delete().in('discussion_id', allDiscIds))
  }
  await tryOp('discussion_replies (author)',
    () => admin.from('discussion_replies').delete().in('author_id', targetIds))
  await tryOp('discussions (author)', () => admin.from('discussions').delete().in('author_id', targetIds))
  if (initIds.length) {
    await tryOp('discussions (initiative)', () => admin.from('discussions').delete().in('initiative_id', initIds))
  }

  // Initiative-scoped content
  await tryOp('resources (uploader)',
    () => admin.from('resources').delete().in('uploaded_by_id', targetIds))
  if (initIds.length) {
    await tryOp('resources (initiative)',
      () => admin.from('resources').delete().in('initiative_id', initIds))
    await tryOp('milestones',
      () => admin.from('milestones').delete().in('initiative_id', initIds))
    await tryOp('initiative_members (initiative)',
      () => admin.from('initiative_members').delete().in('initiative_id', initIds))
    await tryOp('activity_log (initiative)',
      () => admin.from('activity_log').delete().in('initiative_id', initIds))
  }
  await tryOp('initiative_members (user)',
    () => admin.from('initiative_members').delete().in('user_id', targetIds))
  await tryOp('activity_log (actor)',
    () => admin.from('activity_log').delete().in('actor_id', targetIds))

  // Hubs subtree
  await tryOp('hub_members (user)',
    () => admin.from('hub_members').delete().in('user_id', targetIds))
  if (hubIds.length) {
    await tryOp('hub_members (hub)',
      () => admin.from('hub_members').delete().in('hub_id', hubIds))
    await tryOp('hub_initiatives (hub)',
      () => admin.from('hub_initiatives').delete().in('hub_id', hubIds))
  }
  if (initIds.length) {
    await tryOp('hub_initiatives (initiative)',
      () => admin.from('hub_initiatives').delete().in('initiative_id', initIds))
  }
  await tryOp('hubs', () => admin.from('hubs').delete().in('coordinator_id', targetIds))

  // Initiatives last
  await tryOp('initiatives', () => admin.from('initiatives').delete().in('lead_id', targetIds))

  return errors
}

// ─── deleteUser ────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a single user. Cleans up owned content, then removes the
 * account via the Auth Admin API — falling back to a direct profile delete when
 * the auth.users record is missing. Records an audit-log entry before deletion.
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

  // Snapshot the profile for the audit log before it is deleted
  const { data: existing } = await supabase
    .from('profiles')
    .select('name, email, role')
    .eq('id', targetUserId)
    .maybeSingle()

  // Append the audit entry first — permission_audit_log.target_user_id has no FK
  // so the record survives the deletion.
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

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Server is not configured for user deletion (missing service role key)' }
  }

  // Clear owned content first so a direct profile delete won't hit RESTRICT FKs.
  await cleanupUserContent(admin, [targetUserId])

  const { ok, error } = await removeAccount(admin, targetUserId)
  if (!ok) return { error: error ?? 'Failed to delete user' }

  revalidatePath('/app/admin/users')
  return { error: null }
}

// ─── purgeDemo ────────────────────────────────────────────────────────────────

export type PurgeDemoResult = {
  deleted: number
  skipped: number
  errors: string[]
}

/**
 * Bulk-deletes all demo / seed accounts listed in DEMO_EMAILS.
 * Cleans up owned content in FK dependency order before removing each account
 * (Auth Admin API, falling back to a direct profile delete for orphan profiles).
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function purgeDemo(): Promise<PurgeDemoResult> {
  const supabase = await createClient()
  const { error: authError, adminId } = await requireAdmin(supabase)
  if (authError || !adminId) return { deleted: 0, skipped: 0, errors: [authError ?? 'Unauthorized'] }

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return {
      deleted: 0,
      skipped: 0,
      errors: [
        'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
        'Add it to your Vercel project settings under Settings → Environment Variables, ' +
        'then redeploy.',
      ],
    }
  }

  // Resolve demo accounts still present in the DB. Match case-insensitively in
  // JS (Postgres .in is case-sensitive) so this stays in sync with the button.
  const demoSet = new Set(DEMO_EMAILS.map(e => e.toLowerCase()))
  const { data: allProfiles } = await admin.from('profiles').select('id, email')
  const targets = (allProfiles ?? []).filter(p => p.email && demoSet.has(p.email.toLowerCase()))

  if (!targets.length) return { deleted: 0, skipped: 0, errors: [] }

  const targetIds = targets.map(t => t.id)

  // ── Clean up owned content, then remove each account ──────────────────────
  const errors = await cleanupUserContent(admin, targetIds)

  let deleted = 0
  let skipped = 0
  for (const target of targets) {
    const { ok, error } = await removeAccount(admin, target.id)
    if (ok) {
      deleted++
    } else {
      errors.push(`Delete ${target.email}: ${error}`)
      skipped++
    }
  }

  revalidatePath('/app/admin/users')
  return { deleted, skipped, errors }
}
