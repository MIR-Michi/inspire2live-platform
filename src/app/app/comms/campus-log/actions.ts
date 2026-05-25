'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function parseLineList(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatCampusDecision(decision: string, owner: string) {
  return `Decision: ${decision.slice(0, 220)} | Owner: ${owner.slice(0, 80)}`
}

function safeReturnPath(formData: FormData) {
  const path = asText(formData.get('return_path'))
  return path.startsWith('/app/comms/') ? path : '/app/comms/campus'
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user }
}

export async function createCampusSession(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const sessionDate = asText(formData.get('session_date'))
  const theme = asText(formData.get('theme'))

  if (!sessionDate) throw new Error('Session date is required.')

  const { data, error } = await supabase
    .from('campus_sessions')
    .insert({
      session_date: sessionDate,
      theme: theme || null,
      summary: asText(formData.get('summary')) || null,
      decisions_for_publication: parseLineList(asText(formData.get('decisions_for_publication'))),
      created_by: user.id,
      participating_hub_ids: parseValues(formData, 'participating_hub_ids'),
      initiative_ids: parseValues(formData, 'initiative_ids'),
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus-log')
  redirect(`/app/comms/campus-log/sessions/${data?.id}`)
}

export async function saveCampusSession(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  if (!sessionId) throw new Error('Session is required.')

  const { error } = await supabase
    .from('campus_sessions')
    .update({
      session_date: asText(formData.get('session_date')),
      theme: asText(formData.get('theme')) || null,
      summary: asText(formData.get('summary')) || null,
      decisions_for_publication: parseLineList(asText(formData.get('decisions_for_publication'))),
      action_items_for_publication: parseLineList(asText(formData.get('action_items_for_publication'))),
      recording_url: asText(formData.get('recording_url')) || null,
      slides_media_id: asText(formData.get('slides_media_id')) || null,
      participating_hub_ids: parseValues(formData, 'participating_hub_ids'),
      initiative_ids: parseValues(formData, 'initiative_ids'),
      published_outputs: parseValues(formData, 'published_outputs'),
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus-log')
  revalidatePath(`/app/comms/campus-log/sessions/${sessionId}`)
}

export async function addCampusAgendaItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const agendaItem = asText(formData.get('agenda_item'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !agendaItem) throw new Error('Session and agenda item are required.')

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('action_items_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = `Agenda: ${agendaItem.slice(0, 180)}`
  const existingItems = session.action_items_for_publication ?? []
  const actionItems = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ action_items_for_publication: actionItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function addCampusDecisionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const decision = asText(formData.get('decision_item'))
  const owner = asText(formData.get('decision_owner'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !decision || !owner) {
    throw new Error('Decision and owner are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('decisions_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = formatCampusDecision(decision, owner)
  const existingItems = session.decisions_for_publication ?? []
  const decisions = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ decisions_for_publication: decisions })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function updateCampusDecisionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const decision = asText(formData.get('decision_item'))
  const owner = asText(formData.get('decision_owner'))
  const returnPath = safeReturnPath(formData)
  const index = Number(asText(formData.get('decision_index')))

  if (!sessionId || !decision || !owner || !Number.isInteger(index) || index < 0) {
    throw new Error('Decision, owner, and valid index are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('decisions_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const existingItems = [...(session.decisions_for_publication ?? [])]
  if (index >= existingItems.length) throw new Error('Decision not found.')
  existingItems[index] = formatCampusDecision(decision, owner)

  const { error } = await supabase
    .from('campus_sessions')
    .update({ decisions_for_publication: existingItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function addCampusActionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const action = asText(formData.get('action_item'))
  const assignee = asText(formData.get('assigned_to'))
  const dueDate = asText(formData.get('due_date'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !action || !assignee || !dueDate) {
    throw new Error('Action item, assigned person, and date are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('action_items_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = `Action: ${action.slice(0, 180)} | Owner: ${assignee.slice(0, 80)} | Due: ${dueDate}`
  const existingItems = session.action_items_for_publication ?? []
  const actionItems = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ action_items_for_publication: actionItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}
