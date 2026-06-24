'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRole, ROLE_LABELS } from '@/lib/role-access'
import { getAuthBaseUrl } from '@/lib/auth-redirect-url'
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

// ─── inviteUserAccount ──────────────────────────────────────────────────────

/**
 * Invites a new user by email using the Supabase **Admin API**, server-side.
 *
 * This replaces the previous client-side `signInWithOtp` invite, which used the
 * PKCE flow and bound the code verifier to the *admin's* browser — so the link
 * could never be completed by the invitee (it failed as "expired or already
 * used"). `inviteUserByEmail` sends a token-hash invite link that any device can
 * complete, and the `/auth/callback` route verifies it via `verifyOtp`.
 *
 * If a *pending* (un-onboarded) account or an orphan profile already exists for
 * the email — e.g. a previous delete did not fully propagate — it is cleared
 * first so the invite is not rejected as a duplicate. A fully onboarded account
 * is never wiped.
 *
 * @param origin Browser origin (e.g. https://app.example.org) used to build the
 *   absolute callback URL — passed from the client so it is correct in every
 *   environment without relying on a server env var.
 */
export async function inviteUserAccount(
  email: string,
  role: string,
  origin: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError } = await requireAdmin(supabase)
  if (authError) return { error: authError }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address.' }
  }

  let redirectTo: string
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol')
    // Point to /auth/confirm (the interstitial), not /auth/callback directly.
    //
    // Why: the production Supabase project may still be using the default invite
    // template ({{ .ConfirmationURL }}). In that case, Supabase's verify endpoint
    // processes the token and forwards to `redirectTo`. If `redirectTo` is
    // /auth/callback, the route handler calls verifyOtp on GET and consumes the
    // single-use token immediately — so any link-scanner pre-fetch (Microsoft
    // SafeLinks, Gmail, etc.) spends the token before the real user clicks.
    //
    // Pointing to /auth/confirm means the scanner only fetches harmless HTML; the
    // token is consumed only when the human explicitly POSTs (clicks "Accept").
    // This is the intended design documented in docs/AUTH_INVITE_FLOW.md.
    const base = getAuthBaseUrl({ browserOrigin: url.origin })
    redirectTo = `${base}/auth/confirm`
  } catch {
    return { error: 'Could not determine the app URL for the invitation link.' }
  }

  const inviteRole = role in ROLE_LABELS ? role : 'PatientAdvocate'

  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Server is not configured for invitations (missing service role key).' }
  }

  // ── Clear any prior record for this email BEFORE inviting ───────────────────
  // Re-inviting against a lingering auth.users row makes inviteUserByEmail resend
  // against that stale user, so the emailed token is already spent and the link
  // verifies as "expired or already used". We therefore purge any existing record
  // first, check the purge actually succeeded, and then confirm no auth user
  // remains — so the invite always mints a brand-new, single-use token.

  // A fully-onboarded account must be explicitly deleted by the admin first.
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, onboarding_completed')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (existingProfile?.onboarding_completed) {
    return { error: 'This email already has an active account. Deactivate or delete it first.' }
  }

  // Resolve the auth user id for this email. The profile id equals the auth id,
  // but we also look up auth.users by email so we catch an orphaned auth row that
  // a prior delete left behind (profile removed, auth user not) or an id mismatch.
  const resolveAuthUserId = async (): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any).rpc('admin_get_auth_user_id', {
      p_email: normalizedEmail,
    })
    return (data as string | null) ?? null
  }

  const purgeFailed = 'Could not clear the previous record for this email before inviting. Please try again in a moment.'

  // 1. Purge the record we can see (un-onboarded profile, else orphan auth row).
  const staleId = existingProfile?.id ?? (await resolveAuthUserId())
  if (staleId) {
    await cleanupUserContent(admin, [staleId])
    const { ok } = await removeAccount(admin, staleId)
    if (!ok) return { error: purgeFailed }
  }

  // 2. Safety net: if an auth user STILL exists for this email (e.g. the profile
  //    delete fell back to removing only the profile row, leaving the auth user),
  //    purge it too — otherwise the invite resends a stale, already-spent token.
  const remainingId = await resolveAuthUserId()
  if (remainingId) {
    await cleanupUserContent(admin, [remainingId])
    const { ok } = await removeAccount(admin, remainingId)
    if (!ok) return { error: purgeFailed }
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { role: inviteRole, name: '' },
    redirectTo,
  })

  if (error) {
    const message = error.message || 'Could not send the invitation.'
    if (/already.*registered|already.*exists/i.test(message)) {
      return { error: 'This email already has an account. Delete it first, then invite again.' }
    }
    return { error: message }
  }

  revalidatePath('/app/admin/users')
  return { error: null }
}

