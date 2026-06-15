'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'

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
  const assigneeId = asNullableUuid(formData.get('assignee_id'))

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
  revalidate()
}

export async function updateMemberOnboardingTaskStatus(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const db = supabase as AnyDb

  const taskId = asNullableUuid(formData.get('task_id'))
  const status = asText(formData.get('status'))
  if (!taskId) throw new Error('Task is required.')
  if (!VALID_TASK_STATUSES.has(status)) throw new Error('Invalid status.')

  const { data: updated, error } = await db
    .from('member_onboarding_tasks')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select('onboarding_id')
    .single()
  if (error) throw new Error(error.message)

  if (updated?.onboarding_id) await reconcileMemberCompletion(db, updated.onboarding_id)
  revalidate()
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
