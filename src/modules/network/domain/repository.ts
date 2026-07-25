/**
 * network/domain/repository.ts — reads for the relationship graph.
 *
 * Defensive throughout (AGENTS.md §6): every query destructures `{ data, error }`
 * and returns an empty/neutral result rather than throwing into a Server
 * Component. The consuming surface renders an empty state; it never blanks.
 */

import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import type { NetworkDatabase } from '@/modules/network/domain/schema'
import type {
  Connection,
  ConnectionCheck,
  ConnectionCheckAnswer,
  ConnectionEvidence,
  ConnectionStatus,
  ConnectionType,
  InstitutionalFriction,
  IntroductionOutcome,
  IntroductionRequest,
  IntroductionResponse,
  MemberAffiliation,
  NetworkPerson,
  NodeType,
  PersonAffiliation,
  PersonOrigin,
  PublicAppearance,
} from '@/modules/network/domain/types'
import type { AffiliationKind } from '@/modules/network/domain/types'

/** Server-side client typed against this component's own tables. */
export async function networkDb() {
  const supabase = await createClient()
  return moduleClient<NetworkDatabase>(supabase)
}

// ─── Row → domain mapping ────────────────────────────────────────────────────

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

type PersonShape = {
  id: string
  full_name: string
  role_title: string | null
  organisation: string | null
  country: string | null
  languages: string[] | null
  topic_tags: string[] | null
  what_they_can_say: string | null
  public_profile_urls: unknown
  audience_indicators: unknown
  shares_own_appearances: boolean | null
  podcast_appearances: unknown
  institutional_friction: string
  industry_relationship: string | null
  origin: string
  crm_contact_id: string | null
  profile_id: string | null
  source_attribution: unknown
  last_reviewed_at: string | null
}

export function toPerson(row: PersonShape): NetworkPerson {
  return {
    id: row.id,
    fullName: row.full_name,
    roleTitle: row.role_title,
    organisation: row.organisation,
    country: row.country,
    languages: row.languages ?? [],
    topicTags: row.topic_tags ?? [],
    whatTheyCanSay: row.what_they_can_say,
    publicProfileUrls: asArray<{ label?: string; url: string }>(row.public_profile_urls),
    audienceIndicators: asRecord(row.audience_indicators),
    sharesOwnAppearances: row.shares_own_appearances,
    appearances: asArray<PublicAppearance>(row.podcast_appearances),
    institutionalFriction: row.institutional_friction as InstitutionalFriction,
    industryRelationship: row.industry_relationship,
    origin: row.origin as PersonOrigin,
    crmContactId: row.crm_contact_id,
    profileId: row.profile_id,
    sourceAttribution: asRecord(row.source_attribution) as Record<string, string>,
    lastReviewedAt: row.last_reviewed_at,
  }
}

// ─── People ──────────────────────────────────────────────────────────────────

export type PeopleFilter = {
  search?: string
  origin?: PersonOrigin | 'all'
  limit?: number
}

/**
 * Load people through the published read view.
 *
 * The view is the read contract (ADR-0009 §6 rule 2) and is also where the
 * objection rule lives, so a person who objected cannot leak into any screen —
 * not even by a caller forgetting the filter.
 */
export async function loadPeople(filter: PeopleFilter = {}): Promise<NetworkPerson[]> {
  const db = await networkDb()
  let query = db
    .from('network_people_public')
    .select('*')
    .order('full_name', { ascending: true })
    .limit(filter.limit ?? 200)

  if (filter.origin && filter.origin !== 'all') query = query.eq('origin', filter.origin)
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`
    query = query.or(`full_name.ilike.${term},organisation.ilike.${term},role_title.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[network] loadPeople failed:', error.message)
    return []
  }
  return (data ?? []).map(toPerson)
}

/** One person, or null when missing or objecting. */
export async function loadPerson(personId: string): Promise<NetworkPerson | null> {
  const db = await networkDb()
  const { data, error } = await db
    .from('network_people_public')
    .select('*')
    .eq('id', personId)
    .maybeSingle()
  if (error) {
    console.error('[network] loadPerson failed:', error.message)
    return null
  }
  return data ? toPerson(data) : null
}

