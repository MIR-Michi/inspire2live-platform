import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getRoleLabel, normalizeRole } from '@/lib/role-access'
import {
  deriveContactKind,
  deriveRelationshipHealth,
  normalizeContactKind,
  normalizeCrmConsent,
  normalizeCrmLifecycle,
  normalizeCrmPersonType,
  normalizeCrmContinent,
  normalizeEmail,
  normalizePlatformStatus,
  segmentFromKind,
  type CrmConnectorBacklogItem,
  type CrmContactKind,
  type CrmContactLink,
  type CrmContactLinkKind,
  type CrmContactRecord,
  type CrmPipelineDetail,
  type CrmPipelineMember,
  type CrmPipelineStage,
  type CrmPipelineSummary,
  type CrmPlatformStatus,
  type CrmSegment,
  type CrmSelectOption,
  type CrmSourceType,
} from '@/lib/comms-crm'

type CrmQueryClient = {
  // The comms_crm_* tables are not yet present in the generated Database types,
  // so the query builder chain is typed loosely here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

export type CrmDirectory = {
  records: CrmContactRecord[]
  people: CrmSelectOption[]
  initiatives: CrmSelectOption[]
  events: CrmSelectOption[]
  connectorBacklog: CrmConnectorBacklogItem[]
  crmReady: boolean
}

// ─── Raw row shapes (subset of columns the assembler needs) ──────────────────

export type RawProfileRow = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  bio: string | null
  city: string | null
  country: string | null
  organization: string | null
  role: string
  expertise_tags: string[] | null
  last_active_at: string | null
  status?: string | null
  onboarding_completed?: boolean | null
}

export type RawCrmContactLinkRow = {
  id: string
  contact_id: string
  kind: string
  label: string
  url: string | null
  position?: number | null
}

export type RawCrmContactRow = {
  id: string
  source_type: string
  source_id: string | null
  full_name: string
  segment: string
  contact_kind?: string | null
  platform_status?: string | null
  intended_role?: string | null
  profile_id?: string | null
  normalized_email?: string | null
  person_type: string | null
  is_campus_member?: boolean | null
  field_of_expertise: string[] | null
  skills: string[] | null
  picture_url: string | null
  bio: string | null
  title: string | null
  organisation: string | null
  organisation_url?: string | null
  linkedin_url?: string | null
  continent?: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  preferred_channel: string | null
  relationship_owner_id: string | null
  relationship_owner_label: string | null
  lifecycle_stage: string
  last_interaction_at: string | null
  next_follow_up_at: string | null
  consent_status: string
  privacy_notes: string | null
  retention_review_at: string | null
  source_label: string | null
  tags: string[]
  notes: string | null
}

export type AssembleInput = {
  profiles: RawProfileRow[]
  initiativeMembers: Array<{ user_id: string; initiative_id: string }>
  initiatives: Array<{ id: string; title: string }>
  events: Array<{ id: string; name: string; event_type: string; start_date: string | null }>
  crmContacts: RawCrmContactRow[]
  contactLinks: RawCrmContactLinkRow[]
  crmInitiatives: Array<{ contact_id: string; initiative_id: string }>
  crmEventLinks: Array<{ contact_id: string; event_id: string; relationship_type: string }>
  crmInteractions: Array<{
    id: string
    contact_id: string
    interaction_type: string
    summary: string
    occurred_at: string
    next_follow_up_at: string | null
  }>
  conferenceAssignments?: Array<{
    contact_id: string
    conference_id: string
    conference_name: string
    conference_start_date: string | null
    role: string
  }>
  ownerLabels?: Map<string, string>
  conferenceAssignments?: Array<{
    contact_id: string
    conference_id: string
    conference_name: string
    start_date: string | null
    role: string
  }>
}

function mergeText(primary: string | null | undefined, fallback: string | null | undefined) {
  return primary ?? fallback ?? null
}

function mergeArray(primary: string[] | null | undefined, fallback: string[] | null | undefined) {
  return primary && primary.length > 0 ? primary : fallback ?? []
}

/** Platform-account state derived from a platform profile. */
function platformStatusForProfile(profile: RawProfileRow): CrmPlatformStatus {
  if (profile.status === 'inactive') return 'inactive'
  // A profile exists but onboarding isn't finished → "invited" (pending).
  if (profile.onboarding_completed === false) return 'invited'
  return 'active'
}

