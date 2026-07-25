'use server'

/**
 * network/domain/actions.ts — writes for the relationship graph.
 *
 * This file is the *only* write path into this component's tables (ADR-0009 §9
 * rule 3). Other components hold soft references to `network_people` and must
 * come through here, which is what keeps referential integrity honest without a
 * cross-component foreign key.
 *
 * Two product rules are enforced here rather than in the UI, because a rule that
 * only exists in a form is not a rule:
 *  - a connection becomes `confirmed` only from a human answer;
 *  - an introducer inside their cooldown window cannot be asked again.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import type { NetworkDatabase } from '@/modules/network/domain/schema'
import type {
  ActionResult,
  AffiliationKind,
  ConnectionCheckAnswer,
  IntroductionOutcome,
  IntroductionResponse,
  NetworkPerson,
  PersonInput,
} from '@/modules/network/domain/types'
import {
  CONNECTION_STRENGTH,
  connectionTypeForAnswer,
} from '@/modules/network/domain/connection-strength'
import { suggestConnections } from '@/modules/network/domain/affiliation-overlap'
import { canRequestIntroduction } from '@/modules/network/domain/fatigue'
import { resolveNetworkConfig } from '@/modules/network/domain/config'
import {
  loadIntroducerHistory,
  loadMemberAffiliations,
  loadPersonAffiliations,
} from '@/modules/network/domain/repository'

async function db() {
  const supabase = await createClient()
  return moduleClient<NetworkDatabase>(supabase)
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── People ──────────────────────────────────────────────────────────────────

function personPayload(input: PersonInput) {
  return {
    full_name: input.fullName.trim(),
    role_title: input.roleTitle ?? null,
    organisation: input.organisation ?? null,
    country: input.country ?? null,
    languages: input.languages ?? [],
    topic_tags: input.topicTags ?? [],
    what_they_can_say: input.whatTheyCanSay ?? null,
    public_profile_urls: input.publicProfileUrls ?? [],
    shares_own_appearances: input.sharesOwnAppearances ?? null,
    podcast_appearances: input.appearances ?? [],
    institutional_friction: input.institutionalFriction ?? 'none',
    industry_relationship: input.industryRelationship ?? null,
    origin: input.origin ?? 'external',
    crm_contact_id: input.crmContactId ?? null,
    profile_id: input.profileId ?? null,
    source_attribution: input.sourceAttribution ?? {},
    notes: input.notes ?? null,
  }
}

export async function createPerson(input: PersonInput): Promise<ActionResult<{ id: string }>> {
  if (!input.fullName?.trim()) return { ok: false, error: 'A name is required.' }

  const client = await db()
  const { data, error } = await client
    .from('network_people')
    .insert({ ...personPayload(input), created_by: await currentUserId() })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true, data: { id: data.id } }
}

export async function updatePerson(
  personId: string,
  input: Partial<PersonInput>,
): Promise<ActionResult> {
  const client = await db()
  const patch = personPayload({ fullName: input.fullName ?? '', ...input })
  // Only send the keys the caller actually supplied, so a partial edit cannot
  // blank a field it never showed.
  const supplied = Object.fromEntries(
    Object.entries(patch).filter(([key]) => {
      if (key === 'full_name') return typeof input.fullName === 'string' && input.fullName.trim() !== ''
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      return camel in input
    }),
  )
  if (Object.keys(supplied).length === 0) return { ok: true }

  const { error } = await client
    .from('network_people')
    .update({ ...supplied, last_activity_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

/**
 * Create people by name if they are not already known, and return every id.
 *
 * Idempotent by case-insensitive name + organisation, which is what makes the
 * past-guest import safe to re-run. Matching on a name is imperfect on purpose:
 * the alternative — creating a duplicate every run — is worse, and a wrong merge
 * is visible and repairable in the People screen.
 */
