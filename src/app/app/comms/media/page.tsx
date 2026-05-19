import { MediaLibraryShell } from '@/components/comms/media-library-shell'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import { createClient } from '@/lib/supabase/server'

export default async function CommsMediaPage() {
  const supabase = await createClient()
  const [
    { data: assetsData },
    { data: recoveryData },
    { data: offerData },
    { data: eventsData },
    { data: sessionsData },
    { data: initiativesData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from('media_assets')
      .select(
        'id, title, asset_type, sharepoint_url, rights_status, tags, usage_count, created_at, event_id, session_id, contributed_by'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('media_recovery_requests')
      .select('id, title, summary, status, created_at, initiative_id, event_id, session_id')
      .order('created_at', { ascending: false }),
    supabase
      .from('media_recovery_offers')
      .select('id, recovery_request_id, offered_by, notes, sharepoint_url, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('events').select('id, name').order('start_date', { ascending: false }),
    supabase.from('campus_sessions').select('id, theme, session_date').order('session_date', { ascending: false }),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase.from('profiles').select('id, name, email').order('name'),
  ])

  const eventMap = new Map((eventsData ?? []).map((event) => [event.id, event.name]))
  const sessionMap = new Map(
    (sessionsData ?? []).map((session) => [
      session.id,
      session.theme || new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(session.session_date)),
    ])
  )
  const initiativeMap = new Map((initiativesData ?? []).map((initiative) => [initiative.id, initiative.title]))
  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile.name ?? profile.email ?? 'Unknown contributor'])
  )

  const offersByRequest: Record<
    string,
    Array<{
      id: string
      recovery_request_id: string
      offered_by: string
      notes: string
      sharepoint_url: string | null
      created_at: string
    }>
  > = {}

  for (const offer of offerData ?? []) {
    const key = offer.recovery_request_id
    offersByRequest[key] = offersByRequest[key] ?? []
    offersByRequest[key].push(offer)
  }

  return (
    <MediaLibraryShell
      assets={(assetsData ?? []).map((asset) => ({
        ...asset,
        eventLabel: asset.event_id ? eventMap.get(asset.event_id) ?? null : null,
        sessionLabel: asset.session_id ? sessionMap.get(asset.session_id) ?? null : null,
        contributorLabel: asset.contributed_by ? profileMap.get(asset.contributed_by) ?? null : null,
      }))}
      recoveryRequests={(recoveryData ?? []).map((request) => ({
        ...request,
        initiativeLabel: request.initiative_id ? initiativeMap.get(request.initiative_id) ?? null : null,
        eventLabel: request.event_id ? eventMap.get(request.event_id) ?? null : null,
        sessionLabel: request.session_id ? sessionMap.get(request.session_id) ?? null : null,
        offers: (offersByRequest[request.id] ?? []).map((offer) => ({
          id: offer.id,
          offered_by: offer.offered_by,
          notes: offer.notes,
          sharepoint_url: offer.sharepoint_url,
          created_at: offer.created_at,
        })),
      }))}
      events={(eventsData ?? []).map((event) => ({ id: event.id, label: event.name }))}
      sessions={(sessionsData ?? []).map((session) => ({
        id: session.id,
        label:
          session.theme ||
          new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(session.session_date)),
      }))}
      initiatives={(initiativesData ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title }))}
      stubFlags={getIntegrationStubFlags()}
    />
  )
}
