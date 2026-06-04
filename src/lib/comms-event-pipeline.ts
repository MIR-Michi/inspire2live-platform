import { isI2LOwnedEvent } from '@/lib/comms-events'
import { createClient } from '@/lib/supabase/server'
import { type EventStage } from '@/lib/comms-workflow'

export type EventScopeFilter = 'all' | 'i2l' | 'networking' | 'past'

const EVENT_PIPELINE_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, owner_id, stage, is_annual_congress, is_i2l_organised, attendance_kind, presentation_summary, presentation_asset_url, event_image_url, event_website_url, push_to_group_calendar, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'
const EVENT_PIPELINE_FALLBACK_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'

export async function loadCommsEventPipelineData({
  stageFilter = 'all',
  scopeFilter = 'all',
  eventTypeFilter = 'all',
}: {
  stageFilter?: 'all' | EventStage
  scopeFilter?: EventScopeFilter
  eventTypeFilter?: string
} = {}) {
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
    eventsData = (fallbackEvents ?? []).map((event) => ({
      ...event,
      owner_id: null,
      is_i2l_organised: false,
      attendance_kind: 'visitor',
      presentation_summary: null,
      presentation_asset_url: null,
      event_image_url: null,
      event_website_url: null,
      push_to_group_calendar: false,
    }))
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
    owner_id: string | null
    stage: string
    is_annual_congress: boolean
    is_i2l_organised: boolean
    attendance_kind: string
    presentation_summary: string | null
    presentation_asset_url: string | null
    event_image_url: string | null
    event_website_url: string | null
    push_to_group_calendar: boolean
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
      const effectiveOwned = isI2LOwnedEvent({
        eventType: event.event_type,
        isI2lOrganised: event.is_i2l_organised,
        isAnnualCongress: event.is_annual_congress,
      })
      if (scopeFilter === 'i2l') return effectiveOwned
      if (scopeFilter === 'networking') return !effectiveOwned
      if (scopeFilter === 'past') return new Date(event.end_date ?? event.start_date) < new Date()
      return true
    })
    .sort((a, b) => Number(b.is_annual_congress) - Number(a.is_annual_congress))
    .map((event) => ({
      ...event,
      initiativeLabels: (event.initiative_ids ?? []).map((id) => initiativeMap.get(id)).filter(Boolean) as string[],
      representativeLabels: (event.i2l_representatives ?? []).map((id) => profileMap.get(id)).filter(Boolean) as string[],
      ownerLabel: event.owner_id ? profileMap.get(event.owner_id) ?? null : null,
      outputs: [
        { label: 'Report', done: event.output_report_drafted },
        { label: 'LinkedIn', done: event.output_linkedin_published },
        { label: 'Newsletter', done: event.output_newsletter_mentioned },
        { label: 'Media', done: event.output_media_stored },
      ],
    }))

  return {
    events: filteredEvents,
    eventTypes: Array.from(new Set((eventsData ?? []).map((event) => event.event_type))).sort(),
    initiatives: (initiatives ?? []).map((initiative) => ({ id: initiative.id, label: initiative.title })),
    people: (profiles ?? []).map((profile) => ({ id: profile.id, label: profile.name ?? profile.email ?? 'Unknown' })),
  }
}
