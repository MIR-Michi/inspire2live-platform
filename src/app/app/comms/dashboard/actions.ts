'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { getNextMeetingDate } from '@/lib/comms-agenda'

// Loosely-typed client for the comms_weekly_agenda_items table, which is
// not yet present in the generated Database types.
type AgendaClient = {
  from: (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (...args: unknown[]) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (...args: unknown[]) => any
  }
}

const VALID_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped'])

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
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

export async function addAgendaItem(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const agendaSupabase = supabase as unknown as AgendaClient

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
    status: 'not_started',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
}

export async function updateAgendaItemStatus(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const agendaSupabase = supabase as unknown as AgendaClient

  const id = asText(formData.get('agenda_item_id'))
  const status = asText(formData.get('status'))
  if (!id) throw new Error('Agenda item is required.')
  if (!VALID_STATUSES.has(status)) throw new Error('Invalid status.')

  // RLS additionally enforces that only the owner can update.
  const { error } = await agendaSupabase
    .from('comms_weekly_agenda_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/dashboard')
}
