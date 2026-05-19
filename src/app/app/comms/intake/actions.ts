'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
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
import {
  buildEventDraftFromIntake,
  findDuplicateEventMatch,
  getPeterAwareClassificationConfidence,
  isPeterKapiteinSignal,
  mergeCampusMemberUpdate,
  parseCampusMemberDraft,
  type ParsedCampusMemberDraft,
} from '@/lib/comms-routing'
import { sendDailyCommsDigest } from '@/lib/comms-digest'
import type { Database } from '@/types/database'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

type AppSupabaseClient = SupabaseClient<Database>
type IntakeItemRow = Database['public']['Tables']['intake_items']['Row']
type EventDraftInput = {
  name: string
  eventType: string
  startDate: string
  endDate?: string
  organiser?: string
  locationCity?: string
  locationCountry?: string
  notes?: string
  isAnnualCongress?: boolean
}
type CampusMemberRecord = Pick<
  Database['public']['Tables']['campus_members']['Row'],
  | 'id'
  | 'name'
  | 'country'
  | 'organisation'
  | 'role_description'
  | 'notes'
  | 'welcomed_by_peter'
  | 'date_welcomed'
  | 'last_channel_activity'
  | 'initiative_affiliations'
>

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

function mergeTextBlocks(existing: string | null | undefined, addition: string) {
  const base = existing?.trim()
  const next = addition.trim()
  if (!base) return next
  if (!next || base.includes(next)) return base
  return `${base}\n\n${next}`
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[]
}

