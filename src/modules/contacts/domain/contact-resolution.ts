import 'server-only'

/**
 * contacts/domain/contact-resolution.ts — `resolveContact`, the component's
 * find-or-create entry point for other components.
 *
 * The manifest has declared `provides.api: [..., 'resolveContact']` since the
 * component was scaffolded, and `index.ts` exported nothing but the manifest —
 * so the one contract another component was promised did not exist. Anybody who
 * needed a contact therefore wrote their own insert: `saveCrmContact` matches on
 * `(source_type, source_id)` and never on a person, the three pipeline paths
 * match on nothing at all, and `events` has its own resolver because the same
 * thing had already been written three ways. This is the version other
 * components call.
 *
 * It differs from `events`' resolver in the one way that matters here: it does
 * not require a way to reach the person. A directory person retrieved from a
 * scholarly catalogue has a name, a role and a citation and — by ADR-0016 — no
 * contact detail at all, so an email-or-nothing rule would refuse exactly the
 * records this exists to promote.
 */

import { createClient } from '@/kernel/data/server'
import {
  deriveContactKind,
  normalizeCrmPersonType,
  normalizeEmail,
  segmentFromKind,
  type CrmContactLinkKind,
  type CrmPersonType,
} from '@/modules/contacts/domain/comms-crm'

export type ContactLinkInput = {
  kind: CrmContactLinkKind
  label: string
  url: string
}

export type ResolveContactInput = {
  fullName: string
  email?: string | null
  title?: string | null
  organisation?: string | null
  country?: string | null
  /** Free-text classification; anything unrecognised is stored as unclassified. */
  personType?: string | null
  fieldOfExpertise?: string[]
  tags?: string[]
  bio?: string | null
  notes?: string | null
  /** Shown in the CRM as provenance. Applied only when a row is created. */
  sourceLabel?: string
  links?: ContactLinkInput[]
}

export type ResolvedContact = {
  contactId: string
  /** False when an existing contact was reused, whatever it was matched on. */
  created: boolean
  matchedOn: 'email' | 'name_and_organisation' | 'name' | null
}

/** The subset of a contact row the matcher needs. */
export type ContactCandidate = {
  id: string
  full_name: string | null
  organisation: string | null
  normalized_email: string | null
}

function fold(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Decide whether one of the existing contacts is already this person.
 *
 * Pure, and separated from the query because this is the whole risk of the
 * feature: a false match silently merges two people's histories, and a missed
 * one leaves a duplicate somebody has to reconcile by hand.
 *
 * Email is the only identifier the database itself trusts — there is a partial
 * unique index on `normalized_email` — so it wins outright. Below that the
 * matcher only acts on evidence it can defend: an exact name *and* organisation,
 * or a name that is unique in the whole CRM. Two contacts called "Maria Silva"
 * and neither carrying the organisation we hold is not a match; it is a question
 * nobody has answered, and inserting a third row states that honestly rather
 * than guessing which of them just acquired a publication history.
 */
export function matchExistingContact(
  candidates: ContactCandidate[],
  wanted: { fullName: string; email?: string | null; organisation?: string | null },
): { id: string; matchedOn: NonNullable<ResolvedContact['matchedOn']> } | null {
  const email = normalizeEmail(wanted.email)
  if (email) {
    const byEmail = candidates.find((c) => c.normalized_email === email)
    if (byEmail) return { id: byEmail.id, matchedOn: 'email' }
  }

  const name = fold(wanted.fullName)
  if (!name) return null

  const organisation = fold(wanted.organisation)
  if (organisation) {
    const byBoth = candidates.find(
      (c) => fold(c.full_name) === name && fold(c.organisation) === organisation,
    )
    if (byBoth) return { id: byBoth.id, matchedOn: 'name_and_organisation' }
  }

  const sameName = candidates.filter((c) => fold(c.full_name) === name)
  if (sameName.length === 1) return { id: sameName[0].id, matchedOn: 'name' }

  return null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type CrmClient = {
  from: (table: string) => {
    select: (...args: unknown[]) => any
    insert: (...args: unknown[]) => any
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Find this person in the CRM, or create them.
 *
 * Throws on a hard failure (the caller converts to its own result shape), and
 * runs under the caller's session so RLS decides whether they may write — the
 * `comms_crm_*` policies already restrict this to the comms team and admins.
 */
export async function resolveContact(input: ResolveContactInput): Promise<ResolvedContact> {
  const fullName = input.fullName?.trim()
  if (!fullName) throw new Error('A name is required to create a contact.')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  const db = supabase as unknown as CrmClient
  const email = normalizeEmail(input.email)
  const organisation = input.organisation?.trim() || null

  // Two narrow lookups rather than one `or(...)`: a name containing a comma or
  // a bracket would have to be escaped into PostgREST's filter grammar, and a
  // mangled name fails silently — as a duplicate contact, which is the outcome
  // this function exists to prevent.
  if (email) {
    const { data: byEmail, error } = await db
      .from('comms_crm_contacts')
      .select('id')
      .eq('normalized_email', email)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (byEmail?.id) return { contactId: byEmail.id as string, created: false, matchedOn: 'email' }
  }

  const { data: sameName, error: readError } = await db
    .from('comms_crm_contacts')
    .select('id, full_name, organisation, normalized_email')
    .ilike('full_name', fullName.replace(/[%_]/g, '\\$&'))
  if (readError) throw new Error(readError.message)

  const match = matchExistingContact((sameName ?? []) as ContactCandidate[], {
    fullName,
    email,
    organisation,
  })
  if (match) return { contactId: match.id, created: false, matchedOn: match.matchedOn }

  const contactKind = deriveContactKind({ email })
  const personType: CrmPersonType | null = normalizeCrmPersonType(input.personType)

  const { data: created, error: insertError } = await db
    .from('comms_crm_contacts')
    .insert({
      full_name: fullName,
      email,
      title: input.title?.trim() || null,
      organisation,
      country: input.country?.trim() || null,
      person_type: personType,
      field_of_expertise: input.fieldOfExpertise ?? [],
      tags: input.tags ?? [],
      bio: input.bio?.trim() || null,
      notes: input.notes?.trim() || null,
      contact_kind: contactKind,
      segment: segmentFromKind(contactKind),
      platform_status: 'none',
      source_type: 'manual',
      source_label: input.sourceLabel ?? 'Added from the platform',
      lifecycle_stage: 'nurture',
      // Nothing about being findable in a public catalogue is consent to be
      // contacted, and the CRM should not imply otherwise.
      consent_status: 'unknown',
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .maybeSingle()
  if (insertError) throw new Error(insertError.message)
  if (!created?.id) throw new Error('Could not create the contact.')

  const links = (input.links ?? []).filter((link) => link.url?.trim())
  if (links.length > 0) {
    const { error: linkError } = await db.from('comms_crm_contact_links').insert(
      links.map((link) => ({
        contact_id: created.id,
        kind: link.kind,
        label: link.label,
        url: link.url.trim(),
      })),
    )
    // The contact exists and is the point; a failed link list is reported by
    // the console rather than by throwing away a successful creation.
    if (linkError) console.error('[contacts] contact links failed:', linkError.message)
  }

  return { contactId: created.id as string, created: true, matchedOn: null }
}