/**
 * Resolve many people at once — the read path other components use through the
 * public API, so a board of 60 cards costs one query rather than 60.
 */
export async function loadPeopleByIds(ids: string[]): Promise<Map<string, NetworkPerson>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Map()

  const db = await networkDb()
  const { data, error } = await db.from('network_people_public').select('*').in('id', unique)
  if (error) {
    console.error('[network] loadPeopleByIds failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((row) => [row.id, toPerson(row)]))
}

// ─── Affiliations ────────────────────────────────────────────────────────────

export async function loadPersonAffiliations(personId: string): Promise<PersonAffiliation[]> {
  const db = await networkDb()
  const { data, error } = await db
    .from('network_person_affiliations')
    .select('*')
    .eq('person_id', personId)
  if (error) {
    console.error('[network] loadPersonAffiliations failed:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    personId: r.person_id,
    kind: r.kind as AffiliationKind,
    name: r.name,
    fromYear: r.from_year,
    toYear: r.to_year,
    sourceUrl: r.source_url,
  }))
}

/** A member's own declarations — including the `private` ones they can still manage. */
export async function loadMemberAffiliations(profileId: string): Promise<MemberAffiliation[]> {
  const db = await networkDb()
  const { data, error } = await db
    .from('network_member_affiliations')
    .select('*')
    .eq('profile_id', profileId)
    .order('kind', { ascending: true })
  if (error) {
    console.error('[network] loadMemberAffiliations failed:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    kind: r.kind as AffiliationKind,
    name: r.name,
    fromYear: r.from_year,
    toYear: r.to_year,
    visibility: r.visibility === 'private' ? 'private' : 'network',
  }))
}

/** How many members have declared anything — the Phase A success criterion. */
export async function countMembersWithAffiliations(): Promise<number> {
  const db = await networkDb()
  const { data, error } = await db.from('network_member_affiliations').select('profile_id')
  if (error) {
    console.error('[network] countMembersWithAffiliations failed:', error.message)
    return 0
  }
  return new Set((data ?? []).map((r) => r.profile_id)).size
}

// ─── The graph ───────────────────────────────────────────────────────────────

function toConnection(r: {
  id: string
  from_type: string
  from_id: string
  to_type: string
  to_id: string
  connection_type: string
  strength: number
  evidence: unknown
  status: string
  confirmed_by: string | null
  confirmed_at: string | null
}): Connection {
  return {
    id: r.id,
    fromType: r.from_type as NodeType,
    fromId: r.from_id,
    toType: r.to_type as NodeType,
    toId: r.to_id,
    connectionType: r.connection_type as ConnectionType,
    strength: Number(r.strength),
    evidence: asArray<ConnectionEvidence>(r.evidence),
    status: r.status as ConnectionStatus,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
  }
}

/**
 * Every edge that could take part in a route to this person: the edges touching
 * the target, plus the edges touching whoever those reach. Two queries, because
 * a route is at most two hops.
 */
export async function loadConnectionsForPerson(personId: string): Promise<Connection[]> {
  const db = await networkDb()

  const { data: direct, error } = await db
    .from('network_connections')
    .select('*')
    .or(`and(to_type.eq.person,to_id.eq.${personId}),and(from_type.eq.person,from_id.eq.${personId})`)
  if (error) {
    console.error('[network] loadConnectionsForPerson failed:', error.message)
    return []
  }

  const first = (direct ?? []).map(toConnection)
  // The people one hop away — the possible middles of a two-step route.
  const middles = new Set<string>()
  for (const c of first) {
    if (c.fromType === 'person' && c.fromId !== personId) middles.add(c.fromId)
    if (c.toType === 'person' && c.toId !== personId) middles.add(c.toId)
  }
  if (middles.size === 0) return first

  const ids = [...middles]
  const { data: second, error: secondError } = await db
    .from('network_connections')
    .select('*')
    .or(`and(to_type.eq.person,to_id.in.(${ids.join(',')})),and(from_type.eq.person,from_id.in.(${ids.join(',')}))`)
  if (secondError) {
    console.error('[network] loadConnectionsForPerson (second hop) failed:', secondError.message)
    return first
  }

  const seen = new Set(first.map((c) => c.id))
  return [...first, ...(second ?? []).map(toConnection).filter((c) => !seen.has(c.id))]
}

