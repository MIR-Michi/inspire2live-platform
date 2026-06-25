'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { notifyUser } from '@/lib/notify'

// Loosely-typed client for the member_onboarding tables that are not yet in the
// generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any

const VALID_TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableUuid(value: FormDataEntryValue | null) {
  const text = asText(value)
  return text && UUID_RE.test(text) ? text : null
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user }
}

function revalidate() {
  revalidatePath('/app/comms/dashboard')
  revalidatePath('/app/comms/crm')
  // Onboarding tasks assigned to a person surface on their personal dashboard.
  revalidatePath('/app/dashboard')
}

// ─── Registration & gating ──────────────────────────────────────────────────

/**
 * Register a new member manually. The email may be a not-yet-provisioned
 * @inspire2live.org address — creating the mailbox can itself be a task.
 */
export async function registerNewMember(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const db = supabase as AnyDb

  const fullName = asText(formData.get('full_name'))
  if (!fullName) throw new Error('A name is required.')
  const email = asText(formData.get('email')) || null

  const { error } = await db.from('member_onboarding').insert({
    full_name: fullName,
    email,
    status: 'pending',
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  revalidate()
}

export async function confirmMemberOnboarding(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const db = supabase as AnyDb

  const id = asNullableUuid(formData.get('onboarding_id'))
  if (!id) throw new Error('Member is required.')

  const { error } = await db
    .from('member_onboarding')
    .update({
      status: 'active',
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  revalidate()
}

export async function declineMemberOnboarding(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const db = supabase as AnyDb

  const id = asNullableUuid(formData.get('onboarding_id'))
  if (!id) throw new Error('Member is required.')

  const { error } = await db
    .from('member_onboarding')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  revalidate()
}

// ─── Checklist tasks ────────────────────────────────────────────────────────

export async function addMemberOnboardingTask(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const db = supabase as AnyDb

  const onboardingId = asNullableUuid(formData.get('onboarding_id'))
  if (!onboardingId) throw new Error('Member is required.')
  const title = asText(formData.get('title'))
  if (!title) throw new Error('A task title is required.')
  // Every task must have an owner — a task cannot be set up without one.
  const assigneeId = asNullableUuid(formData.get('assignee_id'))
  if (!assigneeId) throw new Error('An owner is required for every task.')

  const { count } = await db
    .from('member_onboarding_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('onboarding_id', onboardingId)

  const { error } = await db.from('member_onboarding_tasks').insert({
    onboarding_id: onboardingId,
    title,
    assignee_id: assigneeId,
    status: 'not_started',
    position: count ?? 0,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  // Adding work to a member previously marked complete reopens them.
  await reconcileMemberCompletion(db, onboardingId)

  if (assigneeId !== user.id) {
    await notifyUser({
      recipientId: assigneeId,
      event: 'task_assigned',
      title: 'New onboarding task assigned to you',
      body: `You have been assigned an onboarding task: "${title}"`,
      linkUrl: '/app/dashboard',
    })
  }

  revalidate()
}

/**
 * Reassigns an onboarding task to a different owner. Every task must keep an
 * owner, so a valid assignee is required (you cannot clear it).
 */
export async function updateMemberOnboardingTaskAssignee(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const db = supabase as AnyDb

  const taskId = asNullableUuid(formData.get('task_id'))
  if (!taskId) throw new Error('Task is required.')
  const assigneeId = asNullableUuid(formData.get('assignee_id'))
  if (!assigneeId) throw new Error('A valid owner is required.')

  const { data: updated, error } = await db
    .from('member_onboarding_tasks')
    .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('title')
    .single()
  if (error) throw new Error(error.message)

  if (assigneeId !== user.id) {
    await notifyUser({
      recipientId: assigneeId,
      event: 'task_assigned',
      title: 'An onboarding task was assigned to you',
      body: `You are now the owner of: "${updated?.title ?? 'an onboarding task'}"`,
      linkUrl: '/app/dashboard',
    })
  }

  revalidate()
}

export async function updateMemberOnboardingTaskStatus(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const db = supabase as AnyDb

  const taskId = asNullableUuid(formData.get('task_id'))
  const status = asText(formData.get('status'))
  if (!taskId) throw new Error('Task is required.')
  if (!VALID_TASK_STATUSES.has(status)) throw new Error('Invalid status.')

  // Read the current state first so we can detect the not-completed → completed
  // transition and log it to the person's CRM activity feed exactly once.
  const { data: before } = await db
    .from('member_onboarding_tasks')
    .select('status, title, onboarding_id')
    .eq('id', taskId)
    .single()

  const now = new Date().toISOString()
  const { data: updated, error } = await db
    .from('member_onboarding_tasks')
    .update({
      status,
      completed_at: status === 'completed' ? now : null,
      updated_at: now,
    })
    .eq('id', taskId)
    .select('onboarding_id')
    .single()
  if (error) throw new Error(error.message)

  const onboardingId = updated?.onboarding_id ?? before?.onboarding_id ?? null

  // Document completed onboarding tasks on the CRM contact's activity feed.
  if (status === 'completed' && before && before.status !== 'completed' && onboardingId) {
    await logOnboardingTaskCompletion(db, onboardingId, before.title as string, user.id, now)
  }

  if (onboardingId) await reconcileMemberCompletion(db, onboardingId)
  revalidate()
}

/**
 * Records a completed onboarding task as an interaction on the member's CRM
 * contact, so the person's activity feed shows the onboarding history with a
 * timestamp. The contact link is the member_onboarding_id set by the spine
 * trigger (migration 00065 / 00069); if no contact is linked yet, this is a
 * no-op rather than an error — task completion must never fail on logging.
 */
async function logOnboardingTaskCompletion(
  db: AnyDb,
  onboardingId: string,
  taskTitle: string,
  userId: string,
  occurredAt: string
) {
  try {
    const { data: contact } = await db
      .from('comms_crm_contacts')
      .select('id')
      .eq('member_onboarding_id', onboardingId)
      .maybeSingle()
    if (!contact?.id) return

    await db.from('comms_crm_interactions').insert({
      contact_id: contact.id,
      interaction_type: 'note',
      summary: `Onboarding task completed: ${taskTitle}`,
      occurred_at: occurredAt,
      created_by: userId,
    })

    await db
      .from('comms_crm_contacts')
      .update({ last_interaction_at: occurredAt, updated_at: occurredAt })
      .eq('id', contact.id)
  } catch {
    // Activity logging is best-effort — never block the task update.
  }
}

/**
 * Deletes a new-member onboarding record (and its checklist via FK cascade).
 * Symmetric with deleting the person in the CRM: the partner DB trigger
 * (migration 00069) removes the linked name-only CRM contact, so the member
 * disappears from BOTH the dashboard and the CRM directory at once. Platform
 * users (profile-linked) are never deletable here — manage them via their
 * profile.
 */
export async function deleteMemberOnboarding(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const db = supabase as AnyDb

  const id = asNullableUuid(formData.get('onboarding_id'))
  if (!id) throw new Error('Member is required.')

  const { data: member, error: readError } = await db
    .from('member_onboarding')
    .select('profile_id')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (member?.profile_id) {
    throw new Error('This member is a platform user — manage them via their profile.')
  }

  const { error } = await db.from('member_onboarding').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidate()
  revalidatePath('/app/comms/crm/people')
}

export async function removeMemberOnboardingTask(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const db = supabase as AnyDb

  const taskId = asNullableUuid(formData.get('task_id'))
  if (!taskId) throw new Error('Task is required.')

  const { data: removed, error } = await db
    .from('member_onboarding_tasks')
    .delete()
    .eq('id', taskId)
    .select('onboarding_id')
    .single()
  if (error) throw new Error(error.message)

  if (removed?.onboarding_id) await reconcileMemberCompletion(db, removed.onboarding_id)
  revalidate()
}

/**
 * A member is "fully onboarded" once they have at least one task and every task
 * is completed; then they drop off the dashboard. Reverts to 'active' if work
 * is reopened or added.
 */
async function reconcileMemberCompletion(db: AnyDb, onboardingId: string) {
  const { data: tasks } = await db
    .from('member_onboarding_tasks')
    .select('status')
    .eq('onboarding_id', onboardingId)

  const list = (tasks ?? []) as Array<{ status: string }>
  const allDone = list.length > 0 && list.every((t) => t.status === 'completed')

  await db
    .from('member_onboarding')
    .update({
      status: allDone ? 'completed' : 'active',
      completed_at: allDone ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', onboardingId)
    .in('status', ['active', 'completed'])
}
