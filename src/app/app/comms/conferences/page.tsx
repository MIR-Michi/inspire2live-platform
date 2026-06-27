import { EventsPipelineShell } from '@/components/comms/events-pipeline-shell'
import { loadCommsEventPipelineData } from '@/lib/comms-event-pipeline'
import { type EventStage } from '@/lib/comms-workflow'

const VALID_STAGES = new Set<EventStage>(['announced', 'attending', 'in_progress', 'post_event', 'archived'])

export default async function CommsConferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>
}) {
  const params = (await searchParams) ?? {}
  const stageFilter =
    params.stage && VALID_STAGES.has(params.stage as EventStage) ? (params.stage as EventStage) : 'all'
  const { events, initiatives, people } = await loadCommsEventPipelineData({
    stageFilter,
    eventTypeFilter: 'conference',
  })

  return (
    <EventsPipelineShell
      events={events}
      stageFilter={stageFilter}
      eventTypeFilter="conference"
      eventTypes={['conference']}
      initiatives={initiatives}
      people={people}
      title="Conferences"
      eyebrow="External and I2L conference work"
      description="Track conference attendance, presentations, owned conference activities, outputs, and follow-up."
      recordLabel="conferences"
      basePath="/app/comms/conferences"
      detailBasePath="/app/comms/events"
      showEventTypeFilters={false}
    />
  )
}
