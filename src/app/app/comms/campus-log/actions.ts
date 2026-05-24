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
