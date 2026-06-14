import { CommsCrmWorkspace } from '@/components/comms/comms-crm-workspace'
import { matchesCrmQuery, normalizeCrmPersonType, type CrmSegment } from '@/lib/comms-crm'
import { loadCrmDirectory } from '@/lib/comms-crm-data'
import { createClient } from '@/lib/supabase/server'

const VALID_SEGMENTS = new Set(['all', 'internal', 'external'])
const VALID_FILTERS = new Set(['follow_up', 'privacy_review'])

export default async function CommsCrmPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<{ segment?: string; type?: string; filter?: string; q?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeSegment =
    params.segment && VALID_SEGMENTS.has(params.segment) ? (params.segment as 'all' | CrmSegment) : 'all'
  const activePersonType = normalizeCrmPersonType(params.type) ?? (params.type === 'unclassified' ? 'unclassified' : null)
  const activeFilter = params.filter && VALID_FILTERS.has(params.filter) ? (params.filter as 'follow_up' | 'privacy_review') : null
  const query = params.q?.trim().toLowerCase() ?? ''

  const supabase = await createClient()
  const directory = await loadCrmDirectory(supabase)
  const { records } = directory

  const visibleRecords = records.filter((record) => {
    if (activeSegment !== 'all' && record.segment !== activeSegment) return false
    if (activePersonType === 'unclassified' && record.personType) return false
    if (activePersonType && activePersonType !== 'unclassified' && record.personType !== activePersonType) return false
    if (activeFilter === 'follow_up' && record.health !== 'follow_up' && !record.nextFollowUpAt) return false
    if (activeFilter === 'privacy_review' && record.consentStatus !== 'unknown' && !record.retentionReviewAt) return false

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
        ...record.fieldOfExpertise,
        ...record.skills,
      ],
      query
    )
  })

  return (
    <CommsCrmWorkspace
      records={records}
      visibleRecords={visibleRecords}
      activeSegment={activeSegment}
      activePersonType={params.type ?? ''}
      activeFilter={activeFilter}
      query={params.q?.trim() ?? ''}
      people={directory.people}
      initiatives={directory.initiatives}
      events={directory.events}
      crmReady={directory.crmReady}
    />
  )
}
