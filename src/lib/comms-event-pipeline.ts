import { createClient } from '@/lib/supabase/server'
import { type EventStage } from '@/lib/comms-workflow'

const EVENT_PIPELINE_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, owner_id, stage, is_annual_congress, is_i2l_organised, attendance_kind, presentation_summary, presentation_asset_url, event_image_url, event_website_url, push_to_group_calendar, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'
const EVENT_PIPELINE_FALLBACK_SELECT =
  'id, name, event_type, start_date, end_date, location_city, location_country, organiser, stage, is_annual_congress, initiative_ids, i2l_representatives, output_report_drafted, output_linkedin_published, output_newsletter_mentioned, output_media_stored'

export async function loadCommsEventPipelineData({
  stageFilter = 'all',
  eventTypeFilter = 'all',
}: {
  stageFilter?: 'all' | EventStage
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
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
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
