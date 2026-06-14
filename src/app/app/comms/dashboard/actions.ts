'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { getNextMeetingDate } from '@/lib/comms-agenda'

// Loosely-typed client for the comms_* tables that are not yet present in the
// generated Database types.
type CommsDbClient = {
  from: (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (...args: unknown[]) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (...args: unknown[]) => any
  }
}

const VALID_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: FormDataEntryValue | null) {
  const text = asText(value)
  return text || null
}

function asNullableUuid(value: FormDataEntryValue | null) {
  const text = asNullableText(value)
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

// ─── Weekly agenda ───────────────────────────────────────────────────────────

export async function addAgendaItem(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const agendaSupabase = supabase as unknown as CommsDbClient

  const title = asText(formData.get('title'))
  if (!title) throw new Error('An agenda title is required.')

  const summary = asText(formData.get('summary')) || null
  const meetingDateInput = asText(formData.get('meeting_date'))
  const meetingDate = /^\d{4}-\d{2}-\d{2}$/.test(meetingDateInput) ? meetingDateInput : getNextMeetingDate()

  // The proposer is the owner — automatic and not reassignable from this view.
  const { error } = await agendaSupabase.from('comms_weekly_agenda_items').insert({
    meeting_date: meetingDate,
    title,
    summary,
    owner_id: user.id,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
}

export async function updateAgendaItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const agendaSupabase = supabase as unknown as CommsDbClient

  const id = asText(formData.get('agenda_item_id'))
  const title = asText(formData.get('title'))
  const summary = asText(formData.get('summary')) || null

  if (!id) throw new Error('Agenda item is required.')
  if (!title) throw new Error('An agenda title is required.')

  const { error } = await agendaSupabase
    .from('comms_weekly_agenda_items')
    .update({ title, summary, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
}

// ─── Person-owned tasks ──────────────────────────────────────────────────────

export async function createCommsTask(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const tasksSupabase = supabase as unknown as CommsDbClient

  const title = asText(formData.get('title'))
  if (!title) throw new Error('A task title is required.')

  const description = asNullableText(formData.get('description'))
  const ownerId = asNullableUuid(formData.get('owner_id'))
  const agendaItemId = asNullableUuid(formData.get('agenda_item_id'))
  const dueInput = asText(formData.get('due_date'))
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueInput) ? dueInput : null

  const { error } = await tasksSupabase.from('comms_tasks').insert({
    title,
    description,
    owner_id: ownerId ?? user.id,
    due_date: dueDate,
    status: 'not_started',
    agenda_item_id: agendaItemId,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
  revalidatePath('/app/dashboard')
}

export async function updateCommsTaskStatus(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const tasksSupabase = supabase as unknown as CommsDbClient

  const id = asText(formData.get('task_id'))
  const status = asText(formData.get('status'))
  if (!id) throw new Error('Task is required.')
  if (!VALID_STATUSES.has(status)) throw new Error('Invalid status.')

  const { error } = await tasksSupabase
    .from('comms_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
  revalidatePath('/app/dashboard')
}