/**
 * Pure assembler: merges platform profiles (internal_user) and dedicated CRM
 * rows into one deduplicated list of `CrmContactRecord`s.
 *
 * Identity is resolved spine-first: profiles seed base records keyed by a stable
 * person key and indexed by normalized email; CRM rows then overlay onto the
 * matching base (by profile_id, then email, then legacy source link) instead of
 * creating a duplicate. Profile identity always wins for internal users; the CRM
 * row contributes only relationship data for them.
 *
 * Campus membership comes solely from the CRM row's `is_campus_member` flag (the
 * imported community list) — the legacy `campus_members` roster is no longer a
 * CRM source.
 */
export function assembleCrmRecords(input: AssembleInput): CrmContactRecord[] {
  const initiativeMap = new Map(input.initiatives.map((i) => [i.id, i.title]))
  const eventMap = new Map(
    input.events.map((e) => [e.id, `${e.name}${e.event_type === 'podcast' ? ' (Podcast)' : ''}`])
  )
  const ownerMap = input.ownerLabels ?? new Map(input.profiles.map((p) => [p.id, p.name ?? p.email ?? '']))

  const membershipTitles = new Map<string, string[]>()
  const membershipIds = new Map<string, string[]>()
  for (const m of input.initiativeMembers) {
    const title = initiativeMap.get(m.initiative_id)
    membershipIds.set(m.user_id, [...(membershipIds.get(m.user_id) ?? []), m.initiative_id])
    if (!title) continue
    membershipTitles.set(m.user_id, Array.from(new Set([...(membershipTitles.get(m.user_id) ?? []), title])))
  }

  const records = new Map<string, CrmContactRecord>()
  const keyByEmail = new Map<string, string>()

  const indexEmail = (email: string | null | undefined, key: string) => {
    const normalized = normalizeEmail(email)
    if (normalized && !keyByEmail.has(normalized)) keyByEmail.set(normalized, key)
  }

  // 1) Platform users (category A). IndustryPartners are handled elsewhere.
  for (const profile of input.profiles) {
    if (normalizeRole(profile.role) === 'IndustryPartner') continue
    const key = `profile:${profile.id}`
    records.set(key, {
      id: key,
      crmContactId: null,
      sourceType: 'profile' as CrmSourceType,
      sourceId: profile.id,
      fullName: profile.name,
      segment: 'internal' as CrmSegment,
      contactKind: 'internal_user',
      platformStatus: platformStatusForProfile(profile),
      intendedRole: null,
      profileId: profile.id,
      personType: normalizeRole(profile.role) === 'Comms' ? 'comms' : null,
      isCampusMember: false,
      fieldOfExpertise: [],
      skills: profile.expertise_tags ?? [],
      pictureUrl: profile.avatar_url,
      bio: profile.bio,
      title: getRoleLabel(profile.role),
      organisation: profile.organization,
      organisationUrl: null,
      linkedinUrl: null,
      continent: null,
      links: [],
      associatedProjects: membershipTitles.get(profile.id) ?? [],
      associatedProjectIds: membershipIds.get(profile.id) ?? [],
      associatedEvents: [],
      associatedEventIds: [],
      email: profile.email,
      phone: null,
      city: profile.city,
      country: profile.country,
      preferredChannel: 'Email',
      relationshipOwner: normalizeRole(profile.role) === 'Comms' ? 'Communications team' : null,
      relationshipOwnerId: null,
      health: deriveRelationshipHealth(profile.last_active_at),
      lastInteractionAt: profile.last_active_at,
      nextFollowUpAt: null,
      consentStatus: 'not_required' as const,
      privacyNotes: null,
      retentionReviewAt: null,
      sourceLabel: normalizeRole(profile.role) === 'Comms' ? 'Comms workspace profile' : 'Platform profile',
      tags: [...(profile.expertise_tags ?? []), 'internal'].filter(Boolean),
      notes: null,
      recentInteractions: [],
      conferences: [],
    })
    indexEmail(profile.email, key)
  }

  // 2) Group a contact's public-footprint links (publications/talks/media).
  const linksByContact = new Map<string, CrmContactLink[]>()
  for (const link of input.contactLinks) {
    const resolved: CrmContactLink = {
      id: link.id,
      kind: (['publication', 'talk', 'media', 'profile', 'linkedin', 'other'].includes(link.kind)
        ? link.kind
        : 'other') as CrmContactLinkKind,
      label: link.label,
      url: link.url,
    }
    linksByContact.set(link.contact_id, [...(linksByContact.get(link.contact_id) ?? []), resolved])
  }

  // 3) Dedicated CRM rows overlay onto the matching base, or stand alone.
  const projectIdsByContact = new Map<string, string[]>()
  for (const link of input.crmInitiatives) {
    projectIdsByContact.set(link.contact_id, [...(projectIdsByContact.get(link.contact_id) ?? []), link.initiative_id])
  }
  const eventIdsByContact = new Map<string, string[]>()
  for (const link of input.crmEventLinks) {
    eventIdsByContact.set(link.contact_id, [...(eventIdsByContact.get(link.contact_id) ?? []), link.event_id])
  }
  const conferencesByContact = new Map<string, CrmContactRecord['conferences']>()
  for (const ca of input.conferenceAssignments ?? []) {
    conferencesByContact.set(ca.contact_id, [
      ...(conferencesByContact.get(ca.contact_id) ?? []),
      { id: ca.conference_id, name: ca.conference_name, startDate: ca.start_date, role: ca.role },
    ])
  }

  const interactionsByContact = new Map<string, CrmContactRecord['recentInteractions']>()
  for (const interaction of input.crmInteractions) {
    interactionsByContact.set(interaction.contact_id, [
      ...(interactionsByContact.get(interaction.contact_id) ?? []),
      {
        id: interaction.id,
        type: interaction.interaction_type,
        summary: interaction.summary,
        occurredAt: interaction.occurred_at,
        nextFollowUpAt: interaction.next_follow_up_at,
      },
    ])
  }

  const conferencesByContact = new Map<string, CrmContactRecord['conferences']>()
  for (const assignment of input.conferenceAssignments ?? []) {
    conferencesByContact.set(assignment.contact_id, [
      ...(conferencesByContact.get(assignment.contact_id) ?? []),
      {
        id: assignment.conference_id,
        name: assignment.conference_name,
        startDate: assignment.conference_start_date,
        role: assignment.role,
      },
    ])
  }

  for (const contact of input.crmContacts) {
    const normalized = normalizeEmail(contact.email) ?? contact.normalized_email ?? null

    let key: string | null = null
    if (contact.profile_id && records.has(`profile:${contact.profile_id}`)) key = `profile:${contact.profile_id}`
    else if (normalized && keyByEmail.has(normalized)) key = keyByEmail.get(normalized)!
    else if (contact.source_type === 'profile' && contact.source_id && records.has(`profile:${contact.source_id}`))
      key = `profile:${contact.source_id}`

    const base = key ? records.get(key) ?? null : null
    const isInternalUser = base?.contactKind === 'internal_user'
    const isCampusMember = Boolean(contact.is_campus_member) || (base?.isCampusMember ?? false)

    const contactKind: CrmContactKind = isInternalUser
      ? 'internal_user'
      : normalizeContactKind(contact.contact_kind) ??
        base?.contactKind ??
        deriveContactKind({
          profileId: contact.profile_id,
          email: contact.email,
          isCampusMember,
        })

    const platformStatus: CrmPlatformStatus = isInternalUser
      ? base!.platformStatus
      : normalizePlatformStatus(contact.platform_status)

    const projectIds = projectIdsByContact.get(contact.id) ?? base?.associatedProjectIds ?? []
    const eventIds = eventIdsByContact.get(contact.id) ?? []
    const ownerLabel = contact.relationship_owner_id
      ? ownerMap.get(contact.relationship_owner_id) ?? contact.relationship_owner_label
      : contact.relationship_owner_label

    const baseTags = contact.tags.length > 0 ? contact.tags : base?.tags ?? []
    const tags = isCampusMember ? Array.from(new Set([...baseTags, 'world-campus'])) : baseTags

    const record: CrmContactRecord = {
      id: contact.id,
      crmContactId: contact.id,
      sourceType: contact.source_type as CrmSourceType,
      sourceId: contact.source_id,
      fullName: isInternalUser ? base!.fullName : contact.full_name,
      segment: segmentFromKind(contactKind),
      contactKind,
      platformStatus,
      intendedRole: contact.intended_role ?? null,
      profileId: contact.profile_id ?? base?.profileId ?? null,
      personType: normalizeCrmPersonType(contact.person_type) ?? base?.personType ?? null,
      isCampusMember,
      fieldOfExpertise: isInternalUser ? base!.fieldOfExpertise : mergeArray(contact.field_of_expertise, base?.fieldOfExpertise),
      skills: isInternalUser ? base!.skills : mergeArray(contact.skills, base?.skills),
      pictureUrl: isInternalUser ? base!.pictureUrl : mergeText(contact.picture_url, base?.pictureUrl),
      bio: isInternalUser ? base!.bio : mergeText(contact.bio, base?.bio),
      title: isInternalUser ? base!.title : mergeText(contact.title, base?.title),
      organisation: isInternalUser ? base!.organisation : mergeText(contact.organisation, base?.organisation),
      organisationUrl: mergeText(contact.organisation_url, base?.organisationUrl),
      linkedinUrl: mergeText(contact.linkedin_url, base?.linkedinUrl),
      continent: normalizeCrmContinent(contact.continent) ?? base?.continent ?? null,
      links: linksByContact.get(contact.id) ?? base?.links ?? [],
      associatedProjects: projectIds.map((id) => initiativeMap.get(id)).filter(Boolean) as string[],
      associatedProjectIds: projectIds,
      associatedEvents: eventIds.map((id) => eventMap.get(id)).filter(Boolean) as string[],
      associatedEventIds: eventIds,
      email: isInternalUser ? base!.email : mergeText(contact.email, base?.email),
      phone: contact.phone,
      city: isInternalUser ? base!.city : mergeText(contact.city, base?.city),
      country: isInternalUser ? base!.country : mergeText(contact.country, base?.country),
      preferredChannel: mergeText(contact.preferred_channel, base?.preferredChannel),
      relationshipOwner: ownerLabel ?? base?.relationshipOwner ?? null,
      relationshipOwnerId: contact.relationship_owner_id,
      health: normalizeCrmLifecycle(contact.lifecycle_stage),
      lastInteractionAt: contact.last_interaction_at ?? base?.lastInteractionAt ?? null,
      nextFollowUpAt: contact.next_follow_up_at,
      consentStatus: normalizeCrmConsent(contact.consent_status),
      privacyNotes: contact.privacy_notes,
      retentionReviewAt: contact.retention_review_at,
      sourceLabel: contact.source_label ?? base?.sourceLabel ?? 'CRM contact',
      tags,
      notes: contact.notes ?? base?.notes ?? null,
      recentInteractions: (interactionsByContact.get(contact.id) ?? []).slice(0, 12),
      conferences: conferencesByContact.get(contact.id) ?? [],
    }

    if (key) records.delete(key)
    records.set(record.id, record)
  }

  return Array.from(records.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))
}