// ─── The map question ────────────────────────────────────────────────────────

function toCheck(r: {
  id: string
  profile_id: string
  person_id: string
  context_note: string | null
  asked_at: string
  answer: string | null
  answer_note: string | null
  answered_at: string | null
}): ConnectionCheck {
  return {
    id: r.id,
    profileId: r.profile_id,
    personId: r.person_id,
    contextNote: r.context_note,
    askedAt: r.asked_at,
    answer: (r.answer as ConnectionCheckAnswer | null) ?? null,
    answerNote: r.answer_note,
    answeredAt: r.answered_at,
  }
}

export async function loadConnectionChecks(personId: string): Promise<ConnectionCheck[]> {
  const db = await networkDb()
  const { data, error } = await db
    .from('network_connection_checks')
    .select('*')
    .eq('person_id', personId)
    .order('asked_at', { ascending: false })
  if (error) {
    console.error('[network] loadConnectionChecks failed:', error.message)
    return []
  }
  return (data ?? []).map(toCheck)
}

/** The map questions waiting on the signed-in member. */
export async function loadMyOpenChecks(profileId: string): Promise<ConnectionCheck[]> {
  const db = await networkDb()
  const { data, error } = await db
    .from('network_connection_checks')
    .select('*')
    .eq('profile_id', profileId)
    .is('answer', null)
    .order('asked_at', { ascending: true })
  if (error) {
    console.error('[network] loadMyOpenChecks failed:', error.message)
    return []
  }
  return (data ?? []).map(toCheck)
}

// ─── The favour ──────────────────────────────────────────────────────────────

function toIntroduction(r: {
  id: string
  context_type: string
  context_id: string | null
  context_summary: string | null
  introducer_profile_id: string
  person_id: string
  connection_id: string | null
  requested_at: string
  response: string | null
  responded_at: string | null
  intro_sent_at: string | null
  outcome: string | null
  notes: string | null
}): IntroductionRequest {
  return {
    id: r.id,
    contextType: r.context_type,
    contextId: r.context_id,
    contextSummary: r.context_summary,
    introducerProfileId: r.introducer_profile_id,
    personId: r.person_id,
    connectionId: r.connection_id,
    requestedAt: r.requested_at,
    response: (r.response as IntroductionResponse | null) ?? null,
    respondedAt: r.responded_at,
    introSentAt: r.intro_sent_at,
    outcome: (r.outcome as IntroductionOutcome | null) ?? null,
    notes: r.notes,
  }
}

/** Every introduction request, newest first — the Introductions screen. */
export async function loadIntroductionRequests(
  opts: { contextType?: string; contextId?: string; introducerProfileId?: string } = {},
): Promise<IntroductionRequest[]> {
  const db = await networkDb()
  let query = db
    .from('network_introduction_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (opts.contextType) query = query.eq('context_type', opts.contextType)
  if (opts.contextId) query = query.eq('context_id', opts.contextId)
  if (opts.introducerProfileId) query = query.eq('introducer_profile_id', opts.introducerProfileId)

  const { data, error } = await query
  if (error) {
    console.error('[network] loadIntroductionRequests failed:', error.message)
    return []
  }
  return (data ?? []).map(toIntroduction)
}

/** History for one introducer — the input to the fatigue rule. */
export async function loadIntroducerHistory(profileId: string): Promise<IntroductionRequest[]> {
  return loadIntroductionRequests({ introducerProfileId: profileId })
}
