'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  normalizeCrmConsent,
  normalizeCrmInteractionType,
  normalizeCrmLifecycle,
  normalizeCrmPersonType,
  parseCrmList,
  type CrmSegment,
  type CrmSourceType,
} from '@/lib/comms-crm'

type CrmTableClient = {
  from: (table: string) => {
    // The comms_crm_* tables are not yet present in the generated Database types,
    // so the query builder chain is typed loosely here.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    select: (...args: unknown[]) => any
    insert: (...args: unknown[]) => any
    update: (...args: unknown[]) => any
    delete: (...args: unknown[]) => any
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: FormDataEntryValue | null) {
  const text = asText(value)
  return text || null
}

function parseValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function normalizeSegment(value: string): CrmSegment {
  return value === 'internal' ? 'internal' : 'external'
}

function normalizeSourceType(value: string): CrmSourceType {
  if (value === 'profile' || value === 'campus_member') return value
  return 'manual'
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

  return { supabase, user }
}

async function replaceContactLinks(
  supabase: CrmTableClient,
  contactId: string,
  initiativeIds: string[],
  eventIds: string[],
  eventRelationshipType: string
) {
  const uniqueInitiativeIds = Array.from(new Set(initiativeIds))
  const uniqueEventIds = Array.from(new Set(eventIds))

  const [{ error: initiativeDeleteError }, { error: eventDeleteError }] = await Promise.all([
    supabase.from('comms_crm_contact_initiatives').delete().eq('contact_id', contactId),
    supabase.from('comms_crm_contact_events').delete().eq('contact_id', contactId),
  ])
  if (initiativeDeleteError) throw new Error(initiativeDeleteError.message)
  if (eventDeleteError) throw new Error(eventDeleteError.message)

  if (uniqueInitiativeIds.length > 0) {
    const { error } = await supabase.from('comms_crm_contact_initiatives').insert(
      uniqueInitiativeIds.map((initiativeId) => ({
        contact_id: contactId,
        initiative_id: initiativeId,
        relationship_label: 'Associated project',
      }))
    )
    if (error) throw new Error(error.message)
  }

  if (uniqueEventIds.length > 0) {
    const { error } = await supabase.from('comms_crm_contact_events').insert(
      uniqueEventIds.map((eventId) => ({
        contact_id: contactId,
        event_id: eventId,
        relationship_type: eventRelationshipType,
      }))
    )
    if (error) throw new Error(error.message)
  }
}

export async function saveCrmContact(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const contactId = asText(formData.get('crm_contact_id'))
  const sourceType = normalizeSourceType(asText(formData.get('source_type')))
  const sourceId = asNullableText(formData.get('source_id'))
  const fullName = asText(formData.get('full_name'))
  const segment = normalizeSegment(asText(formData.get('segment')))
  const eventRelationshipType = asText(formData.get('event_relationship_type')) || 'related'

  if (!fullName) throw new Error('Contact name is required.')

  // Internal people are owned by their platform profile. Their core identity is
  // edited only by the person themselves (via Profile & settings) and must never
  // be overwritten from the CRM, so we persist only the relationship fields here
  // and leave the core columns empty — the directory always reads core identity
  // live from the profile. (full_name is NOT NULL, so we mirror the profile's.)
  const isInternalProfile = segment === 'internal' && sourceType === 'profile' && Boolean(sourceId)
  let resolvedFullName = fullName
  if (isInternalProfile && sourceId) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', sourceId)
      .maybeSingle()
    resolvedFullName = ownerProfile?.name ?? fullName
  }

  const payload = {
    segment,
    source_type: sourceType,
    source_id: sourceId,
    full_name: fullName,
    person_type: normalizeCrmPersonType(asText(formData.get('person_type'))),
    field_of_expertise: parseCrmList(asText(formData.get('field_of_expertise'))),
    skills: parseCrmList(asText(formData.get('skills'))),
    picture_url: asNullableText(formData.get('picture_url')),
    bio: asNullableText(formData.get('bio')),
    title: asNullableText(formData.get('title')),
    organisation: asNullableText(formData.get('organisation')),
    email: asNullableText(formData.get('email')),
    phone: asNullableText(formData.get('phone')),
    city: asNullableText(formData.get('city')),
    country: asNullableText(formData.get('country')),
    preferred_channel: asNullableText(formData.get('preferred_channel')),
    relationship_owner_id: asNullableText(formData.get('relationship_owner_id')),
    relationship_owner_label: asNullableText(formData.get('relationship_owner_label')),
    lifecycle_stage: normalizeCrmLifecycle(asText(formData.get('lifecycle_stage'))),
    last_interaction_at: asNullableText(formData.get('last_interaction_at')),
    next_follow_up_at: asNullableText(formData.get('next_follow_up_at')),
    consent_status: normalizeCrmConsent(asText(formData.get('consent_status'))),
    privacy_notes: asNullableText(formData.get('privacy_notes')),
    retention_review_at: asNullableText(formData.get('retention_review_at')),
    source_label: asNullableText(formData.get('source_label')),
    tags: parseCrmList(asText(formData.get('tags'))),
    notes: asNullableText(formData.get('notes')),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (isInternalProfile) {
    // Strip core identity — it lives on the profile, not the CRM row.
    payload.full_name = resolvedFullName
    payload.segment = 'internal'
    payload.picture_url = null
    payload.bio = null
    payload.title = null
    payload.organisation = null
    payload.email = null
    payload.city = null
    payload.country = null
    payload.field_of_expertise = []
    payload.skills = []
  }

  let resolvedContactId = contactId

  if (resolvedContactId) {
    const { error } = await crmSupabase.from('comms_crm_contacts').update(payload).eq('id', resolvedContactId)
    if (error) throw new Error(error.message)
  } else {
    const existingBySource = sourceId
      ? await crmSupabase
          .from('comms_crm_contacts')
          .select('id')
          .eq('source_type', sourceType)
          .eq('source_id', sourceId)
          .maybeSingle()
      : { data: null, error: null }

    if (existingBySource.error) throw new Error(existingBySource.error.message)

    if (existingBySource.data?.id) {
      resolvedContactId = existingBySource.data.id
      const { error } = await crmSupabase.from('comms_crm_contacts').update(payload).eq('id', resolvedContactId)
      if (error) throw new Error(error.message)
    } else {
      const { data, error } = await crmSupabase
        .from('comms_crm_contacts')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .maybeSingle()
      if (error) throw new Error(error.message)
      resolvedContactId = data?.id ?? ''
    }
  }

  if (!resolvedContactId) throw new Error('Unable to save CRM contact.')

  await replaceContactLinks(
    crmSupabase,
    resolvedContactId,
    parseValues(formData, 'initiative_ids'),
    parseValues(formData, 'event_ids'),
    eventRelationshipType
  )

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
}

export async function addCrmInteraction(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const contactId = asText(formData.get('crm_contact_id'))
  const summary = asText(formData.get('summary'))
  const nextFollowUpAt = asNullableText(formData.get('next_follow_up_at'))

  if (!contactId || !summary) throw new Error('Contact and interaction summary are required.')

  const occurredAt = asNullableText(formData.get('occurred_at')) ?? new Date().toISOString()
  const interactionType = normalizeCrmInteractionType(asText(formData.get('interaction_type')))

  const { error } = await crmSupabase.from('comms_crm_interactions').insert({
    contact_id: contactId,
    interaction_type: interactionType,
    summary,
    occurred_at: occurredAt,
    next_follow_up_at: nextFollowUpAt,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  const { error: updateError } = await crmSupabase
    .from('comms_crm_contacts')
    .update({
      last_interaction_at: occurredAt,
      next_follow_up_at: nextFollowUpAt,
      lifecycle_stage: nextFollowUpAt ? 'follow_up' : 'active',
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
  if (updateError) throw new Error(updateError.message)

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
}

export async function markCrmFollowUpDone(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient
  const contactId = asText(formData.get('crm_contact_id'))
  if (!contactId) throw new Error('Contact is required.')

  const now = new Date().toISOString()
  const { error } = await crmSupabase
    .from('comms_crm_contacts')
    .update({
      lifecycle_stage: 'active',
      last_interaction_at: now,
      next_follow_up_at: null,
      updated_by: user.id,
      updated_at: now,
    })
    .eq('id', contactId)
  if (error) throw new Error(error.message)

  const { error: interactionError } = await crmSupabase.from('comms_crm_interactions').insert({
    contact_id: contactId,
    interaction_type: 'follow_up',
    summary: 'Follow-up marked complete.',
    occurred_at: now,
    created_by: user.id,
  })
  if (interactionError) throw new Error(interactionError.message)

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
}
