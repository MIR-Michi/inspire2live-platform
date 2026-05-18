'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  buildCalendarDraftFromIntake,
  buildTagsFromIntake,
  getRoutingOptions,
  parseChannelList,
  summarizeRawContent,
  type IntakeContentType,
  type RouteDestination,
} from '@/lib/comms-workflow'
import { sendDailyCommsDigest } from '@/lib/comms-digest'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

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
    .select('id, name, email, role, timezone, notification_prefs, comms_team')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

function guessIfPeter(senderName: string, rawContent: string) {
  const haystack = `${senderName} ${rawContent}`.toLowerCase()
  return haystack.includes('peter') && haystack.includes('kapitein')
}

async function createDestinationRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  destination: RouteDestination,
  {
    item,
    userId,
    titleOverride,
    channels,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any
    userId: string
    titleOverride?: string | null
    channels?: string[]
  }
) {
  const title = titleOverride || summarizeRawContent(item.raw_content, 80)

  if (destination === 'calendar') {
    const draft = buildCalendarDraftFromIntake(item)
    const { data, error } = await sb
      .from('content_calendar')
      .insert({
        ...draft,
        title: titleOverride || draft.title,
        channels: channels?.length ? channels : draft.channels,
        author_id: userId,
        source_intake_id: item.id,
      })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return { routedToId: data?.id ?? null, routedToType: 'calendar' }
  }

  if (destination === 'event') {
    const { data, error } = await sb
      .from('events')
      .insert({
        name: title,
        event_type: 'conference',
        start_date: item.captured_at.slice(0, 10),
        stage: 'post_event',
        notes: item.raw_content,
      })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return { routedToId: data?.id ?? null, routedToType: 'event' }
  }

  if (destination === 'campus_member') {
    const { data, error } = await sb
      .from('campus_members')
      .insert({
        name: item.sender_name,
        notes: item.raw_content,
        date_welcomed: item.captured_at.slice(0, 10),
        welcomed_by_peter: item.is_peter_kapitein,
      })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return { routedToId: data?.id ?? null, routedToType: 'campus_member' }
  }

  const { data, error } = await sb
    .from('media_assets')
    .insert({
      title,
      asset_type: 'document',
      rights_status: 'needs_clearance',
      sharepoint_url: item.attached_media_ref || item.source_url,
      contributed_by: userId,
      tags: buildTagsFromIntake(item),
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { routedToId: data?.id ?? null, routedToType: 'media_asset' }
}

export async function submitManualIntake(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase } = await requireCommsOperator()
    const senderName = asText(formData.get('sender_name'))
    const rawContent = asText(formData.get('raw_content'))
    const contentType = asText(formData.get('content_type')) as IntakeContentType
    const sourceUrl = asText(formData.get('source_url')) || null
    const attachedMediaRef = asText(formData.get('attached_media_ref')) || null

    if (!senderName || !rawContent || !contentType) {
      return { ok: false, error: 'Sender, message summary, and content type are required.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { error } = await sb.from('intake_items').insert({
      capture_method: 'manual',
      sender_name: senderName,
      raw_content: rawContent,
      source_url: sourceUrl,
      attached_media_ref: attachedMediaRef,
      content_type: contentType,
      classification_confidence: 'high',
      is_peter_kapitein: guessIfPeter(senderName, rawContent),
      status: 'unreviewed',
    })

    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/intake')
    revalidatePath('/app/comms/intake/new')

    return { ok: true, message: 'Intake item captured and queued for review.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create intake item.' }
  }
}

export async function routeIntakeItem(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))
    const requestedDestination = asText(formData.get('destination')) as RouteDestination
    const titleOverride = asText(formData.get('route_title')) || null
    const channels = parseChannelList(formData.getAll('channels'))

    if (!intakeItemId || !requestedDestination) {
      return { ok: false, error: 'Item and destination are required.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: item, error: loadError } = await sb
      .from('intake_items')
      .select('*')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    const type = item.content_type as IntakeContentType
    if (!getRoutingOptions(type).includes(requestedDestination)) {
      throw new Error('Selected destination is not valid for this content type.')
    }

    const route = await createDestinationRecord(sb, requestedDestination, {
      item,
      userId: user.id,
      titleOverride,
      channels,
    })

    const { error: updateError } = await sb
      .from('intake_items')
      .update({
        status: 'routed',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        routed_to_type: route.routedToType,
        routed_to_id: route.routedToId,
      })
      .eq('id', intakeItemId)

    if (updateError) throw new Error(updateError.message)

    revalidatePath('/app/comms/intake')
    revalidatePath('/app/comms/calendar')

    return { ok: true, message: 'Item routed successfully.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not route intake item.' }
  }
}

export async function promoteIntakeToCalendar(formData: FormData) {
  const destination = formData.get('destination')
  if (!destination) formData.set('destination', 'calendar')
  return routeIntakeItem(INITIAL_STATE, formData)
}

export async function editIntakeClassification(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))
    const nextType = asText(formData.get('content_type')) as IntakeContentType

    if (!intakeItemId || !nextType) {
      return { ok: false, error: 'Item and updated content type are required.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: item, error: loadError } = await sb
      .from('intake_items')
      .select('id, content_type')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    if (item.content_type !== nextType) {
      const { error: logError } = await sb.from('intake_classification_corrections').insert({
        intake_item_id: intakeItemId,
        previous_content_type: item.content_type,
        corrected_content_type: nextType,
        corrected_by: user.id,
      })
      if (logError) throw new Error(logError.message)
    }

    const { error: updateError } = await sb
      .from('intake_items')
      .update({
        content_type: nextType,
        classification_confidence: 'high',
      })
      .eq('id', intakeItemId)

    if (updateError) throw new Error(updateError.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'Classification updated.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update classification.' }
  }
}

export async function dismissIntakeItem(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))
    const dismissedReason = asText(formData.get('dismissed_reason')) || 'Marked as noise'

    if (!intakeItemId) return { ok: false, error: 'Item is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { error } = await sb
      .from('intake_items')
      .update({
        status: 'dismissed',
        dismissed_reason: dismissedReason,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', intakeItemId)

    if (error) throw new Error(error.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'Item moved to the 90-day archive.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not dismiss intake item.' }
  }
}

export async function sendDailyDigestNow(
  _prevState: CommsFormState = INITIAL_STATE
): Promise<CommsFormState> {
  try {
    const { profile } = await requireCommsOperator()
    const admin = createAdminClient()
    const result = await sendDailyCommsDigest({
      supabase: admin,
      recipient: profile,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      reason: 'manual',
    })

    if (result.error && !result.sent) {
      return {
        ok: false,
        error: result.itemCount === 0 ? 'No new intake items to include in the digest.' : result.error,
      }
    }

    return {
      ok: true,
      message: result.itemCount === 0 ? 'No new intake items to include in the digest.' : 'Digest sent.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send digest.' }
  }
}
