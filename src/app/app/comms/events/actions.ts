'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
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
    .select('id, role, comms_team')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

function ensureValidStage(value: string): EventStage {
  if (!(value in EVENT_STAGE_META)) throw new Error('Invalid event stage')
  return value as EventStage
}

export async function createEvent(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const name = asText(formData.get('name'))
  const eventType = asText(formData.get('event_type')) || 'conference'
  const startDate = asText(formData.get('start_date'))

  if (!name || !startDate) throw new Error('Event name and start date are required.')

  const { data, error } = await supabase
    .from('events')
    .insert({
      name,
      event_type: eventType,
      start_date: startDate,
      end_date: asText(formData.get('end_date')) || null,
      organiser: asText(formData.get('organiser')) || null,
      location_city: asText(formData.get('location_city')) || null,
      location_country: asText(formData.get('location_country')) || null,
      notes: asText(formData.get('notes')) || null,
      is_annual_congress: asText(formData.get('is_annual_congress')) === 'true',
      is_i2l_organised: asText(formData.get('is_i2l_organised')) === 'true',
      stage: 'announced',
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/events')
  redirect(`/app/comms/events/${data?.id}`)
}

export async function saveEventDetails(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))

  if (!eventId) throw new Error('Event is required.')

  const payload = {
    name: asText(formData.get('name')),
    event_type: asText(formData.get('event_type')) || 'conference',
    start_date: asText(formData.get('start_date')),
    end_date: asText(formData.get('end_date')) || null,
    organiser: asText(formData.get('organiser')) || null,
    location_city: asText(formData.get('location_city')) || null,
    location_country: asText(formData.get('location_country')) || null,
    notes: asText(formData.get('notes')) || null,
    is_annual_congress: asText(formData.get('is_annual_congress')) === 'true',
    is_i2l_organised: asText(formData.get('is_i2l_organised')) === 'true',
    i2l_representatives: parseValues(formData, 'i2l_representatives'),
  }

  if (!payload.name || !payload.start_date) throw new Error('Event name and start date are required.')

  const { error } = await supabase.from('events').update(payload).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/events')
  revalidatePath(`/app/comms/events/${eventId}`)
}

export async function transitionEventStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const nextStage = ensureValidStage(asText(formData.get('next_stage')))

  if (!eventId) throw new Error('Event is required.')

  const { error } = await supabase.from('events').update({ stage: nextStage }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/events')
  revalidatePath(`/app/comms/events/${eventId}`)
}

export async function toggleEventOutputItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const field = asText(formData.get('field'))
  const nextValue = asText(formData.get('next_value')) === 'true'

  const allowedFields = new Set([
    'output_report_drafted',
    'output_linkedin_published',
    'output_newsletter_mentioned',
    'output_media_stored',
  ])

  if (!eventId || !allowedFields.has(field)) throw new Error('Invalid event output toggle request.')

  const { error } = await supabase.from('events').update({ [field]: nextValue }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/events')
  revalidatePath(`/app/comms/events/${eventId}`)
}

export async function linkEventInitiative(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const initiativeId = asText(formData.get('initiative_id'))

  if (!eventId || !initiativeId) throw new Error('Event and initiative are required.')

  const { data: event, error: loadError } = await supabase
    .from('events')
    .select('initiative_ids')
    .eq('id', eventId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!event) throw new Error('Event not found.')

  const initiativeIds = Array.from(new Set([...(event.initiative_ids ?? []), initiativeId]))
  const { error } = await supabase.from('events').update({ initiative_ids: initiativeIds }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/events')
  revalidatePath(`/app/comms/events/${eventId}`)
}
