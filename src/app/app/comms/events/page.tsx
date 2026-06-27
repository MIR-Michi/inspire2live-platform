import { EventsPipelineShell } from '@/components/comms/events-pipeline-shell'
import { loadCommsEventPipelineData } from '@/lib/comms-event-pipeline'
import { type EventStage } from '@/lib/comms-workflow'

const VALID_STAGES = new Set<EventStage>(['announced', 'attending', 'in_progress', 'post_event', 'archived'])

export default async function CommsEventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string; event_type?: string }>
}) {
  const params = (await searchParams) ?? {}
  const stageFilter =
    params.stage && VALID_STAGES.has(params.stage as EventStage) ? (params.stage as EventStage) : 'all'
  const eventTypeFilter = params.event_type?.trim() || 'all'
  const { events, eventTypes, initiatives, people } = await loadCommsEventPipelineData({
    stageFilter,
    eventTypeFilter,
  })

  return (
    <EventsPipelineShell
      events={events}
      stageFilter={stageFilter}
      eventTypeFilter={eventTypeFilter}
      eventTypes={eventTypes}
      initiatives={initiatives}
      people={people}
    />
  )
}
