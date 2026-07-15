import { CommsCrmWorkspace } from '@/components/comms/comms-crm-workspace'
import { matchesCrmQuery, normalizeCrmPersonType, type CrmContactKind } from '@/lib/comms-crm'
import { loadCrmDirectory } from '@/lib/comms-crm-data'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'

const VALID_KINDS = new Set(['all', 'internal_user', 'internal_contact', 'external'])
const VALID_FILTERS = new Set(['follow_up', 'privacy_review', 'campus'])

export default async function CommsCrmPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; type?: string; filter?: string; q?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeKind =
    params.kind && VALID_KINDS.has(params.kind) ? (params.kind as 'all' | CrmContactKind) : 'all'
  const activePersonType = normalizeCrmPersonType(params.type) ?? (params.type === 'unclassified' ? 'unclassified' : null)
  const activeFilter = params.filter && VALID_FILTERS.has(params.filter) ? (params.filter as 'follow_up' | 'privacy_review' | 'campus') : null
  const query = params.q?.trim().toLowerCase() ?? ''

  const supabase = await createClient()
  const directory = await loadCrmDirectory(supabase)
  const { records } = directory

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = isPlatformAdmin(profile?.role)
  }

  const visibleRecords = records.filter((record) => {
    if (activeKind !== 'all' && record.contactKind !== activeKind) return false
    if (activePersonType === 'unclassified' && record.personType) return false
    if (activePersonType && activePersonType !== 'unclassified' && record.personType !== activePersonType) return false
    if (activeFilter === 'follow_up' && record.health !== 'follow_up' && !record.nextFollowUpAt) return false
    if (activeFilter === 'privacy_review' && record.consentStatus !== 'unknown' && !record.retentionReviewAt) return false
    if (activeFilter === 'campus' && !record.isCampusMember) return false

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
      activeKind={activeKind}
      activePersonType={params.type ?? ''}
      activeFilter={activeFilter}
      query={params.q?.trim() ?? ''}
      people={directory.people}
      initiatives={directory.initiatives}
      events={directory.events}
      crmReady={directory.crmReady}
      isAdmin={isAdmin}
    />
  )
}
