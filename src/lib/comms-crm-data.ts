import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getRoleLabel } from '@/lib/role-access'
import {
  deriveRelationshipHealth,
  normalizeCrmConsent,
  normalizeCrmLifecycle,
  normalizeCrmPersonType,
  normalizeProjectLabels,
  type CrmConnectorBacklogItem,
  type CrmContactRecord,
  type CrmPipelineDetail,
  type CrmPipelineMember,
  type CrmPipelineStage,
  type CrmPipelineSummary,
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

function mergeText(primary: string | null | undefined, fallback: string | null | undefined) {
  return primary ?? fallback ?? null
}

function mergeArray(primary: string[] | null | undefined, fallback: string[] | null | undefined) {
  return primary && primary.length > 0 ? primary : fallback ?? []
}

/**
 * Loads and merges the full CRM directory: platform profiles, campus
 * stakeholder records, and dedicated CRM enrichment rows, into one list of
 * `CrmContactRecord`s. Shared by the CRM hub (for counts) and the People view
 * (for the full searchable list) so both stay consistent.
 */
export async function loadCrmDirectory(supabase: SupabaseClient<Database>): Promise<CrmDirectory> {
  const crmSupabase = supabase as unknown as CrmQueryClient

  const [
    { data: profiles },
    { data: initiativeMembers },
    { data: initiatives },
    { data: campusMembers },
    { data: events },
    crmContactsResult,
    crmInitiativesResult,
    crmEventsResult,
    crmInteractionsResult,
    connectorBacklogResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url, bio, city, country, organization, role, expertise_tags, last_active_at')
      .order('name'),
    supabase.from('initiative_members').select('user_id, initiative_id, role'),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase
      .from('campus_members')
      .select('id, name, organisation, role_description, country, platform_profile_id, initiative_affiliations, last_channel_activity, date_welcomed, welcomed_by_peter, notes')
      .order('name'),
    supabase.from('events').select('id, name, event_type, start_date').order('start_date', { ascending: false }).limit(160),
    crmSupabase.from('comms_crm_contacts').select('*').order('updated_at', { ascending: false }),
    crmSupabase.from('comms_crm_contact_initiatives').select('contact_id, initiative_id'),
    crmSupabase.from('comms_crm_contact_events').select('contact_id, event_id, relationship_type'),
    crmSupabase
      .from('comms_crm_interactions')
      .select('id, contact_id, interaction_type, summary, occurred_at, next_follow_up_at')
      .order('occurred_at', { ascending: false })
      .limit(200),
    crmSupabase.from('comms_crm_connector_backlog').select('*').order('integration_target'),
  ])

  const initiativeMap = new Map((initiatives ?? []).map((initiative) => [initiative.id, initiative.title]))
  const eventMap = new Map(
    (events ?? []).map((event) => [
      event.id,
      `${event.name}${event.event_type === 'podcast' ? ' (Podcast)' : ''}`,
    ])
  )
  const membershipMap = new Map<string, string[]>()

  for (const membership of initiativeMembers ?? []) {
    const title = initiativeMap.get(membership.initiative_id)
    if (!title) continue
    const current = membershipMap.get(membership.user_id) ?? []
    membershipMap.set(membership.user_id, Array.from(new Set([...current, title])))
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const ownerMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.name ?? profile.email]))

  const internalRecords: CrmContactRecord[] = (profiles ?? [])
    .filter((profile) => profile.role !== 'IndustryPartner')
    .map((profile) => ({
      id: `profile:${profile.id}`,
      crmContactId: null,
      sourceType: 'profile' as CrmSourceType,
      sourceId: profile.id,
      fullName: profile.name,
      segment: 'internal' as CrmSegment,
      personType: profile.role === 'Comms' ? 'comms' : null,
      fieldOfExpertise: [],
      skills: profile.expertise_tags ?? [],
      pictureUrl: profile.avatar_url,
      bio: profile.bio,
      title: getRoleLabel(profile.role),
      organisation: profile.organization,
      associatedProjects: membershipMap.get(profile.id) ?? [],
      associatedProjectIds: (initiativeMembers ?? [])
        .filter((membership) => membership.user_id === profile.id)
        .map((membership) => membership.initiative_id),
      associatedEvents: [],
      associatedEventIds: [],
      email: profile.email,
      phone: null,
      city: profile.city,
      country: profile.country,
      preferredChannel: 'Email',
      relationshipOwner: profile.role === 'Comms' ? 'Communications team' : null,
      relationshipOwnerId: null,
      health: deriveRelationshipHealth(profile.last_active_at),
      lastInteractionAt: profile.last_active_at,
      nextFollowUpAt: null,
      consentStatus: 'not_required' as const,
      privacyNotes: null,
      retentionReviewAt: null,
      sourceLabel: profile.role === 'Comms' ? 'Comms workspace profile' : 'Platform profile',
      tags: [...(profile.expertise_tags ?? []), profile.role === 'Comms' ? 'comms' : 'internal'].filter(Boolean),
      notes: null,
      recentInteractions: [],
    }))

  const externalRecords: CrmContactRecord[] = (campusMembers ?? []).map((member) => {
    const linkedProfile = member.platform_profile_id ? profileMap.get(member.platform_profile_id) ?? null : null
    const lastInteractionAt = member.last_channel_activity ?? member.date_welcomed ?? null
    const associatedProjectIds = (member.initiative_affiliations ?? []).filter((value) => initiativeMap.has(value))

    return {
      id: `campus_member:${member.id}`,
      crmContactId: null,
      sourceType: 'campus_member' as CrmSourceType,
      sourceId: member.id,
      fullName: member.name,
      segment: 'external' as CrmSegment,
      personType: null,
      fieldOfExpertise: [],
      skills: [],
      pictureUrl: linkedProfile?.avatar_url ?? null,
      bio: linkedProfile?.bio ?? member.role_description ?? member.notes,
      title: member.role_description,
      organisation: member.organisation ?? linkedProfile?.organization ?? null,
      associatedProjects: normalizeProjectLabels(member.initiative_affiliations, initiativeMap),
      associatedProjectIds,
      associatedEvents: [],
      associatedEventIds: [],
      email: linkedProfile?.email ?? null,
      phone: null,
      city: linkedProfile?.city ?? null,
      country: member.country ?? linkedProfile?.country ?? null,
      preferredChannel: linkedProfile?.email ? 'Email' : 'WhatsApp / community',
      relationshipOwner: member.welcomed_by_peter ? 'Peter' : 'Communications team',
      relationshipOwnerId: null,
      health: deriveRelationshipHealth(lastInteractionAt),
      lastInteractionAt,
      nextFollowUpAt: null,
      consentStatus: 'unknown' as const,
      privacyNotes: null,
      retentionReviewAt: null,
      sourceLabel: linkedProfile ? 'Campus + platform profile' : 'Campus stakeholder record',
      tags: normalizeProjectLabels(member.initiative_affiliations, initiativeMap),
      notes: member.notes,
      recentInteractions: [],
    }
  })

  const crmContacts = crmContactsResult.error ? [] : crmContactsResult.data ?? []
  const crmInitiatives = crmInitiativesResult.error ? [] : crmInitiativesResult.data ?? []
  const crmEventLinks = crmEventsResult.error ? [] : crmEventsResult.data ?? []
  const crmInteractions = crmInteractionsResult.error ? [] : crmInteractionsResult.data ?? []
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

  const projectIdsByContact = new Map<string, string[]>()
  for (const link of crmInitiatives) {
    projectIdsByContact.set(link.contact_id, [...(projectIdsByContact.get(link.contact_id) ?? []), link.initiative_id])
  }

  const eventIdsByContact = new Map<string, string[]>()
  for (const link of crmEventLinks) {
    eventIdsByContact.set(link.contact_id, [...(eventIdsByContact.get(link.contact_id) ?? []), link.event_id])
  }

  const interactionsByContact = new Map<string, CrmContactRecord['recentInteractions']>()
  for (const interaction of crmInteractions) {
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

  const baseBySource = new Map(
    [...internalRecords, ...externalRecords].map((record) => [`${record.sourceType}:${record.sourceId}`, record])
  )
  const recordsByKey = new Map<string, CrmContactRecord>()

  for (const record of [...internalRecords, ...externalRecords]) {
    recordsByKey.set(record.id, record)
  }

  for (const contact of crmContacts) {
    const base = contact.source_id ? baseBySource.get(`${contact.source_type}:${contact.source_id}`) ?? null : null
    // Internal people are owned by their platform profile: their core identity
    // (name, picture, bio, role, organisation, expertise, location, email) is the
    // single source of truth and always wins over anything stored on the CRM row,
    // so the profile and the CRM stay synchronised. The CRM row only contributes
    // relationship data (owner, lifecycle, consent, follow-up, tags, notes).
    const isInternalProfile = Boolean(base) && base!.sourceType === 'profile'
    const projectIds = projectIdsByContact.get(contact.id) ?? base?.associatedProjectIds ?? []
    const eventIds = eventIdsByContact.get(contact.id) ?? []
    const ownerLabel = contact.relationship_owner_id
      ? ownerMap.get(contact.relationship_owner_id) ?? contact.relationship_owner_label
      : contact.relationship_owner_label

    const record: CrmContactRecord = {
      id: contact.id,
      crmContactId: contact.id,
      sourceType: contact.source_type as CrmSourceType,
      sourceId: contact.source_id,
      fullName: isInternalProfile ? base!.fullName : contact.full_name,
      segment: isInternalProfile ? 'internal' : (contact.segment as CrmSegment),
      personType: normalizeCrmPersonType(contact.person_type) ?? base?.personType ?? null,
      fieldOfExpertise: isInternalProfile ? base!.fieldOfExpertise : mergeArray(contact.field_of_expertise, base?.fieldOfExpertise),
      skills: isInternalProfile ? base!.skills : mergeArray(contact.skills, base?.skills),
      pictureUrl: isInternalProfile ? base!.pictureUrl : mergeText(contact.picture_url, base?.pictureUrl),
      bio: isInternalProfile ? base!.bio : mergeText(contact.bio, base?.bio),
      title: isInternalProfile ? base!.title : mergeText(contact.title, base?.title),
      organisation: isInternalProfile ? base!.organisation : mergeText(contact.organisation, base?.organisation),
      associatedProjects: projectIds.map((id) => initiativeMap.get(id)).filter(Boolean) as string[],
      associatedProjectIds: projectIds,
      associatedEvents: eventIds.map((id) => eventMap.get(id)).filter(Boolean) as string[],
      associatedEventIds: eventIds,
      email: isInternalProfile ? base!.email : mergeText(contact.email, base?.email),
      phone: contact.phone,
      city: isInternalProfile ? base!.city : mergeText(contact.city, base?.city),
      country: isInternalProfile ? base!.country : mergeText(contact.country, base?.country),
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
      tags: contact.tags.length > 0 ? contact.tags : base?.tags ?? [],
      notes: contact.notes ?? base?.notes ?? null,
      recentInteractions: (interactionsByContact.get(contact.id) ?? []).slice(0, 3),
    }

    recordsByKey.delete(`${contact.source_type}:${contact.source_id}`)
    recordsByKey.set(record.id, record)
  }

  const records = Array.from(recordsByKey.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))

  return {
    records,
    people: (profiles ?? []).map((profile) => ({ id: profile.id, label: profile.name ?? profile.email })),
    initiatives: (initiatives ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title })),
    events: (events ?? []).map((event) => ({
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
