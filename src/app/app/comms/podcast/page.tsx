import { EventsPipelineShell } from '@/components/comms/events-pipeline-shell'
import { loadCommsEventPipelineData } from '@/lib/comms-event-pipeline'
import { type EventStage } from '@/lib/comms-workflow'

const VALID_STAGES = new Set<EventStage>(['announced', 'attending', 'in_progress', 'post_event', 'archived'])

export default async function CommsPodcastPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>
}) {
  const params = (await searchParams) ?? {}
  const stageFilter =
    params.stage && VALID_STAGES.has(params.stage as EventStage) ? (params.stage as EventStage) : 'all'
  const { events, initiatives, people } = await loadCommsEventPipelineData({
    stageFilter,
    eventTypeFilter: 'podcast',
  })

  return (
    <EventsPipelineShell
      events={events}
      stageFilter={stageFilter}
      eventTypeFilter="podcast"
      eventTypes={['podcast']}
      initiatives={initiatives}
      people={people}
      title="Podcast production"
      eyebrow="I2L productions"
      description="Run podcast episodes as owned communications productions with one accountable owner, clear setup, and structured follow-up."
      recordLabel="episodes"
      basePath="/app/comms/podcast"
      detailBasePath="/app/comms/events"
      showEventTypeFilters={false}
    />
  )
}