/**
 * Loads and merges the full CRM directory. Fetches the raw rows then delegates
 * to the pure `assembleCrmRecords` for the spine-first dedup. Shared by the CRM
 * hub (counts) and the People view (full searchable list).
 */
export async function loadCrmDirectory(supabase: SupabaseClient<Database>): Promise<CrmDirectory> {
  const crmSupabase = supabase as unknown as CrmQueryClient

  const [
    profilesResult,
    { data: initiativeMembers },
    { data: initiatives },
    { data: events },
    crmContactsResult,
    contactLinksResult,
    crmInitiativesResult,
    crmEventsResult,
    crmInteractionsResult,
    connectorBacklogResult,
    conferenceAssignmentsResult,
  ] = await Promise.all([
    // Select status + onboarding_completed when present; fall back if 00053 isn't applied.
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url, bio, city, country, organization, role, expertise_tags, last_active_at, status, onboarding_completed')
      .order('name'),
    supabase.from('initiative_members').select('user_id, initiative_id, role'),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase.from('events').select('id, name, event_type, start_date').order('start_date', { ascending: false }).limit(160),
    crmSupabase.from('comms_crm_contacts').select('*').order('updated_at', { ascending: false }),
    crmSupabase.from('comms_crm_contact_links').select('id, contact_id, kind, label, url, position').order('position', { ascending: true }),
    crmSupabase.from('comms_crm_contact_initiatives').select('contact_id, initiative_id'),
    crmSupabase.from('comms_crm_contact_events').select('contact_id, event_id, relationship_type'),
    crmSupabase
      .from('comms_crm_interactions')
      .select('id, contact_id, interaction_type, summary, occurred_at, next_follow_up_at')
      .order('occurred_at', { ascending: false })
      .limit(200),
    crmSupabase.from('comms_crm_connector_backlog').select('*').order('integration_target'),
    crmSupabase
      .from('conference_contact_assignments')
      .select('contact_id, role, conference_id, conferences(id, name, start_date)')
      .order('assigned_at', { ascending: false }),
  ])

  // Graceful fallback for environments without the status/onboarding columns.
  let profiles = profilesResult.data as RawProfileRow[] | null
  if (profilesResult.error) {
    const fallback = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, bio, city, country, organization, role, expertise_tags, last_active_at')
      .order('name')
    profiles = (fallback.data as RawProfileRow[] | null) ?? []
  }

  const ownerLabels = new Map((profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? '']))

  const rawAssignments: Array<Record<string, unknown>> = conferenceAssignmentsResult.error ? [] : (conferenceAssignmentsResult.data ?? [])
  const conferenceAssignments = rawAssignments.flatMap((row) => {
    const conf = row.conferences as { id: string; name: string; start_date: string | null } | null
    if (!row.contact_id || !conf?.id) return []
    return [{
      contact_id: String(row.contact_id),
      conference_id: String(conf.id),
      conference_name: String(conf.name ?? 'Unnamed conference'),
      conference_start_date: conf.start_date ? String(conf.start_date) : null,
      role: String(row.role ?? 'attendee'),
    }]
  })

  const records = assembleCrmRecords({
    profiles: profiles ?? [],
    initiativeMembers: (initiativeMembers ?? []) as Array<{ user_id: string; initiative_id: string }>,
    initiatives: (initiatives ?? []) as Array<{ id: string; title: string }>,
    events: (events ?? []) as Array<{ id: string; name: string; event_type: string; start_date: string | null }>,
    crmContacts: crmContactsResult.error ? [] : (crmContactsResult.data as RawCrmContactRow[]) ?? [],
    contactLinks: contactLinksResult.error ? [] : (contactLinksResult.data as RawCrmContactLinkRow[]) ?? [],
    crmInitiatives: crmInitiativesResult.error ? [] : crmInitiativesResult.data ?? [],
    crmEventLinks: crmEventsResult.error ? [] : crmEventsResult.data ?? [],
    crmInteractions: crmInteractionsResult.error ? [] : crmInteractionsResult.data ?? [],
    conferenceAssignments,
    ownerLabels,
    conferenceAssignments: conferenceAssignmentsResult.error ? [] : (conferenceAssignmentsResult.data ?? []).map((row: {
      contact_id: string
      conference_id: string
      role: string
      conferences: { id: string; name: string; start_date: string | null } | null
    }) => ({
      contact_id: String(row.contact_id),
      conference_id: String(row.conference_id),
      conference_name: row.conferences?.name ?? '',
      start_date: row.conferences?.start_date ?? null,
      role: String(row.role ?? 'attendee'),
    })).filter((row: { conference_name: string }) => row.conference_name),
  })

  const connectorBacklog: CrmConnectorBacklogItem[] = connectorBacklogResult.error
    ? []
    : (connectorBacklogResult.data ?? []).map((item: {
        id: string
        integration_target: string
        use_case: string
        status: string
        guardrail: string
      }) => ({
        id: item.id,
        integrationTarget: item.integration_target,
        useCase: item.use_case,
        status: item.status,
        guardrail: item.guardrail,
      }))

  return {
    records,
    people: (profiles ?? []).map((profile) => ({ id: profile.id, label: profile.name ?? profile.email ?? '' })),
    initiatives: (initiatives ?? []).map((initiative: { id: string; title: string }) => ({ id: initiative.id, label: initiative.title })),
    events: ((events ?? []) as Array<{ id: string; name: string; event_type: string; start_date: string | null }>).map((event) => ({
      id: event.id,
      label: event.name,
      meta: `${event.event_type}${event.start_date ? ` · ${event.start_date}` : ''}`,
    })),
    connectorBacklog,
    crmReady: !crmContactsResult.error,
  }
}

