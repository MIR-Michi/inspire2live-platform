import { CommsCrmWorkspace } from '@/components/comms/comms-crm-workspace'
import {
  deriveRelationshipHealth,
  matchesCrmQuery,
  normalizeProjectLabels,
  normalizeCrmConsent,
  normalizeCrmLifecycle,
  type CrmConnectorBacklogItem,
  type CrmContactRecord,
  type CrmSelectOption,
  type CrmSegment,
  type CrmSourceType,
} from '@/lib/comms-crm'
import { createClient } from '@/lib/supabase/server'

const VALID_SEGMENTS = new Set(['all', 'internal', 'external'])

type CrmQueryClient = {
  from: (table: string) => any
}

function mergeText(primary: string | null | undefined, fallback: string | null | undefined) {
  return primary ?? fallback ?? null
}

export default async function CommsCrmPage({
  searchParams,
}: {
  searchParams?: Promise<{ segment?: string; q?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeSegment =
    params.segment && VALID_SEGMENTS.has(params.segment) ? (params.segment as 'all' | CrmSegment) : 'all'
  const query = params.q?.trim().toLowerCase() ?? ''
  const supabase = await createClient()
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
      .select('id, name, email, avatar_url, bio, city, country, organization, role, expertise_tags, last_active_at, user_type, comms_team')
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
    .filter((profile) => profile.user_type !== 'partner')
    .map((profile) => ({
      id: `profile:${profile.id}`,
      crmContactId: null,
      sourceType: 'profile' as CrmSourceType,
      sourceId: profile.id,
      fullName: profile.name,
      segment: 'internal' as CrmSegment,
      pictureUrl: profile.avatar_url,
      bio: profile.bio,
      title: profile.role,
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
      relationshipOwner: profile.comms_team ? 'Communications team' : null,
      relationshipOwnerId: null,
      health: deriveRelationshipHealth(profile.last_active_at),
      lastInteractionAt: profile.last_active_at,
      nextFollowUpAt: null,
      consentStatus: 'not_required' as const,
      privacyNotes: null,
      retentionReviewAt: null,
      sourceLabel: profile.user_type === 'comms' ? 'Comms workspace profile' : 'Platform profile',
      tags: [...(profile.expertise_tags ?? []), profile.user_type === 'comms' ? 'comms' : 'internal'].filter(Boolean),
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
      fullName: contact.full_name,
      segment: contact.segment as CrmSegment,
      pictureUrl: mergeText(contact.picture_url, base?.pictureUrl),
      bio: mergeText(contact.bio, base?.bio),
      title: mergeText(contact.title, base?.title),
      organisation: mergeText(contact.organisation, base?.organisation),
      associatedProjects: projectIds.map((id) => initiativeMap.get(id)).filter(Boolean) as string[],
      associatedProjectIds: projectIds,
      associatedEvents: eventIds.map((id) => eventMap.get(id)).filter(Boolean) as string[],
      associatedEventIds: eventIds,
      email: mergeText(contact.email, base?.email),
      phone: contact.phone,
      city: mergeText(contact.city, base?.city),
      country: mergeText(contact.country, base?.country),
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
  const visibleRecords = records.filter((record) => {
    if (activeSegment !== 'all' && record.segment !== activeSegment) return false
    return matchesCrmQuery(
      [
        record.fullName,
        record.bio,
        record.title,
        record.organisation,
        record.relationshipOwner,
        record.sourceLabel,
        record.email,
        record.phone,
        ...record.associatedProjects,
        ...record.associatedEvents,
        ...record.tags,
      ],
      query
    )
  })

  return (
    <CommsCrmWorkspace
      records={records}
      visibleRecords={visibleRecords}
      activeSegment={activeSegment}
      query={params.q?.trim() ?? ''}
      people={(profiles ?? []).map((profile) => ({ id: profile.id, label: profile.name ?? profile.email }))}
      initiatives={(initiatives ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title }))}
      events={(events ?? []).map((event) => ({
        id: event.id,
        label: event.name,
        meta: `${event.event_type}${event.start_date ? ` · ${event.start_date}` : ''}`,
      } satisfies CrmSelectOption))}
      connectorBacklog={connectorBacklog}
      crmReady={!crmContactsResult.error}
    />
  )
}
