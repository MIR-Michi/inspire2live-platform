import { EventsPipelineShell } from '@/components/comms/events-pipeline-shell'
import { createClient } from '@/lib/supabase/server'
import { type EventStage } from '@/lib/comms-workflow'

const VALID_STAGES = new Set<EventStage>(['announced', 'attending', 'in_progress', 'post_event', 'archived'])
const VALID_SCOPES = new Set(['all', 'i2l', 'networking', 'past'])
const EVENT_PIPELINE_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, is_i2l_organised, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'
const EVENT_PIPELINE_FALLBACK_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'

export default async function CommsEventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string; scope?: string; event_type?: string }>
}) {
  const params = (await searchParams) ?? {}
  const stageFilter =
    params.stage && VALID_STAGES.has(params.stage as EventStage) ? (params.stage as EventStage) : 'all'
  const scopeFilter = params.scope && VALID_SCOPES.has(params.scope) ? params.scope : 'all'
  const eventTypeFilter = params.event_type?.trim() || 'all'

  const supabase = await createClient()
  const [{ data: eventsWithOwnership, error: eventsWithOwnershipError }, { data: profiles }, { data: initiatives }] = await Promise.all([
    supabase.from('events').select(EVENT_PIPELINE_SELECT).order('start_date', { ascending: false }),
    supabase.from('profiles').select('id, name, email').order('name'),
    supabase.from('initiatives').select('id, title').order('title'),
  ])
  let eventsData = eventsWithOwnership
  if (eventsWithOwnershipError) {
    const { data: fallbackEvents } = await supabase
      .from('events')
      .select(EVENT_PIPELINE_FALLBACK_SELECT)
      .order('start_date', { ascending: false })
    eventsData = (fallbackEvents ?? []).map((event) => ({ ...event, is_i2l_organised: false }))
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.name ?? profile.email]))
  const initiativeMap = new Map((initiatives ?? []).map((initiative) => [initiative.id, initiative.title]))

  const filteredEvents = ((eventsData ?? []) as Array<{
    id: string
    name: string
    event_type: string
    start_date: string
    end_date: string | null
    location_city: string | null
    location_country: string | null
    organiser: string | null
    stage: string
    is_annual_congress: boolean
    is_i2l_organised: boolean
    initiative_ids: string[] | null
    i2l_representatives: string[] | null
    output_report_drafted: boolean
    output_linkedin_published: boolean
    output_newsletter_mentioned: boolean
    output_media_stored: boolean
  }>)
    .filter((event) => stageFilter === 'all' || event.stage === stageFilter)
    .filter((event) => eventTypeFilter === 'all' || event.event_type === eventTypeFilter)
    .filter((event) => {
      if (scopeFilter === 'i2l') return event.is_i2l_organised || event.is_annual_congress
      if (scopeFilter === 'networking') return !event.is_i2l_organised && !event.is_annual_congress
      if (scopeFilter === 'past') return new Date(event.end_date ?? event.start_date) < new Date()
      return true
    })
    .sort((a, b) => Number(b.is_annual_congress) - Number(a.is_annual_congress))
    .map((event) => ({
      ...event,
      initiativeLabels: (event.initiative_ids ?? []).map((id) => initiativeMap.get(id)).filter(Boolean) as string[],
      representativeLabels: (event.i2l_representatives ?? []).map((id) => profileMap.get(id)).filter(Boolean) as string[],
      outputs: [
        { label: 'Report', done: event.output_report_drafted },
        { label: 'LinkedIn', done: event.output_linkedin_published },
        { label: 'Newsletter', done: event.output_newsletter_mentioned },
        { label: 'Media', done: event.output_media_stored },
      ],
    }))

  return (
    <EventsPipelineShell
      events={filteredEvents}
      stageFilter={stageFilter}
      scopeFilter={scopeFilter as 'all' | 'i2l' | 'networking' | 'past'}
      eventTypeFilter={eventTypeFilter}
      eventTypes={Array.from(new Set((eventsData ?? []).map((event) => event.event_type))).sort()}
      initiatives={(initiatives ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title }))}
    />
  )
}