export async function upsertPeopleByName(
  people: Array<PersonInput>,
): Promise<ActionResult<{ ids: Record<string, string>; created: number }>> {
  const client = await db()
  const wanted = people.filter((p) => p.fullName?.trim())
  if (wanted.length === 0) return { ok: true, data: { ids: {}, created: 0 } }

  const { data: existing, error: readError } = await client
    .from('network_people')
    .select('id, full_name, organisation')
  if (readError) return { ok: false, error: readError.message }

  const key = (name: string, org?: string | null) =>
    `${name.trim().toLowerCase()}|${(org ?? '').trim().toLowerCase()}`
  const known = new Map<string, string>()
  for (const row of existing ?? []) known.set(key(row.full_name, row.organisation), row.id)
  // Fall back to a name-only match so an imported guest with no organisation
  // does not duplicate a person who has one.
  const byName = new Map<string, string>()
  for (const row of existing ?? []) byName.set(row.full_name.trim().toLowerCase(), row.id)

  const ids: Record<string, string> = {}
  const toCreate: PersonInput[] = []
  for (const person of wanted) {
    const existingId =
      known.get(key(person.fullName, person.organisation)) ??
      byName.get(person.fullName.trim().toLowerCase())
    if (existingId) ids[person.fullName] = existingId
    else toCreate.push(person)
  }

  let created = 0
  if (toCreate.length > 0) {
    const createdBy = await currentUserId()
    const { data, error } = await client
      .from('network_people')
      .insert(toCreate.map((p) => ({ ...personPayload(p), created_by: createdBy })))
      .select('id, full_name')
    if (error) return { ok: false, error: error.message }
    for (const row of data ?? []) ids[row.full_name] = row.id
    created = (data ?? []).length
  }

  revalidatePath('/app/comms/podcast')
  return { ok: true, data: { ids, created } }
}

/**
 * Record an objection.
 *
 * The record is hidden from every screen and from scoring, permanently — the
 * `network_people_public` view enforces it once so no consumer can forget. The
 * row itself is kept so the objection is not silently undone by a re-import.
 */