type PipelineRow = {
  id: string
  name: string
  description: string | null
  updated_at: string
}

type StageRow = {
  id: string
  pipeline_id: string
  name: string
  position: number
}

type MemberRow = {
  id: string
  stage_id: string
  contact_id: string
  note: string | null
  position: number
}

type ContactLookupRow = {
  id: string
  full_name: string
  picture_url: string | null
  title: string | null
  organisation: string | null
  segment: string
  person_type: string | null
}

/**
 * Loads pipeline summaries (name, description, stage/member counts) for the
 * pipelines list page.
 */
export async function loadCrmPipelines(supabase: SupabaseClient<Database>): Promise<CrmPipelineSummary[]> {
  const crmSupabase = supabase as unknown as CrmQueryClient

  const [{ data: pipelines, error: pipelinesError }, { data: stages }, { data: members }] = await Promise.all([
    crmSupabase.from('comms_crm_pipelines').select('id, name, description, updated_at').order('updated_at', { ascending: false }),
    crmSupabase.from('comms_crm_pipeline_stages').select('id, pipeline_id'),
    crmSupabase.from('comms_crm_pipeline_members').select('id, stage_id'),
  ])
  if (pipelinesError) return []

  const stageRows = (stages ?? []) as Array<{ id: string; pipeline_id: string }>
  const memberRows = (members ?? []) as Array<{ id: string; stage_id: string }>

  const stagesByPipeline = new Map<string, string[]>()
  for (const stage of stageRows) {
    stagesByPipeline.set(stage.pipeline_id, [...(stagesByPipeline.get(stage.pipeline_id) ?? []), stage.id])
  }

  const memberCountByStage = new Map<string, number>()
  for (const member of memberRows) {
    memberCountByStage.set(member.stage_id, (memberCountByStage.get(member.stage_id) ?? 0) + 1)
  }

  return ((pipelines ?? []) as PipelineRow[]).map((pipeline) => {
    const stageIds = stagesByPipeline.get(pipeline.id) ?? []
    const memberCount = stageIds.reduce((total, stageId) => total + (memberCountByStage.get(stageId) ?? 0), 0)

    return {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      stageCount: stageIds.length,
      memberCount,
      updatedAt: pipeline.updated_at,
    }
  })
}

