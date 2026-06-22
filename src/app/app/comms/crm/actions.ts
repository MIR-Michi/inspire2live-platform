'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { normalizeRole } from '@/lib/role-access'
import { inviteUserAccount } from '@/app/app/admin/users/actions'
import {
  isInternalEmail,
  normalizeContactKind,
  normalizeCrmConsent,
  normalizeCrmInteractionType,
  normalizeCrmLifecycle,
  normalizeCrmPersonType,
  normalizeEmail,
  parseCrmList,
  segmentFromKind,
  type CrmContactKind,
  type CrmSourceType,
} from '@/lib/comms-crm'
import {
  fallbackNameFromEmail,
  mapCsvToContactRows,
  resolveImportKind,
  type CrmImportResult,
  type CrmImportRow,
} from '@/lib/comms-crm-import'
import { ROLE_LABELS } from '@/lib/role-access'

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
  const email = asNullableText(formData.get('email'))
  const eventRelationshipType = asText(formData.get('event_relationship_type')) || 'related'

  if (!fullName) throw new Error('Contact name is required.')

  // Derive the contact kind server-side so the rules can never be bypassed from
  // the form. A row sourced from a platform profile is always internal_user.
  // Otherwise an Inspire2Live email is ALWAYS internal (an internal_contact who
  // is not yet a platform user and needs a separate invitation) — never external,
  // even if the form submitted 'external'. Everything else honours the chosen
  // kind, defaulting to external. The segment is always derived from the kind so
  // the two can never drift apart.
  const isProfileSourced = sourceType === 'profile' && Boolean(sourceId)
  const contactKind: CrmContactKind = isProfileSourced
    ? 'internal_user'
    : isInternalEmail(email)
      ? 'internal_contact'
      : normalizeContactKind(asText(formData.get('contact_kind'))) ?? 'external'
  const segment = segmentFromKind(contactKind)

  // Internal people are owned by their platform profile. Their core identity is
  // edited only by the person themselves (via Profile & settings) and must never
  // be overwritten from the CRM, so we persist only the relationship fields here
  // and leave the core columns empty — the directory always reads core identity
  // live from the profile. (full_name is NOT NULL, so we mirror the profile's.)
  const isInternalProfile = isProfileSourced
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
    // Link the platform profile when this row is sourced from one — the trigger
    // then keeps contact_kind = internal_user and the segment derived.
    profile_id: sourceType === 'profile' ? sourceId : null,
    contact_kind: contactKind,
    // Optional, nullable planning hint: the platform role ("user type") to apply
    // if/when this contact is invited. Does not change kind or platform_status.
    intended_role: asNullableText(formData.get('intended_role')),
    full_name: fullName,
    person_type: normalizeCrmPersonType(asText(formData.get('person_type'))),
    field_of_expertise: parseCrmList(asText(formData.get('field_of_expertise'))),
    skills: parseCrmList(asText(formData.get('skills'))),
    picture_url: asNullableText(formData.get('picture_url')),
    bio: asNullableText(formData.get('bio')),
    title: asNullableText(formData.get('title')),
    organisation: asNullableText(formData.get('organisation')),
    email,
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

/**
 * Deletes an external contact from the CRM. Restricted to platform admins.
 * Handles both shapes shown in the directory:
 *   - a dedicated CRM row (comms_crm_contacts) — deletes it; FKs cascade to its
 *     links, interactions and pipeline memberships;
 *   - a campus stakeholder record (campus_members) with no CRM row yet —
 *     deletes the campus member.
 * Internal people are owned by their platform profile and are never deletable.
 *
 * Deleting a contact also removes the same person from the rest of the platform
 * — currently the New Members onboarding list (member_onboarding) — so a contact
 * never lingers somewhere after being deleted in the CRM. Platform-user
 * onboarding rows (profile_id set) are left to the profile-deletion cascade.
 */
