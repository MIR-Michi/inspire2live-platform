'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  getDefaultAttendanceKind,
  isPodcastEventType,
  isPodcastWorkflowField,
  normalizeI2LOwnedFlag,
  normalizeAttendanceKind,
  normalizeEventType,
  normalizePodcastRecordingMode,
  parseDelimitedList,
  parsePodcastDistributionChannels,
  requiresOwnerAssignment,
  supportsInternalParticipantSelection,
} from '@/lib/comms-events'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'
import { PODCAST_TASK_TEMPLATE } from '@/lib/podcast-tasks'
import { notifyUser } from '@/lib/notify'

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function revalidateEventWorkspacePaths(eventId?: string) {
  revalidatePath('/app/comms/events')
  revalidatePath('/app/comms/conferences')
  revalidatePath('/app/comms/podcast')
  if (eventId) revalidatePath(`/app/comms/events/${eventId}`)
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
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

function attendanceKind(formData: FormData, input: {
  eventType: string
  isI2lOrganised: boolean
}) {
  const fallback = getDefaultAttendanceKind(input)
  return normalizeAttendanceKind(asText(formData.get('attendance_kind')) || fallback)
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
  const isI2lOrganised = normalizeI2LOwnedFlag({
    eventType,
    isI2lOrganised: isChecked(formData, 'is_i2l_organised'),
  })
  const ownerId = asText(formData.get('owner_id')) || null

  if (!name || !startDate) throw new Error('Event name and start date are required.')
  if (requiresOwnerAssignment({ eventType, isI2lOrganised }) && !ownerId) {
    throw new Error('A responsible owner is required for I2L-owned events.')
  }

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
      owner_id: ownerId,
      attendance_kind: attendanceKind(formData, {
        eventType,
        isI2lOrganised,
      }),
      presentation_summary: asText(formData.get('presentation_summary')) || null,
      presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
      event_image_url: asText(formData.get('event_image_url')) || null,
      event_website_url: asText(formData.get('event_website_url')) || null,
      push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
      is_annual_congress: false,
      is_i2l_organised: isI2lOrganised,
      i2l_representatives: supportsInternalParticipantSelection({
        eventType,
        isI2lOrganised,
      })
        ? parseValues(formData, 'i2l_representatives')
        : [],
      ...parsePodcastFields(formData, eventType),
      stage: 'announced',
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths()
  redirect(`/app/comms/events/${data?.id}`)
}

export async function saveEventDetails(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))

  if (!eventId) throw new Error('Event is required.')

  const eventType = normalizeEventType(asText(formData.get('event_type')) || 'conference')
  const isI2lOrganised = normalizeI2LOwnedFlag({
    eventType,
    isI2lOrganised: isChecked(formData, 'is_i2l_organised'),
  })
  const ownerId = asText(formData.get('owner_id')) || null
  if (requiresOwnerAssignment({ eventType, isI2lOrganised }) && !ownerId) {
    throw new Error('A responsible owner is required for I2L-owned events.')
  }

  const payload = {
    name: asText(formData.get('name')),
    event_type: eventType,
    start_date: asText(formData.get('start_date')),
    end_date: asText(formData.get('end_date')) || null,
    organiser: asText(formData.get('organiser')) || null,
    location_city: asText(formData.get('location_city')) || null,
    location_country: asText(formData.get('location_country')) || null,
    notes: asText(formData.get('notes')) || null,
    owner_id: ownerId,
    attendance_kind: attendanceKind(formData, {
      eventType,
      isI2lOrganised,
    }),
    presentation_summary: asText(formData.get('presentation_summary')) || null,
    presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
    event_image_url: asText(formData.get('event_image_url')) || null,
    event_website_url: asText(formData.get('event_website_url')) || null,
    push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
    is_annual_congress: false,
    is_i2l_organised: isI2lOrganised,
    i2l_representatives: supportsInternalParticipantSelection({
      eventType,
      isI2lOrganised,
    })
      ? parseValues(formData, 'i2l_representatives')
      : [],
    ...parsePodcastFields(formData, eventType),
  }

  if (!payload.name || !payload.start_date) throw new Error('Event name and start date are required.')

  const { error } = await supabase.from('events').update(payload).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths(eventId)
}