/**
 * Loads one pipeline's full board: stages in order, each with its members
 * resolved against `comms_crm_contacts` for display (name, picture, etc).
 */
export async function loadCrmPipelineDetail(
  supabase: SupabaseClient<Database>,
  pipelineId: string
): Promise<CrmPipelineDetail | null> {
  const crmSupabase = supabase as unknown as CrmQueryClient

  const { data: pipeline, error: pipelineError } = await crmSupabase
    .from('comms_crm_pipelines')
    .select('id, name, description, updated_at')
    .eq('id', pipelineId)
    .maybeSingle()
  if (pipelineError || !pipeline) return null

  const [{ data: stages }, { data: members }] = await Promise.all([
    crmSupabase
      .from('comms_crm_pipeline_stages')
      .select('id, pipeline_id, name, position')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true }),
    crmSupabase
      .from('comms_crm_pipeline_members')
      .select('id, stage_id, contact_id, note, position')
      .order('position', { ascending: true }),
  ])

  const stageRows = (stages ?? []) as StageRow[]
  const stageIds = new Set(stageRows.map((stage) => stage.id))
  const memberRows = ((members ?? []) as MemberRow[]).filter((member) => stageIds.has(member.stage_id))
  const contactIds = Array.from(new Set(memberRows.map((member) => member.contact_id)))

  let contactsById = new Map<string, ContactLookupRow>()
  if (contactIds.length > 0) {
    const { data: contacts } = await crmSupabase
      .from('comms_crm_contacts')
      .select('id, full_name, picture_url, title, organisation, segment, person_type')
      .in('id', contactIds)
    contactsById = new Map(((contacts ?? []) as ContactLookupRow[]).map((contact) => [contact.id, contact]))
  }

  const membersByStage = new Map<string, CrmPipelineMember[]>()
  for (const member of memberRows) {
    const contact = contactsById.get(member.contact_id)
    if (!contact) continue

    const resolved: CrmPipelineMember = {
      id: member.id,
      contactId: contact.id,
      fullName: contact.full_name,
      pictureUrl: contact.picture_url,
      title: contact.title,
      organisation: contact.organisation,
      segment: contact.segment === 'internal' ? 'internal' : 'external',
      personType: normalizeCrmPersonType(contact.person_type),
      note: member.note,
      position: member.position,
    }
    membersByStage.set(member.stage_id, [...(membersByStage.get(member.stage_id) ?? []), resolved])
  }

  const resolvedStages: CrmPipelineStage[] = stageRows.map((stage) => ({
    id: stage.id,
    name: stage.name,
    position: stage.position,
    members: membersByStage.get(stage.id) ?? [],
  }))

  return {
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    stageCount: resolvedStages.length,
    memberCount: resolvedStages.reduce((total, stage) => total + stage.members.length, 0),
    updatedAt: pipeline.updated_at,
    stages: resolvedStages,
  }
}