export async function recordObjection(personId: string): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('network_people')
    .update({ objection_received: true, objection_recorded_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

/**
 * Delete a person. The owning component's delete path (ADR-0009 §9 rule 3):
 * other components hold soft references, so this is where the consequences of a
 * deletion are decided.
 */
export async function deletePerson(personId: string): Promise<ActionResult> {
  const client = await db()
  const { error } = await client.from('network_people').delete().eq('id', personId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

// ─── Member affiliations (opt-in, item by item, revocable) ───────────────────

export async function declareMemberAffiliation(input: {
  profileId: string
  kind: AffiliationKind
  name: string
  fromYear?: number | null
  toYear?: number | null
  visibility?: 'network' | 'private'
}): Promise<ActionResult<{ id: string }>> {
  if (!input.name?.trim()) return { ok: false, error: 'A name is required.' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Not authenticated.' }
  // A member declares their own contexts. Declaring on somebody else's behalf
  // would not be consent.
  if (input.profileId !== userId) return { ok: false, error: 'You can only declare your own affiliations.' }

  const client = await db()
  const { data, error } = await client
    .from('network_member_affiliations')
    .insert({
      profile_id: input.profileId,
      kind: input.kind,
      name: input.name.trim(),
      from_year: input.fromYear ?? null,
      to_year: input.toYear ?? null,
      visibility: input.visibility ?? 'network',
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true, data: { id: data.id } }
}

/** Withdrawing a declaration is as easy as making it. Consent that cannot be withdrawn is not consent. */
export async function revokeMemberAffiliation(affiliationId: string): Promise<ActionResult> {
  const client = await db()
  const { error } = await client.from('network_member_affiliations').delete().eq('id', affiliationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

export async function setMemberAffiliationVisibility(
  affiliationId: string,
  visibility: 'network' | 'private',
): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('network_member_affiliations')
    .update({ visibility })
    .eq('id', affiliationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

// ─── The graph ───────────────────────────────────────────────────────────────

/**
 * Recompute the *suggested* edges between one member and one person from their
 * declared and public contexts.
 *
 * Suggestions only. This function cannot produce a confirmed connection — that
 * needs `answerConnectionCheck` — which is the boundary that stops the platform
 * ever claiming two people know each other because their CVs overlapped.
 */
export async function refreshSuggestedConnections(
  profileId: string,
  personId: string,
): Promise<ActionResult<{ suggested: number }>> {
  const [memberAffiliations, personAffiliations] = await Promise.all([
    loadMemberAffiliations(profileId),
    loadPersonAffiliations(personId),
  ])
  const suggestions = suggestConnections(profileId, personId, memberAffiliations, personAffiliations)
  if (suggestions.length === 0) return { ok: true, data: { suggested: 0 } }

  const client = await db()
  const { error } = await client.from('network_connections').upsert(
    suggestions.map((s) => ({
      from_type: s.fromType,
      from_id: s.fromId,
      to_type: s.toType,
      to_id: s.toId,
      connection_type: s.connectionType,
      strength: s.strength,
      evidence: s.evidence,
      status: 'suggested',
    })),
    { onConflict: 'from_type,from_id,to_type,to_id,connection_type', ignoreDuplicates: true },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { suggested: suggestions.length } }
}

// ─── The map question ────────────────────────────────────────────────────────

/**
 * Ask a member whether they know somebody. Costs five seconds, commits nobody,
 * moves no card — and is therefore deliberately *not* rate-limited. Throttling
 * the cheap ask is the fastest way to ensure the map never gets built.
 */
export async function askConnectionCheck(input: {
  profileId: string
  personId: string
  contextNote?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const client = await db()
  const { data, error } = await client
    .from('network_connection_checks')
    .insert({
      profile_id: input.profileId,
      person_id: input.personId,
      context_note: input.contextNote ?? null,
      asked_by: await currentUserId(),
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true, data: { id: data.id } }
}

/**
 * Record an answer, and promote the guess to a confirmed connection when the
 * answer is a yes.
 *
 * Every answer improves the map permanently, *including every no*: a "no" marks
 * the inferred edge rejected so the same wrong guess is not offered again.
 * "I would rather not ask" records the boundary and changes no edge at all —
 * it is not a data point about the relationship, and it is never a failure.
 */
export async function answerConnectionCheck(
  checkId: string,
  answer: ConnectionCheckAnswer,
  answerNote?: string | null,
): Promise<ActionResult> {
  const client = await db()
  const { data: check, error: readError } = await client
    .from('network_connection_checks')
    .select('id, profile_id, person_id')
    .eq('id', checkId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message }
  if (!check) return { ok: false, error: 'That question no longer exists.' }

  const { error } = await client
    .from('network_connection_checks')
    .update({ answer, answer_note: answerNote ?? null, answered_at: new Date().toISOString() })
    .eq('id', checkId)
  if (error) return { ok: false, error: error.message }

  const connectionType = connectionTypeForAnswer(answer)
  if (connectionType) {
    const { error: upsertError } = await client.from('network_connections').upsert(
      {
        from_type: 'profile',
        from_id: check.profile_id,
        to_type: 'person',
        to_id: check.person_id,
        connection_type: connectionType,
        strength: CONNECTION_STRENGTH[connectionType],
        evidence: [{ kind: 'confirmed', detail: 'Confirmed by the member', sourceUrl: null }],
        status: 'confirmed',
        confirmed_by: check.profile_id,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'from_type,from_id,to_type,to_id,connection_type' },
    )
    if (upsertError) return { ok: false, error: upsertError.message }
  } else if (answer === 'no') {
    // A no retires the guesses between these two, so the map stops offering it.
    const { error: rejectError } = await client
      .from('network_connections')
      .update({ status: 'rejected' })
      .eq('from_type', 'profile')
      .eq('from_id', check.profile_id)
      .eq('to_type', 'person')
      .eq('to_id', check.person_id)
      .eq('status', 'suggested')
    if (rejectError) return { ok: false, error: rejectError.message }
  }

  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

// ─── The favour ──────────────────────────────────────────────────────────────

/**
 * Ask a confirmed contact for an introduction.
 *
 * Refuses when the introducer is inside their cooldown window. The refusal is
 * returned as an error the caller shows, not swallowed — the point of the rule
 * is that somebody sees it.
 */
export async function requestIntroduction(input: {
  introducerProfileId: string
  personId: string
  contextType: string
  contextId?: string | null
  contextSummary?: string | null
  connectionId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const config = await resolveNetworkConfig()
  const history = await loadIntroducerHistory(input.introducerProfileId)
  const verdict = canRequestIntroduction(history, { config })
  if (!verdict.allowed) {
    return {
      ok: false,
      error: `This introducer was asked ${config.introducerCooldownDays - verdict.daysUntilAvailable} days ago. They are available again in ${verdict.daysUntilAvailable} day${verdict.daysUntilAvailable === 1 ? '' : 's'}.`,
    }
  }

  const client = await db()
  const { data, error } = await client
    .from('network_introduction_requests')
    .insert({
      context_type: input.contextType,
      context_id: input.contextId ?? null,
      context_summary: input.contextSummary ?? null,
      introducer_profile_id: input.introducerProfileId,
      person_id: input.personId,
      connection_id: input.connectionId ?? null,
      requested_by: await currentUserId(),
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true, data: { id: data.id } }
}

/** The introducer's answer. A decline carries no visible consequence anywhere. */
export async function respondToIntroduction(
  requestId: string,
  response: IntroductionResponse,
  notes?: string | null,
): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('network_introduction_requests')
    .update({ response, notes: notes ?? null, responded_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

/**
 * Record that the introducer wrote to the guest — in their own words, from their
 * own inbox. The platform never sends anything on their behalf; this only notes
 * that they said they did, so the card knows what it is waiting on.
 */
export async function recordIntroductionSent(requestId: string): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('network_introduction_requests')
    .update({ intro_sent_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

export async function recordIntroductionOutcome(
  requestId: string,
  outcome: IntroductionOutcome,
): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('network_introduction_requests')
    .update({ outcome })
    .eq('id', requestId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/app/comms/podcast')
  return { ok: true }
}

/**
 * Everything the introducer needs and nothing else (concept §8).
 *
 * A route is worthless if using it feels awkward, so the package is assembled
 * for them: a three-sentence message in their voice naming the actual
 * connection, a forwardable brief, one link, and a plain statement of what
 * happens next — so they know they are making an introduction, not taking on a
 * project. They edit or rewrite freely; nothing is ever sent for them.
 */
export async function buildIntroducerPackage(input: {
  introducerName: string
  person: Pick<NetworkPerson, 'fullName' | 'roleTitle' | 'organisation'>
  connectionDetail: string
  subject: string
  whyNow?: string | null
  timeAsked: string
  briefUrl?: string | null
}): Promise<{ message: string; brief: string; whatHappensNext: string }> {
  const role = [input.person.roleTitle, input.person.organisation].filter(Boolean).join(', ')
  const message = [
    `${input.person.fullName}${role ? ` (${role})` : ''} — you mentioned you know them ${input.connectionDetail}.`,
    `Would you be willing to introduce them to me for a conversation on ${input.subject}?${input.whyNow ? ` ${input.whyNow}` : ''}`,
    `A short note in your own words is all it takes — and a no is completely fine.`,
  ].join(' ')

  const brief = [
    `Subject: ${input.subject}`,
    input.whyNow ? `Why now: ${input.whyNow}` : null,
    `Time asked of them: ${input.timeAsked}`,
    input.briefUrl ? `More detail: ${input.briefUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const whatHappensNext =
    'You make the introduction; we take it from there. You are not committing to anything beyond the introduction itself, and nothing is sent to them on your behalf.'

  return { message, brief, whatHappensNext }
}
