'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  CONTENT_TYPE_META,
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
import {
  COMMS_CLASSIFIER_VERSION,
  classifyIntakeItem,
  type PersistedClassifierReason,
  toClassifierRules,
} from '@/lib/comms-classifier'
import { sendDailyCommsDigest } from '@/lib/comms-digest'
import { normalizeEventType } from '@/lib/comms-events'
import { buildRecoveryTitle } from '@/lib/comms-media'
import type { Database } from '@/types/database'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

function safeCommsReturnPath(formData: FormData) {
  const path = asText(formData.get('return_path'))
  return path.startsWith('/app/comms/') ? path : '/app/comms/intake'
}

function revalidateIntakeSurfaces(path?: string) {
  revalidatePath('/app/comms/intake')
  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/planner')
  if (path) revalidatePath(path)
}

type AppSupabaseClient = SupabaseClient<Database>
type IntakeItemRow = Database['public']['Tables']['intake_items']['Row']
type ClassifierRuleRow = Database['public']['Tables']['intake_classifier_rules']['Row']
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
    .select('id, name, email, role, timezone, notification_prefs, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

async function loadEnabledClassifierRules(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from('intake_classifier_rules')
    .select(
      'id, rule_name, description, match_field, match_type, pattern, suggested_content_type, suggested_confidence, marks_peter, priority'
    )
    .eq('is_enabled', true)
    .order('priority', { ascending: false })

  if (error) throw new Error(error.message)
  return toClassifierRules((data ?? []) as ClassifierRuleRow[])
}

function buildCorrectedClassifierMetadata({
  senderName,
  previousType,
  nextType,
  promotedRuleId,
}: {
  senderName: string
  previousType: IntakeContentType
  nextType: IntakeContentType
  promotedRuleId?: string | null
}) {
  const reasoning: PersistedClassifierReason[] = [
    {
      ruleId: 'manual:coordinator-correction',
      label: 'Coordinator correction',
      evidence: `Updated from ${CONTENT_TYPE_META[previousType].label} to ${CONTENT_TYPE_META[nextType].label}.`,
      effect: 'type' as const,
    },
  ]

  if (isPeterKapiteinSignal(senderName)) {
    reasoning.unshift({
      ruleId: 'manual:founder-preserved',
      label: 'Founder signal preserved',
      evidence: senderName,
      effect: 'founder_signal' as const,
    })
  }

  return {
    classifierVersion: `${COMMS_CLASSIFIER_VERSION}:manual-correction`,
    classifierReasoning: reasoning,
    classifierRuleIds: promotedRuleId ? ['manual:coordinator-correction', promotedRuleId] : ['manual:coordinator-correction'],
    isPeterKapitein: isPeterKapiteinSignal(senderName),
  }
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
    mediaRecoveryRequestId,
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
    mediaRecoveryRequestId?: string | null
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
      .select('id, name, start_date, notes, organiser, location_city, location_country, initiative_ids, is_annual_congress, event_type')
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
          event_type: normalizeEventType(draft.eventType || current?.event_type || 'conference'),
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
        event_type: normalizeEventType(draft.eventType || 'conference'),
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

  if ((item.content_type as IntakeContentType) === 'media_request') {
    if (mediaRecoveryRequestId) {
      const { data: request, error: requestError } = await sb
        .from('media_recovery_requests')
        .select('id, title, requested_by')
        .eq('id', mediaRecoveryRequestId)
        .maybeSingle()

      if (requestError) throw new Error(requestError.message)
      if (!request) throw new Error('Selected recovery request was not found.')

      const { data: offer, error: offerError } = await sb
        .from('media_recovery_offers')
        .insert({
          recovery_request_id: request.id,
          intake_item_id: item.id,
          offered_by: item.sender_name,
          notes: item.raw_content,
          sharepoint_url: item.attached_media_ref || item.source_url,
        })
        .select('id')
        .maybeSingle()

      if (offerError) throw new Error(offerError.message)

      const recipientIds = request.requested_by
        ? [request.requested_by]
        : (
            await sb
              .from('profiles')
              .select('id, role, comms_team, user_type')
          ).data
            ?.filter(
              (profile) =>
                canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)
            )
            .map((profile) => profile.id) ?? []

      if (recipientIds.length > 0) {
        const { error: notificationError } = await sb.from('notifications').insert(
          recipientIds.map((recipientId) => ({
            user_id: recipientId,
            type: 'media_recovery_offer',
            title: `New media offer for ${request.title}`,
            body: `${item.sender_name} added a new offer to an open media recovery request.`,
            is_read: false,
            link_url: '/app/comms/media',
          }))
        )

        if (notificationError) throw new Error(notificationError.message)
      }

      return { routedToId: request.id, routedToType: 'media_asset', offerId: offer?.id ?? null }
    }

    const { data: request, error: requestError } = await sb
      .from('media_recovery_requests')
      .insert({
        title: titleOverride || buildRecoveryTitle(item.raw_content, item.sender_name),
        summary: item.raw_content,
        request_intake_id: item.id,
        requested_by: userId,
        initiative_id: linkedInitiativeId,
      })
      .select('id')
      .maybeSingle()

    if (requestError) throw new Error(requestError.message)
    return { routedToId: request?.id ?? null, routedToType: 'media_asset' }
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
      classifier_version: COMMS_CLASSIFIER_VERSION,
      classifier_status: 'manual',
      classifier_reasoning: [
        {
          ruleId: 'manual:coordinator-entry',
          label: 'Manual coordinator classification',
          evidence: 'Captured directly by the communications team.',
          effect: 'type',
        },
      ],
      classifier_rule_ids: ['manual:coordinator-entry'],
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
    const mediaRecoveryRequestId = asText(formData.get('media_recovery_request_id')) || null

    if (!intakeItemId || !requestedDestination) {
      return { ok: false, error: 'Item and destination are required.' }
    }

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select(
        'id, capture_method, captured_at, classifier_reasoning, classifier_rule_ids, classifier_status, classifier_version, classification_confidence, content_type, created_at, dismissed_reason, attached_media_ref, is_peter_kapitein, provider_message_id, raw_content, reviewed_at, reviewed_by, routed_to_id, routed_to_type, sender_name, sender_whatsapp_id, source_url, status'
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
      eventType: normalizeEventType(asText(formData.get('event_type')) || parsedEventDraft.eventType),
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
      mediaRecoveryRequestId,
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
    revalidatePath('/app/comms/media')
    revalidatePath('/app/notifications')
    if (route.routedToType === 'event' && route.routedToId) revalidatePath(`/app/comms/events/${route.routedToId}`)
    if (route.routedToType === 'campus_member' && route.routedToId) {
      revalidatePath(`/app/comms/campus-log/members/${route.routedToId}`)
    }
    if (route.routedToType === 'media_asset' && route.routedToId) {
      revalidatePath(`/app/comms/media/${route.routedToId}`)
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
    const promoteAsRule = asText(formData.get('promote_as_sender_rule')) === 'true'

    if (!intakeItemId || !nextType) {
      return { ok: false, error: 'Item and updated content type are required.' }
    }

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select(
        'id, sender_name, raw_content, content_type, classifier_version, classifier_reasoning, classification_confidence'
      )
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    let promotedRuleId: string | null = null

    if (item.content_type !== nextType) {
      const { data: correction, error: logError } = await supabase
        .from('intake_classification_corrections')
        .insert({
          intake_item_id: intakeItemId,
          previous_content_type: item.content_type,
          corrected_content_type: nextType,
          corrected_by: user.id,
        })
        .select('id')
        .maybeSingle()
      if (logError) throw new Error(logError.message)

      const { error: exampleError } = await supabase.from('intake_classifier_training_examples').insert({
        intake_item_id: intakeItemId,
        correction_id: correction?.id ?? null,
        sender_name: item.sender_name,
        raw_content: item.raw_content,
        previous_content_type: item.content_type,
        corrected_content_type: nextType,
        classifier_snapshot: {
          classifierVersion: item.classifier_version,
          reasoning: item.classifier_reasoning,
          previousConfidence: item.classification_confidence,
        },
        created_by: user.id,
      })
      if (exampleError) throw new Error(exampleError.message)

      if (promoteAsRule) {
        const { data: rule, error: ruleError } = await supabase
          .from('intake_classifier_rules')
          .insert({
            rule_name: `Sender rule: ${item.sender_name}`,
            description: 'Promoted from a coordinator correction in the intake queue.',
            match_field: 'sender_name',
            match_type: 'exact',
            pattern: item.sender_name,
            suggested_content_type: nextType,
            suggested_confidence: 'high',
            marks_peter: isPeterKapiteinSignal(item.sender_name),
            priority: 280,
            created_from_correction_id: correction?.id ?? null,
            created_by: user.id,
          })
          .select('id')
          .maybeSingle()
        if (ruleError) throw new Error(ruleError.message)
        promotedRuleId = rule?.id ?? null
      }
    }

    const correctedMetadata = buildCorrectedClassifierMetadata({
      senderName: item.sender_name,
      previousType: item.content_type as IntakeContentType,
      nextType,
      promotedRuleId,
    })

    const { error: updateError } = await supabase
      .from('intake_items')
      .update({
        content_type: nextType,
        classification_confidence: 'high',
        is_peter_kapitein: correctedMetadata.isPeterKapitein,
        classifier_version: correctedMetadata.classifierVersion,
        classifier_status: 'corrected',
        classifier_reasoning: correctedMetadata.classifierReasoning,
        classifier_rule_ids: correctedMetadata.classifierRuleIds,
      })
      .eq('id', intakeItemId)

    if (updateError) throw new Error(updateError.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'Classification updated.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update classification.' }
  }
}

export async function replayIntakeClassification(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))

    if (!intakeItemId) return { ok: false, error: 'Item is required.' }

    const { data: item, error: loadError } = await supabase
      .from('intake_items')
      .select('id, sender_name, raw_content, source_url, attached_media_ref')
      .eq('id', intakeItemId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!item) throw new Error('Intake item not found.')

    const rules = await loadEnabledClassifierRules(supabase)
    const result = classifyIntakeItem(
      {
        senderName: item.sender_name,
        rawContent: item.raw_content,
        sourceUrl: item.source_url,
        attachedMediaRef: item.attached_media_ref,
      },
      rules
    )

    const { error: updateError } = await supabase
      .from('intake_items')
      .update({
        content_type: result.contentType,
        classification_confidence: result.confidence,
        is_peter_kapitein: result.isPeterKapitein,
        classifier_version: result.classifierVersion,
        classifier_status: 'replayed',
        classifier_reasoning: result.reasoning,
        classifier_rule_ids: result.matchedRuleIds,
      })
      .eq('id', intakeItemId)

    if (updateError) throw new Error(updateError.message)

    revalidatePath('/app/comms/intake')
    return { ok: true, message: 'Classifier replayed.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not replay classifier.' }
  }
}