export async function transitionEventStage(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const nextStage = ensureValidStage(asText(formData.get('next_stage')))

  if (!eventId) throw new Error('Event is required.')

  const { error } = await supabase.from('events').update({ stage: nextStage }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths(eventId)
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

  revalidateEventWorkspacePaths(eventId)
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

  revalidateEventWorkspacePaths(eventId)
}

/**
 * Targeted save for a single phase panel — only the relevant columns are updated.
 * The `section` field discriminates which group of columns to write.
 */
export async function saveEventSection(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const section = asText(formData.get('section'))
  if (!eventId) throw new Error('Event is required.')

  let payload: Record<string, unknown>

  switch (section) {
    case 'podcast_setup':
      payload = {
        name: asText(formData.get('name')),
        start_date: asText(formData.get('start_date')),
        end_date: asText(formData.get('end_date')) || null,
        location_city: asText(formData.get('location_city')) || null,
        location_country: asText(formData.get('location_country')) || null,
        organiser: asText(formData.get('organiser')) || null,
        event_website_url: asText(formData.get('event_website_url')) || null,
        owner_id: asText(formData.get('owner_id')) || null,
        push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
        podcast_series_name: asText(formData.get('podcast_series_name')) || null,
        podcast_hosts: parseDelimitedList(asText(formData.get('podcast_hosts'))),
        podcast_guests: parseDelimitedList(asText(formData.get('podcast_guests'))),
        podcast_recording_mode: normalizePodcastRecordingMode(
          asText(formData.get('podcast_recording_mode')) || 'remote'
        ),
        podcast_recording_link: asText(formData.get('podcast_recording_link')) || null,
        event_image_url: asText(formData.get('event_image_url')) || null,
        presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
      }
      if (!payload.name || !payload.start_date) throw new Error('Event name and start date are required.')
      break

    // Podcast topic + notes (the right-hand panel of the podcast workspace):
    // the episode angle/talking points, run of show, summary, follow-up notes,
    // final publishing title, and distribution channels. Kept separate from the
    // logistics form so the two panels save independently.
    case 'podcast_notes':
      payload = {
        podcast_preparation_notes: asText(formData.get('podcast_preparation_notes')) || null,
        podcast_run_of_show: asText(formData.get('podcast_run_of_show')) || null,
        podcast_followup_notes: asText(formData.get('podcast_followup_notes')) || null,
        presentation_summary: asText(formData.get('presentation_summary')) || null,
        podcast_episode_title: asText(formData.get('podcast_episode_title')) || null,
        podcast_distribution_channels: parsePodcastDistributionChannels(
          formData.getAll('podcast_distribution_channels').map((v) => (typeof v === 'string' ? v : ''))
        ),
        notes: asText(formData.get('notes')) || null,
      }
      break

    case 'podcast_run':
      payload = {
        podcast_run_of_show: asText(formData.get('podcast_run_of_show')) || null,
      }
      break

    case 'podcast_after':
      payload = {
        podcast_episode_title: asText(formData.get('podcast_episode_title')) || null,
        podcast_distribution_channels: parsePodcastDistributionChannels(
          formData.getAll('podcast_distribution_channels').map((v) => (typeof v === 'string' ? v : ''))
        ),
        podcast_followup_notes: asText(formData.get('podcast_followup_notes')) || null,
        output_report_drafted: isChecked(formData, 'output_report_drafted'),
        output_linkedin_published: isChecked(formData, 'output_linkedin_published'),
        output_newsletter_mentioned: isChecked(formData, 'output_newsletter_mentioned'),
        output_media_stored: isChecked(formData, 'output_media_stored'),
        notes: asText(formData.get('notes')) || null,
        presentation_summary: asText(formData.get('presentation_summary')) || null,
      }
      break

    case 'event_prepare':
    case 'event_attend': {
      const eventType = normalizeEventType(asText(formData.get('event_type')) || 'conference')
      const isI2lOrganised = normalizeI2LOwnedFlag({
        eventType,
        isI2lOrganised: isChecked(formData, 'is_i2l_organised'),
      })
      const name = asText(formData.get('name'))
      const startDate = asText(formData.get('start_date'))
      if (!name || !startDate) throw new Error('Event name and start date are required.')
      payload = {
        name,
        event_type: eventType,
        start_date: startDate,
        end_date: asText(formData.get('end_date')) || null,
        location_city: asText(formData.get('location_city')) || null,
        location_country: asText(formData.get('location_country')) || null,
        organiser: asText(formData.get('organiser')) || null,
        event_website_url: asText(formData.get('event_website_url')) || null,
        owner_id: asText(formData.get('owner_id')) || null,
        is_i2l_organised: isI2lOrganised,
        is_annual_congress: false,
        push_to_group_calendar: isChecked(formData, 'push_to_group_calendar'),
        event_image_url: asText(formData.get('event_image_url')) || null,
        presentation_summary: asText(formData.get('presentation_summary')) || null,
        presentation_asset_url: asText(formData.get('presentation_asset_url')) || null,
        attendance_kind:
          section === 'event_attend'
            ? normalizeAttendanceKind(asText(formData.get('attendance_kind')) || 'visitor')
            : 'organiser',
        i2l_representatives:
          section === 'event_attend' ? parseValues(formData, 'i2l_representatives') : [],
      }
      break
    }

    case 'event_after':
      payload = {
        output_report_drafted: isChecked(formData, 'output_report_drafted'),
        output_linkedin_published: isChecked(formData, 'output_linkedin_published'),
        output_newsletter_mentioned: isChecked(formData, 'output_newsletter_mentioned'),
        output_media_stored: isChecked(formData, 'output_media_stored'),
        notes: asText(formData.get('notes')) || null,
      }
      break

    default:
      throw new Error('Invalid section.')
  }

  const { error } = await supabase.from('events').update(payload).eq('id', eventId)
  if (error) throw new Error(error.message)
  revalidateEventWorkspacePaths(eventId)
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

  revalidateEventWorkspacePaths(eventId)
}

export async function unlinkEventInitiative(formData: FormData) {
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

  const initiativeIds = (event.initiative_ids ?? []).filter((id) => id !== initiativeId)
  const { error } = await supabase.from('events').update({ initiative_ids: initiativeIds }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths(eventId)
}

export async function linkEventPipeline(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const pipelineId = asText(formData.get('pipeline_id'))

  if (!eventId || !pipelineId) throw new Error('Event and pipeline are required.')

  const { data: event, error: loadError } = await supabase
    .from('events')
    .select('pipeline_ids')
    .eq('id', eventId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!event) throw new Error('Event not found.')

  const pipelineIds = Array.from(new Set([...(event.pipeline_ids ?? []), pipelineId]))
  const { error } = await supabase.from('events').update({ pipeline_ids: pipelineIds }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths(eventId)
}

export async function unlinkEventPipeline(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const eventId = asText(formData.get('event_id'))
  const pipelineId = asText(formData.get('pipeline_id'))

  if (!eventId || !pipelineId) throw new Error('Event and pipeline are required.')

  const { data: event, error: loadError } = await supabase
    .from('events')
    .select('pipeline_ids')
    .eq('id', eventId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!event) throw new Error('Event not found.')

  const pipelineIds = (event.pipeline_ids ?? []).filter((id) => id !== pipelineId)
  const { error } = await supabase.from('events').update({ pipeline_ids: pipelineIds }).eq('id', eventId)
  if (error) throw new Error(error.message)

  revalidateEventWorkspacePaths(eventId)
}

// ─── Event checklist (comms_tasks scoped to an event — podcast workspace) ─────

type ChecklistResult = { ok: boolean; message?: string }

const VALID_TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped'])

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * Seeds the standard podcast checklist as comms_tasks tied to an event. Each
 * task defaults to the event's owner (falling back to the acting user) so it
 * always has an owner and flows to that owner's personal dashboard. created_at
 * is staggered by index so the checklist renders in template order. No-op if
 * tasks already exist for the event.
 */
export async function seedEventChecklist(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const eventId = asText(formData.get('event_id'))
    if (!eventId) return { ok: false, message: 'Event is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { count } = await db
      .from('comms_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
    if ((count ?? 0) > 0) return { ok: true }

    const { data: event } = await db.from('events').select('owner_id').eq('id', eventId).maybeSingle()
    const ownerId = (event?.owner_id as string | null) ?? user.id

    const total = PODCAST_TASK_TEMPLATE.length
    const base = Date.now()
    const rows = PODCAST_TASK_TEMPLATE.map((task, index) => ({
      title: task.title,
      owner_id: ownerId,
      status: 'not_started',
      event_id: eventId,
      created_by: user.id,
      // Stagger into the recent past so the checklist renders in template order
      // (the loader sorts by created_at asc) without dating tasks in the future.
      created_at: new Date(base - (total - index) * 1000).toISOString(),
    }))

    const { error } = await db.from('comms_tasks').insert(rows)
    if (error) return { ok: false, message: error.message }

    revalidateEventWorkspacePaths(eventId)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to set up checklist.' }
  }
}

export async function createEventChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const eventId = asText(formData.get('event_id'))
    const title = asText(formData.get('title'))
    const ownerId = asText(formData.get('owner_id')) || null
    const dueInput = asText(formData.get('due_date'))
    const dueDate = isIsoDate(dueInput) ? dueInput : null

    if (!eventId) return { ok: false, message: 'Event is required.' }
    if (!title) return { ok: false, message: 'A task title is required.' }

    const resolvedOwnerId = ownerId ?? user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').insert({
      title: title.slice(0, 200),
      owner_id: resolvedOwnerId,
      due_date: dueDate,
      status: 'not_started',
      event_id: eventId,
      created_by: user.id,
    })
    if (error) return { ok: false, message: error.message }

    if (resolvedOwnerId !== user.id) {
      await notifyUser({
        recipientId: resolvedOwnerId,
        event: 'task_assigned',
        title: 'New podcast task assigned to you',
        body: `You have been assigned a podcast task: "${title}"`,
        linkUrl: `/app/comms/events/${eventId}`,
      })
    }

    revalidateEventWorkspacePaths(eventId)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to add task.' }
  }
}

