'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  isPodcastEventType,
  isPodcastWorkflowField,
  normalizeAttendanceKind,
  normalizeEventType,
  normalizePodcastRecordingMode,
  parseDelimitedList,
  parsePodcastDistributionChannels,
} from '@/lib/comms-events'
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
    .select('id, role, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

function ensureValidStage(value: string): EventStage {
  if (!(value in EVENT_STAGE_META)) throw new Error('Invalid event stage')
  return value as EventStage
}

function isChecked(formData: FormData, key: string) {
  return asText(formData.get(key)) === 'true'
}

function attendanceKind(formData: FormData) {
  return normalizeAttendanceKind(asText(formData.get('attendance_kind')) || 'visitor')
}

function parsePodcastFields(formData: FormData, eventType: string) {
  if (!isPodcastEventType(eventType)) {
    return {
      podcast_series_name: null,
      podcast_episode_title: null,
      podcast_hosts: [],
      podcast_guests: [],
      podcast_recording_mode: 'remote',
      podcast_distribution_channels: [],
      podcast_recording_link: null,
      podcast_preparation_notes: null,
      podcast_run_of_show: null,
      podcast_followup_notes: null,
      podcast_guest_confirmed: false,
      podcast_brief_ready: false,
      podcast_release_form_ready: false,
      podcast_equipment_ready: false,
      podcast_recording_completed: false,
      podcast_backup_completed: false,
      podcast_edit_completed: false,
      podcast_transcript_completed: false,
      podcast_show_notes_completed: false,
      podcast_published: false,
      podcast_followup_completed: false,
    }
  }

  const distributionValues = formData
    .getAll('podcast_distribution_channels')
    .map((value) => (typeof value === 'string' ? value : ''))

  return {
    podcast_series_name: asText(formData.get('podcast_series_name')) || null,
    podcast_episode_title: asText(formData.get('podcast_episode_title')) || null,
    podcast_hosts: parseDelimitedList(asText(formData.get('podcast_hosts'))),
    podcast_guests: parseDelimitedList(asText(formData.get('podcast_guests'))),
    podcast_recording_mode: normalizePodcastRecordingMode(
      asText(formData.get('podcast_recording_mode')) || 'remote'
    ),
    podcast_distribution_channels: parsePodcastDistributionChannels(distributionValues),
    podcast_recording_link: asText(formData.get('podcast_recording_link')) || null,
    podcast_preparation_notes: asText(formData.get('podcast_preparation_notes')) || null,
    podcast_run_of_show: asText(formData.get('podcast_run_of_show')) || null,
    podcast_followup_notes: asText(formData.get('podcast_followup_notes')) || null,
    podcast_guest_confirmed: isChecked(formData, 'podcast_guest_confirmed'),
    podcast_brief_ready: isChecked(formData, 'podcast_brief_ready'),
    podcast_release_form_ready: isChecked(formData, 'podcast_release_form_ready'),
    podcast_equipment_ready: isChecked(formData, 'podcast_equipment_ready'),
    podcast_recording_completed: isChecked(formData, 'podcast_recording_completed'),
    podcast_backup_completed: isChecked(formData, 'podcast_backup_completed'),
    podcast_edit_completed: isChecked(formData, 'podcast_edit_completed'),
    podcast_transcript_completed: isChecked(formData, 'podcast_transcript_completed'),
    podcast_show_notes_completed: isChecked(formData, 'podcast_show_notes_completed'),
    podcast_published: isChecked(formData, 'podcast_published'),
    podcast_followup_completed: isChecked(formData, 'podcast_followup_completed'),
  }
}

export async function createEvent(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const name = asText(formData.get('name'))
  const eventType = normalizeEventType(asText(formData.get('event_type')) || 'conference')
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
      attendance_kind: attendanceKind(formData),
      presentation_summary: asText(formData.get('presentation_summary')) || null,
      presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
      event_image_url: asText(formData.get('event_image_url')) || null,
      event_website_url: asText(formData.get('event_website_url')) || null,
      push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
      is_annual_congress: isChecked(formData, 'is_annual_congress'),
      is_i2l_organised: isChecked(formData, 'is_i2l_organised'),
      ...parsePodcastFields(formData, eventType),
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

  const eventType = normalizeEventType(asText(formData.get('event_type')) || 'conference')
  const payload = {
    name: asText(formData.get('name')),
    event_type: eventType,
    start_date: asText(formData.get('start_date')),
    end_date: asText(formData.get('end_date')) || null,
    organiser: asText(formData.get('organiser')) || null,
    location_city: asText(formData.get('location_city')) || null,
    location_country: asText(formData.get('location_country')) || null,
    notes: asText(formData.get('notes')) || null,
    attendance_kind: attendanceKind(formData),
    presentation_summary: asText(formData.get('presentation_summary')) || null,
    presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
    event_image_url: asText(formData.get('event_image_url')) || null,
    event_website_url: asText(formData.get('event_website_url')) || null,
    push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
    is_annual_congress: isChecked(formData, 'is_annual_congress'),
    is_i2l_organised: isChecked(formData, 'is_i2l_organised'),
    i2l_representatives: parseValues(formData, 'i2l_representatives'),
    ...parsePodcastFields(formData, eventType),
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

export async function togglePodcastWorkflowItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const field = asText(formData.get('field'))
  const nextValue = asText(formData.get('next_value')) === 'true'

  if (!eventId || !isPodcastWorkflowField(field)) {
    throw new Error('Invalid podcast workflow toggle request.')
  }

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