export async function dismissIntakeItem(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))
    const dismissedReason = asText(formData.get('dismissed_reason')) || 'Marked as miscellaneous'

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

    revalidateIntakeSurfaces(safeCommsReturnPath(formData))
    return { ok: true, message: 'Item moved to the 90-day archive.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not dismiss intake item.' }
  }
}

export async function markIntakeReviewed(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))

    if (!intakeItemId) return { ok: false, error: 'Item is required.' }

    const { error } = await supabase
      .from('intake_items')
      .update({
        status: 'reviewed',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', intakeItemId)

    if (error) throw new Error(error.message)

    revalidateIntakeSurfaces(safeCommsReturnPath(formData))
    return { ok: true, message: 'Item marked as reviewed.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not mark item as reviewed.' }
  }
}

export async function deleteIntakeItem(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { supabase } = await requireCommsOperator()
    const intakeItemId = asText(formData.get('intake_item_id'))

    if (!intakeItemId) return { ok: false, error: 'Item is required.' }

    const { error } = await supabase
      .from('intake_items')
      .delete()
      .eq('id', intakeItemId)

    if (error) throw new Error(error.message)

    revalidateIntakeSurfaces(safeCommsReturnPath(formData))
    return { ok: true, message: 'Item deleted.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete item.' }
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