export async function updateEventChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const taskId = asText(formData.get('task_id'))
    const eventId = asText(formData.get('event_id'))
    if (!taskId) return { ok: false, message: 'Task is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }

    if (formData.has('title')) {
      const title = asText(formData.get('title'))
      if (!title) return { ok: false, message: 'A task title is required.' }
      patch.title = title.slice(0, 200)
    }
    if (formData.has('owner_id')) {
      patch.owner_id = asText(formData.get('owner_id')) || null
    }
    if (formData.has('status')) {
      const status = asText(formData.get('status'))
      if (!VALID_TASK_STATUSES.has(status)) return { ok: false, message: 'Invalid status.' }
      patch.status = status
    }
    if (formData.has('due_date')) {
      const dueInput = asText(formData.get('due_date'))
      patch.due_date = isIsoDate(dueInput) ? dueInput : null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').update(patch).eq('id', taskId)
    if (error) return { ok: false, message: error.message }

    // Notify a newly assigned owner (unless they assigned it to themselves).
    if (patch.owner_id && patch.owner_id !== user.id) {
      await notifyUser({
        recipientId: patch.owner_id,
        event: 'task_assigned',
        title: 'A podcast task was assigned to you',
        body: `You are now the owner of: "${asText(formData.get('task_title')) || 'a podcast task'}"`,
        linkUrl: eventId ? `/app/comms/events/${eventId}` : '/app/comms/podcast',
      })
    }

    revalidateEventWorkspacePaths(eventId || undefined)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update task.' }
  }
}

export async function deleteEventChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase } = await requireCommsOperator()
    const taskId = asText(formData.get('task_id'))
    const eventId = asText(formData.get('event_id'))
    if (!taskId) return { ok: false, message: 'Task is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').delete().eq('id', taskId)
    if (error) return { ok: false, message: error.message }

    revalidateEventWorkspacePaths(eventId || undefined)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete task.' }
  }
}