export async function deleteCrmContact(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (normalizeRole(profile?.role) !== 'PlatformAdmin') {
    throw new Error('Only platform admins can delete contacts.')
  }

  const contactId = asText(formData.get('crm_contact_id'))
  const sourceType = normalizeSourceType(asText(formData.get('source_type')))
  const sourceId = asNullableText(formData.get('source_id'))

  // Platform users are managed via their profile.
  if (sourceType === 'profile') {
    throw new Error('Platform users are managed via their profile and cannot be deleted here.')
  }

  const crmSupabase = supabase as unknown as CrmTableClient
  let deleted = false
  // Identity used to find the same person elsewhere on the platform.
  let contactEmail: string | null = null
  let contactName: string | null = null
  // Direct link to the New Members onboarding record, when one is set.
  let memberOnboardingId: string | null = null

  // 1. Delete the dedicated CRM row, if there is one (anything but a platform user).
  if (contactId) {
    const { data: existing, error: readError } = await crmSupabase
      .from('comms_crm_contacts')
      .select('id, contact_kind, profile_id, email, full_name, member_onboarding_id')
      .eq('id', contactId)
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (existing) {
      if (existing.contact_kind === 'internal_user' || existing.profile_id) {
        throw new Error('Platform users cannot be deleted from the CRM.')
      }
      contactEmail = existing.email ?? null
      contactName = existing.full_name ?? null
      memberOnboardingId = existing.member_onboarding_id ?? null
      const { error } = await crmSupabase.from('comms_crm_contacts').delete().eq('id', contactId)
      if (error) throw new Error(error.message)
      deleted = true
    }
  }

  // 2. Delete the underlying campus stakeholder record, if this came from one.
  if (sourceType === 'campus_member' && sourceId) {
    const { data: campusMember } = await crmSupabase
      .from('campus_members')
      .select('name')
      .eq('id', sourceId)
      .maybeSingle()
    contactName = contactName ?? campusMember?.name ?? null
    const { error } = await crmSupabase.from('campus_members').delete().eq('id', sourceId)
    if (error) throw new Error(error.message)
    deleted = true
  }

  if (!deleted) throw new Error('Nothing to delete for this contact.')

  // 3. Cascade to the New Members onboarding list so the deleted person does not
  //    linger there. Only ever touch records not tied to a platform profile —
  //    profile-linked rows belong to actual users and cascade with the profile.
  //    Prefer the explicit member_onboarding_id link recorded on the spine; fall
  //    back to matching on email (case-insensitively, since onboarding emails are
  //    stored as free text) or, lacking an email, the exact name. This also
  //    catches records that were never linked (e.g. campus members).
  if (memberOnboardingId) {
    const { error } = await crmSupabase
      .from('member_onboarding')
      .delete()
      .is('profile_id', null)
      .eq('id', memberOnboardingId)
    if (error) throw new Error(error.message)
  }

  const normalizedEmail = normalizeEmail(contactEmail)
  if (normalizedEmail) {
    const { error } = await crmSupabase
      .from('member_onboarding')
      .delete()
      .is('profile_id', null)
      .ilike('email', normalizedEmail)
    if (error) throw new Error(error.message)
  } else if (contactName) {
    const { error } = await crmSupabase
      .from('member_onboarding')
      .delete()
      .is('profile_id', null)
      .is('email', null)
      .eq('full_name', contactName)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
  revalidatePath('/app/comms/dashboard')
}

/**
 * Promotes a contact (internal_contact or external) to a platform user — the
 * ONLY path that creates an internal_user. Sends a User-Management invite with
 * the chosen role ("user type") and records the pending state on the spine. The
 * profile-creation trigger links the new profile back onto the same contact, so
 * no duplicate is created. Restricted to platform admins.
 */
export async function inviteContactToPlatform(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (normalizeRole(profile?.role) !== 'PlatformAdmin') {
    throw new Error('Only platform admins can invite contacts to the platform.')
  }

  const email = asText(formData.get('email')).toLowerCase()
  const role = asText(formData.get('role'))
  const origin = asText(formData.get('origin'))
  const contactId = asText(formData.get('crm_contact_id'))

  if (!email) throw new Error('This contact has no email address to invite.')
  const inviteRole = role in ROLE_LABELS ? role : 'PatientAdvocate'

  const { error } = await inviteUserAccount(email, inviteRole, origin)
  if (error) throw new Error(error)

  // Record intent + pending state on the spine. Idempotent with the trigger.
  if (contactId) {
    const crmSupabase = supabase as unknown as CrmTableClient
    const { error: updateError } = await crmSupabase
      .from('comms_crm_contacts')
      .update({
        intended_role: inviteRole,
        platform_status: 'invited',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
    if (updateError) throw new Error(updateError.message)
  }

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
  revalidatePath('/app/admin/users')
}

/**
 * Builds the upsert payload for one imported row. Only fields the CSV actually
 * carried (non-empty) are written, so importing never blanks out existing data
 * on update. `contact_kind` + `segment` are always set from the resolved kind.
 */
function buildImportPayload(
  row: CrmImportRow,
  fullName: string | null,
  kind: CrmContactKind,
  userId: string,
  now: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    contact_kind: kind,
    segment: segmentFromKind(kind),
    source_type: 'manual',
    email: row.email,
    updated_by: userId,
    updated_at: now,
  }

  const setIf = (key: string, value: string | null) => {
    if (value !== null && value !== '') payload[key] = value
  }

  setIf('full_name', fullName)
  setIf('title', row.title)
  setIf('organisation', row.organisation)
  setIf('phone', row.phone)
  setIf('city', row.city)
  setIf('country', row.country)
  setIf('preferred_channel', row.preferredChannel)
  setIf('bio', row.bio)
  setIf('notes', row.notes)
  setIf('person_type', row.personType)
  setIf('intended_role', row.intendedRole)
  if (row.tags.length > 0) payload.tags = row.tags

  return payload
}

/**
 * Bulk-imports CRM contacts from CSV text. Email is the identifier: a row whose
 * email already exists updates that contact (a merge — only supplied fields are
 * written), otherwise a new contact is created. Inspire2Live emails are always
 * internal_contact. Existing platform users are never overwritten. Returns a
 * per-run summary (created / updated / skipped + row-level errors) for display.
 */
export async function importCrmContacts(csv: string): Promise<CrmImportResult> {
  const { supabase, user } = await requireCommsOperator()
  const crmSupabase = supabase as unknown as CrmTableClient

  const { rows, errors: parseErrors, totalDataRows } = mapCsvToContactRows(csv ?? '')
  const errors = [...parseErrors]
  let created = 0
  let updated = 0
  let skipped = 0

  if (rows.length === 0) {
    return { created, updated, skipped, errors, totalRows: totalDataRows }
  }

  // Email is the identity: resolve every existing contact for the file's emails
  // in a single lookup so each row becomes a deterministic update-or-insert.
  const emails = rows.map((row) => row.email)
  const { data: existingRows, error: lookupError } = await crmSupabase
    .from('comms_crm_contacts')
    .select('id, normalized_email, contact_kind, profile_id')
    .in('normalized_email', emails)
  if (lookupError) throw new Error(lookupError.message)

  const existingByEmail = new Map<
    string,
    { id: string; contact_kind: string | null; profile_id: string | null }
  >()
  for (const existing of existingRows ?? []) {
    if (existing.normalized_email) existingByEmail.set(existing.normalized_email, existing)
  }

  const now = new Date().toISOString()

  for (const row of rows) {
    const existing = existingByEmail.get(row.email)

    try {
      if (existing) {
        // Platform users are owned by their profile and must never be rewritten
        // from a CSV — skip them with a clear note.
        if (existing.profile_id || existing.contact_kind === 'internal_user') {
          skipped++
          errors.push({
            line: row.line,
            email: row.email,
            message: 'Existing platform user — managed via their profile, not updated.',
          })
          continue
        }

        const kind = resolveImportKind(row.email, row.contactKind, normalizeContactKind(existing.contact_kind))
        const payload = buildImportPayload(row, row.fullName, kind, user.id, now)
        const { error } = await crmSupabase.from('comms_crm_contacts').update(payload).eq('id', existing.id)
        if (error) throw new Error(error.message)
        updated++
      } else {
        const kind = resolveImportKind(row.email, row.contactKind, null)
        const fullName = row.fullName ?? fallbackNameFromEmail(row.email)
        const payload = buildImportPayload(row, fullName, kind, user.id, now)
        const { error } = await crmSupabase
          .from('comms_crm_contacts')
          .insert({ ...payload, source_label: 'CSV import', created_by: user.id })
        if (error) throw new Error(error.message)
        created++
      }
    } catch (rowError) {
      skipped++
      errors.push({
        line: row.line,
        email: row.email,
        message: rowError instanceof Error ? rowError.message : 'Failed to save this row.',
      })
    }
  }

  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')
  return { created, updated, skipped, errors, totalRows: totalDataRows }
}