async function createDestinationRecord(
  sb: AppSupabaseClient,
  destination: RouteDestination,
  {
    item,
    userId,
    titleOverride,
    channels,
    eventDraft,
    memberDraft,
    linkedInitiativeId,
  }: {
    item: IntakeItemRow
    userId: string
    titleOverride?: string | null
    channels?: string[]
    eventDraft?: EventDraftInput
    memberDraft?: {
      name: string
      country?: string
      organisation?: string
      roleDescription?: string
      welcomedByPeter?: boolean
    }
    linkedInitiativeId?: string | null
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
    const draft = eventDraft ?? buildEventDraftFromIntake(item)
    const { data: events, error: eventsError } = await sb
      .from('events')
      .select('id, name, start_date, notes, organiser, location_city, location_country, initiative_ids, is_annual_congress')
      .order('start_date', { ascending: false })

    if (eventsError) throw new Error(eventsError.message)

    const existing = findDuplicateEventMatch(
      {
        name: draft.name || title,
        startDate: draft.startDate || item.captured_at.slice(0, 10),
      },
      (events ?? []) as Array<{ id: string; name: string; start_date: string }>
    )

    if (existing) {
      const current = (events ?? []).find((event) => event.id === existing.id)
      const { error: updateError } = await sb
        .from('events')
        .update({
          name: draft.name || current?.name || title,
          organiser: draft.organiser || current?.organiser,
          location_city: draft.locationCity || current?.location_city,
          location_country: draft.locationCountry || current?.location_country,
          notes: mergeTextBlocks(current?.notes, draft.notes || item.raw_content),
          initiative_ids: linkedInitiativeId
            ? uniqueValues([...(current?.initiative_ids ?? []), linkedInitiativeId])
            : current?.initiative_ids,
          is_annual_congress: Boolean(current?.is_annual_congress || draft.isAnnualCongress),
        })
        .eq('id', existing.id)

      if (updateError) throw new Error(updateError.message)
      return { routedToId: existing.id, routedToType: 'event' }
    }

    const { data, error } = await sb
      .from('events')
      .insert({
        name: draft.name || title,
        event_type: draft.eventType || 'conference',
        start_date: draft.startDate || item.captured_at.slice(0, 10),
        end_date: draft.endDate || null,
        organiser: draft.organiser || item.sender_name,
        location_city: draft.locationCity || null,
        location_country: draft.locationCountry || null,
        stage: item.content_type === 'event_report' ? 'post_event' : 'announced',
        initiative_ids: linkedInitiativeId ? [linkedInitiativeId] : null,
        notes: draft.notes || item.raw_content,
        is_annual_congress: Boolean(draft.isAnnualCongress),
      })
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return { routedToId: data?.id ?? null, routedToType: 'event' }
  }

  if (destination === 'campus_member') {
    const draftInput = memberDraft ?? parseCampusMemberDraft(item)
    const parsed: ParsedCampusMemberDraft = {
      name: draftInput.name || item.sender_name,
      country: draftInput.country ?? '',
      organisation: draftInput.organisation ?? '',
      roleDescription: draftInput.roleDescription ?? '',
      welcomedByPeter: Boolean(draftInput.welcomedByPeter),
    }
    const { data: members, error: membersError } = await sb
      .from('campus_members')
      .select(
        'id, name, country, organisation, role_description, notes, welcomed_by_peter, date_welcomed, last_channel_activity, initiative_affiliations'
      )
      .order('created_at', { ascending: false })

    if (membersError) throw new Error(membersError.message)

    const existing = (members ?? []).find(
      (member) =>
        member.name.trim().toLowerCase() === parsed.name.trim().toLowerCase() &&
        (parsed.country ? (member.country ?? '').trim().toLowerCase() === parsed.country.trim().toLowerCase() : true)
    )

    if (existing) {
      const { error: updateError } = await sb
        .from('campus_members')
        .update(
          mergeCampusMemberUpdate(
            existing as CampusMemberRecord,
            parsed,
            item,
            linkedInitiativeId
          )
        )
        .eq('id', existing.id)

      if (updateError) throw new Error(updateError.message)
      return { routedToId: existing.id, routedToType: 'campus_member' }
    }

    const { data, error } = await sb
      .from('campus_members')
      .insert({
        name: parsed.name || item.sender_name,
        country: parsed.country || null,
        organisation: parsed.organisation || null,
        role_description: parsed.roleDescription || null,
        notes: item.raw_content,
        date_welcomed: item.captured_at.slice(0, 10),
        welcomed_by_peter: Boolean(parsed.welcomedByPeter),
        initiative_affiliations: linkedInitiativeId ? [linkedInitiativeId] : null,
        last_channel_activity: item.captured_at,
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
    const peterSignal = isPeterKapiteinSignal(senderName)

    if (!senderName || !rawContent || !contentType) {
      return { ok: false, error: 'Sender, message summary, and content type are required.' }
    }

    const { error } = await supabase.from('intake_items').insert({
      capture_method: 'manual',
      sender_name: senderName,
      raw_content: rawContent,
      source_url: sourceUrl,
      attached_media_ref: attachedMediaRef,
      content_type: contentType,
      classification_confidence: getPeterAwareClassificationConfidence(senderName),
      is_peter_kapitein: peterSignal,
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
    const linkedInitiativeId = asText(formData.get('route_initiative_id')) || null

    if (!intakeItemId || !requestedDestination) {
      return { ok: false, error: 'Item and destination are required.' }
    }

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select(
        'id, capture_method, captured_at, classification_confidence, content_type, created_at, dismissed_reason, attached_media_ref, is_peter_kapitein, raw_content, reviewed_at, reviewed_by, routed_to_id, routed_to_type, sender_name, sender_whatsapp_id, source_url, status'
      )
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    const type = item.content_type as IntakeContentType
    if (!getRoutingOptions(type).includes(requestedDestination)) {
      throw new Error('Selected destination is not valid for this content type.')
    }

    const parsedEventDraft = buildEventDraftFromIntake(item)
    const parsedMemberDraft = parseCampusMemberDraft(item)
    const eventDraft = {
      ...parsedEventDraft,
      name: asText(formData.get('event_name')) || parsedEventDraft.name,
      eventType: asText(formData.get('event_type')) || parsedEventDraft.eventType,
      startDate: asText(formData.get('event_start_date')) || parsedEventDraft.startDate,
      endDate: asText(formData.get('event_end_date')) || parsedEventDraft.endDate,
      organiser: asText(formData.get('event_organiser')) || parsedEventDraft.organiser,
      locationCity: asText(formData.get('event_location_city')) || parsedEventDraft.locationCity,
      locationCountry: asText(formData.get('event_location_country')) || parsedEventDraft.locationCountry,
      notes: asText(formData.get('event_notes')) || parsedEventDraft.notes,
      isAnnualCongress: asText(formData.get('event_is_annual_congress')) === 'true' || parsedEventDraft.isAnnualCongress,
    }
    const memberDraft: ParsedCampusMemberDraft = {
      name: asText(formData.get('member_name')) || parsedMemberDraft.name,
      country: asText(formData.get('member_country')) || parsedMemberDraft.country || '',
      organisation: asText(formData.get('member_organisation')) || parsedMemberDraft.organisation || '',
      roleDescription: asText(formData.get('member_role_description')) || parsedMemberDraft.roleDescription || '',
      welcomedByPeter:
        asText(formData.get('member_welcomed_by_peter')) === 'true' || parsedMemberDraft.welcomedByPeter,
    }

    const route = await createDestinationRecord(supabase, requestedDestination, {
      item,
      userId: user.id,
      titleOverride,
      channels,
      eventDraft,
      memberDraft,
      linkedInitiativeId,
    })

    const { error: updateError } = await supabase
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
    revalidatePath('/app/comms/events')
    revalidatePath('/app/comms/campus-log')
    if (route.routedToType === 'event' && route.routedToId) revalidatePath(`/app/comms/events/${route.routedToId}`)
    if (route.routedToType === 'campus_member' && route.routedToId) {
      revalidatePath(`/app/comms/campus-log/members/${route.routedToId}`)
    }

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

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select('id, content_type')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    if (item.content_type !== nextType) {
      const { error: logError } = await supabase.from('intake_classification_corrections').insert({
        intake_item_id: intakeItemId,
        previous_content_type: item.content_type,
        corrected_content_type: nextType,
        corrected_by: user.id,
      })
      if (logError) throw new Error(logError.message)
    }

    const { error: updateError } = await supabase
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

    const { error } = await supabase
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
