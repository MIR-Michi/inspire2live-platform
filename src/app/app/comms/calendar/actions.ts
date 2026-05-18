'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  assertCalendarTransition,
  buildCalendarDraftFromIntake,
  parseChannelList,
  parseTagList,
  type CalendarStatus,
  type IntakeContentType,
} from '@/lib/comms-workflow'

export interface CalendarFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CalendarFormState = { ok: false }

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
    .select('role, comms_team')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, userId: user.id }
}

export async function saveCalendarEntry(
  _prevState: CalendarFormState = INITIAL_STATE,
  formData: FormData
): Promise<CalendarFormState> {
  try {
    const { supabase, userId } = await requireCommsOperator()
    const entryId = asText(formData.get('entry_id'))
    const title = asText(formData.get('title'))
    const channels = parseChannelList(formData.getAll('channels'))
    const status = asText(formData.get('status')) as CalendarStatus
    const scheduledAt = asText(formData.get('scheduled_at')) || null
    const sourceLink = asText(formData.get('source_link')) || null
    const bodyDraft = asText(formData.get('body_draft')) || null
    const tags = parseTagList(asText(formData.get('tags')))
    const attachedMediaRefs = parseTagList(asText(formData.get('attached_media_refs')))
    const authorId = asText(formData.get('author_id')) || userId

    if (!title || channels.length === 0 || !status) {
      return { ok: false, error: 'Title, at least one channel, and status are required.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const payload = {
      title,
      channels,
      status,
      scheduled_at: scheduledAt || null,
      source_link: sourceLink,
      body_draft: bodyDraft,
      tags,
      attached_media_refs: attachedMediaRefs,
      author_id: authorId,
    }

    const query = entryId
      ? sb.from('content_calendar').update(payload).eq('id', entryId)
      : sb.from('content_calendar').insert(payload)

    const { error } = await query
    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/calendar')
    return { ok: true, message: entryId ? 'Calendar entry updated.' : 'Calendar draft created.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save calendar entry.' }
  }
}

export async function updateCalendarStatus(formData: FormData): Promise<CalendarFormState> {
  try {
    const { supabase } = await requireCommsOperator()
    const entryId = asText(formData.get('entry_id'))
    const nextStatus = asText(formData.get('next_status')) as CalendarStatus

    if (!entryId || !nextStatus) {
      return { ok: false, error: 'Entry and target status are required.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: current, error: loadError } = await sb
      .from('content_calendar')
      .select('status')
      .eq('id', entryId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!current) throw new Error('Calendar entry not found.')

    assertCalendarTransition(current.status as CalendarStatus, nextStatus)

    const patch: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === 'published') patch.published_at = new Date().toISOString()
    if (nextStatus === 'archived' && current.status === 'published') patch.updated_at = new Date().toISOString()

    const { error } = await sb.from('content_calendar').update(patch).eq('id', entryId)
    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/calendar')
    return { ok: true, message: `Calendar entry moved to ${nextStatus.replace('_', ' ')}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update status.' }
  }
}

export async function transitionCalendarStatus(formData: FormData): Promise<void> {
  const result = await updateCalendarStatus(formData)
  if (!result.ok) throw new Error(result.error ?? 'Could not update status.')
}

export async function promoteIntakeCandidate(
  _prevState: CalendarFormState = INITIAL_STATE,
  formData: FormData
): Promise<CalendarFormState> {
  try {
    const { supabase, userId } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))

    if (!intakeItemId) return { ok: false, error: 'Intake item is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: item, error: loadError } = await sb
      .from('intake_items')
      .select('*')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    const draft = buildCalendarDraftFromIntake(item)
    const { data: created, error: createError } = await sb
      .from('content_calendar')
      .insert({
        ...draft,
        source_intake_id: item.id,
        author_id: userId,
      })
      .select('id')
      .maybeSingle()

    if (createError) throw new Error(createError.message)

    const updatePatch =
      (item.content_type as IntakeContentType) === 'noise'
        ? { status: 'dismissed', dismissed_reason: 'Promoted manually as reference' }
        : {
            status: 'routed',
            routed_to_type: 'calendar',
            routed_to_id: created?.id ?? null,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
          }

    const { error: updateError } = await sb.from('intake_items').update(updatePatch).eq('id', intakeItemId)
    if (updateError) throw new Error(updateError.message)

    revalidatePath('/app/comms/calendar')
    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'Intake item promoted to the content calendar.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not promote item.' }
  }
}