// ─── resendInvitation ────────────────────────────────────────────────────────

/**
 * Re-sends the invitation link for a still-pending (un-onboarded) user.
 *
 * Invitation links expire (default 24h on Supabase). When an invitee misses the
 * window, the admin needs to issue a fresh one without re-typing the email/role.
 * This looks up the pending account and delegates to {@link inviteUserAccount},
 * which already purges the stale auth record first so a brand-new, single-use
 * token is minted (a plain resend would re-emit the already-spent token, which
 * verifies as "expired or already used").
 *
 * Refuses to act on a fully-onboarded account — there is no pending invite to
 * renew, and re-inviting would be destructive.
 */
export async function resendInvitation(
  targetUserId: string,
  origin: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error: authError } = await requireAdmin(supabase)
  if (authError) return { error: authError }

  if (!targetUserId) return { error: 'Invalid target user id' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, role, onboarding_completed')
    .eq('id', targetUserId)
    .maybeSingle()

  if (!profile?.email) return { error: 'Could not find this user’s email address.' }
  if (profile.onboarding_completed) {
    return { error: 'This user has already completed onboarding — there is no pending invitation to resend.' }
  }

  // Delegates to the invite path, which purges the stale token before issuing a
  // fresh one. requireAdmin runs again there (cheap, and keeps the action safe
  // to call on its own).
  return inviteUserAccount(profile.email, profile.role ?? 'PatientAdvocate', origin)
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

  // ── Phase 1: resolve all parent entity IDs in parallel ───────────────────
  const [
    { data: initData },
    { data: hubData },
    { data: engagementData },
    { data: topicData },
    { data: taskByUserData },
    { data: taskByReporterData },
    { data: discByUserData },
  ] = await Promise.all([
    admin.from('initiatives').select('id').in('lead_id', targetIds),
    admin.from('hubs').select('id').in('coordinator_id', targetIds),
    admin.from('partner_engagements').select('id').in('partner_id', targetIds),
    admin.from('congress_topics').select('id').in('submitter_id', targetIds),
    admin.from('tasks').select('id').in('assignee_id', targetIds),
    admin.from('tasks').select('id').in('reporter_id', targetIds),
    admin.from('discussions').select('id').in('author_id', targetIds),
  ])

  const initIds = initData?.map((r: { id: string }) => r.id) ?? []
  const hubIds = hubData?.map((r: { id: string }) => r.id) ?? []
  const engagementIds = engagementData?.map((r: { id: string }) => r.id) ?? []
  const topicIds = topicData?.map((r: { id: string }) => r.id) ?? []

  let taskIdsByInit: string[] = []
  let discIdsByInit: string[] = []
  if (initIds.length) {
    const [{ data: tInit }, { data: dInit }] = await Promise.all([
      admin.from('tasks').select('id').in('initiative_id', initIds),
      admin.from('discussions').select('id').in('initiative_id', initIds),
    ])
    taskIdsByInit = tInit?.map((r: { id: string }) => r.id) ?? []
    discIdsByInit = dInit?.map((r: { id: string }) => r.id) ?? []
  }

  const allTaskIds = [...new Set([
    ...(taskByUserData?.map((r: { id: string }) => r.id) ?? []),
    ...(taskByReporterData?.map((r: { id: string }) => r.id) ?? []),
    ...taskIdsByInit,
  ])]
  const allDiscIds = [...new Set([
    ...(discByUserData?.map((r: { id: string }) => r.id) ?? []),
    ...discIdsByInit,
  ])]

  // ── Phase 2: NULL nullable FK columns + permission log (all independent) ──
  await Promise.all([
    tryOp('content_calendar.author_id',
      () => admin.from('content_calendar').update({ author_id: null }).in('author_id', targetIds)),
    tryOp('campus_sessions.created_by',
      () => admin.from('campus_sessions').update({ created_by: null }).in('created_by', targetIds)),
    tryOp('campus_members.platform_profile_id',
      () => admin.from('campus_members').update({ platform_profile_id: null }).in('platform_profile_id', targetIds)),
    tryOp('intake_items.reviewed_by',
      () => admin.from('intake_items').update({ reviewed_by: null }).in('reviewed_by', targetIds)),
    tryOp('intake_classification_corrections.corrected_by',
      () => admin.from('intake_classification_corrections').update({ corrected_by: null }).in('corrected_by', targetIds)),
    tryOp('intake_classifier_rules.created_by',
      () => admin.from('intake_classifier_rules').update({ created_by: null }).in('created_by', targetIds)),
    tryOp('intake_classifier_training_examples.created_by',
      () => admin.from('intake_classifier_training_examples').update({ created_by: null }).in('created_by', targetIds)),
    tryOp('media_assets.contributed_by',
      () => admin.from('media_assets').update({ contributed_by: null }).in('contributed_by', targetIds)),
    tryOp('media_recovery_requests.requested_by',
      () => admin.from('media_recovery_requests').update({ requested_by: null }).in('requested_by', targetIds)),
    tryOp('congress_sessions.session_lead_id',
      () => admin.from('congress_sessions').update({ session_lead_id: null }).in('session_lead_id', targetIds)),
    tryOp('congress_sessions.note_taker_id',
      () => admin.from('congress_sessions').update({ note_taker_id: null }).in('note_taker_id', targetIds)),
    tryOp('congress_decisions.owner_id',
      () => admin.from('congress_decisions').update({ owner_id: null }).in('owner_id', targetIds)),
    tryOp('discussions.decision_made_by',
      () => admin.from('discussions').update({ decision_made_by: null }).in('decision_made_by', targetIds)),
    tryOp('partner_engagements.reviewer_id',
      () => admin.from('partner_engagements').update({ reviewer_id: null }).in('reviewer_id', targetIds)),
    // Reset CRM platform_status so the contact correctly shows "no platform account"
    // after deletion. profile_id is NULLed automatically by the FK cascade when the
    // profile row is deleted, but platform_status has no cascade — it would stay
    // stale ('invited'/'active') without this explicit reset.
    tryOp('comms_crm_contacts (platform_status)',
      () => admin.from('comms_crm_contacts').update({ platform_status: 'none' }).in('profile_id', targetIds)),
    tryOp('permission_audit_log (changed_by)',
      () => admin.from('permission_audit_log').delete().in('changed_by', targetIds)),
    tryOp('permission_audit_log (target_user_id)',
      () => admin.from('permission_audit_log').delete().in('target_user_id', targetIds)),
  ])

  // ── Phase 3: child content — independent FK chains run in parallel ────────
  await Promise.all([
    // Partner chain: audit entries before engagements
    (async () => {
      if (engagementIds.length) {
        await tryOp('partner_audit_entries (engagement)',
          () => admin.from('partner_audit_entries').delete().in('engagement_id', engagementIds))
      }
      await tryOp('partner_audit_entries (actor)',
        () => admin.from('partner_audit_entries').delete().in('actor_id', targetIds))
      await tryOp('partner_engagements',
        () => admin.from('partner_engagements').delete().in('partner_id', targetIds))
    })(),
    // Congress topics chain: votes before topics
    (async () => {
      if (topicIds.length) {
        await tryOp('topic_votes',
          () => admin.from('topic_votes').delete().in('topic_id', topicIds))
      }
      await tryOp('congress_topics',
        () => admin.from('congress_topics').delete().in('submitter_id', targetIds))
    })(),
    // Task chain: comments before tasks
    (async () => {
      if (allTaskIds.length) {
        await tryOp('task_comments (task)',
          () => admin.from('task_comments').delete().in('task_id', allTaskIds))
      }
      await tryOp('task_comments (author)',
        () => admin.from('task_comments').delete().in('author_id', targetIds))
      await Promise.all([
        tryOp('tasks (assignee)', () => admin.from('tasks').delete().in('assignee_id', targetIds)),
        tryOp('tasks (reporter)', () => admin.from('tasks').delete().in('reporter_id', targetIds)),
        ...(initIds.length ? [tryOp('tasks (initiative)', () => admin.from('tasks').delete().in('initiative_id', initIds))] : []),
      ])
    })(),
    // Discussion chain: replies before discussions
    (async () => {
      if (allDiscIds.length) {
        await tryOp('discussion_replies (discussion)',
          () => admin.from('discussion_replies').delete().in('discussion_id', allDiscIds))
      }
      await tryOp('discussion_replies (author)',
        () => admin.from('discussion_replies').delete().in('author_id', targetIds))
      await Promise.all([
        tryOp('discussions (author)', () => admin.from('discussions').delete().in('author_id', targetIds)),
        ...(initIds.length ? [tryOp('discussions (initiative)', () => admin.from('discussions').delete().in('initiative_id', initIds))] : []),
      ])
    })(),
    // Resources, milestones, members, activity log
    (async () => {
      await Promise.all([
        tryOp('resources (uploader)', () => admin.from('resources').delete().in('uploaded_by_id', targetIds)),
        ...(initIds.length ? [tryOp('resources (initiative)', () => admin.from('resources').delete().in('initiative_id', initIds))] : []),
        ...(initIds.length ? [tryOp('milestones', () => admin.from('milestones').delete().in('initiative_id', initIds))] : []),
        ...(initIds.length ? [tryOp('initiative_members (initiative)', () => admin.from('initiative_members').delete().in('initiative_id', initIds))] : []),
        ...(initIds.length ? [tryOp('activity_log (initiative)', () => admin.from('activity_log').delete().in('initiative_id', initIds))] : []),
        tryOp('initiative_members (user)', () => admin.from('initiative_members').delete().in('user_id', targetIds)),
        tryOp('activity_log (actor)', () => admin.from('activity_log').delete().in('actor_id', targetIds)),
      ])
    })(),
    // Hub subtree children (hub rows deleted in phase 4)
    (async () => {
      await Promise.all([
        tryOp('hub_members (user)', () => admin.from('hub_members').delete().in('user_id', targetIds)),
        ...(hubIds.length ? [tryOp('hub_members (hub)', () => admin.from('hub_members').delete().in('hub_id', hubIds))] : []),
        ...(hubIds.length ? [tryOp('hub_initiatives (hub)', () => admin.from('hub_initiatives').delete().in('hub_id', hubIds))] : []),
        ...(initIds.length ? [tryOp('hub_initiatives (initiative)', () => admin.from('hub_initiatives').delete().in('initiative_id', initIds))] : []),
      ])
    })(),
  ])

  // ── Phase 4: top-level owned rows — after all their children are gone ─────
  await Promise.all([
    tryOp('hubs', () => admin.from('hubs').delete().in('coordinator_id', targetIds)),
    tryOp('initiatives', () => admin.from('initiatives').delete().in('lead_id', targetIds)),
  ])

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
