import Link from 'next/link'
import type { TeamDashboardData } from '@/lib/comms-dashboard-data'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'
import { TeamFeedContent } from '@/components/comms/team-feed'
import { WeeklyAgenda } from '@/components/comms/weekly-agenda'
import { TaskCreateForm } from '@/components/comms/task-create-form'
import { NewMembersSection } from '@/components/comms/new-members-section'
import { TeamTaskBoard } from '@/components/comms/team-task-board'
import { OrgNewsfeedCard } from '@/components/comms/org-newsfeed-card'
import type { OrgNewsfeedRunStatus } from '@/lib/ai/org-feed-config'
import type { DashboardLayoutState, DashboardWidgetContent } from '@/kernel/dashboard'
import { AdaptiveDashboard } from '@/kernel/ui/dashboard/adaptive-dashboard'

function formatShortDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-[var(--i2l-radius-card)] border border-neutral-200 bg-white p-4 shadow-[var(--i2l-shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{detail}</p>
    </div>
  )
}

export function TeamDashboard({
  data,
  initialLayout,
  readOnly = false,
  canApprove = false,
  newsfeedRunStatus = null,
}: {
  data: TeamDashboardData
  initialLayout: DashboardLayoutState
  readOnly?: boolean
  canApprove?: boolean
  newsfeedRunStatus?: OrgNewsfeedRunStatus | null
}) {
  const {
    channels,
    events,
    agendaGroups,
    agendaItems,
    teamMembers,
    teamTasks,
    newMembers,
    feed,
    owners,
    transcriptsByDate,
    transcriptOwners,
    aiEnabled,
    newsfeed,
  } = data

  const widgets: DashboardWidgetContent[] = [
    {
      id: 'team-tasks',
      content: <TeamTaskBoard tasks={teamTasks} />,
    },
    {
      id: 'meeting-agenda',
      content: (
        <WeeklyAgenda
          groups={agendaGroups}
          previousLimit={5}
          showAllHref="/app/comms/meetings"
          ownerOptions={teamMembers}
          transcriptsByDate={transcriptsByDate}
          transcriptOwners={transcriptOwners}
          aiEnabled={aiEnabled}
        />
      ),
    },
    {
      id: 'field-newsfeed',
      content: <OrgNewsfeedCard items={newsfeed} isAdmin={canApprove} aiEnabled={aiEnabled} initialRunStatus={newsfeedRunStatus} />,
    },
    {
      id: 'new-members',
      content: <NewMembersSection members={newMembers} teamMembers={teamMembers} canApprove={canApprove} />,
    },
    {
      id: 'events',
      actions: <Link href="/app/comms/events" className="text-xs font-semibold text-orange-700 hover:underline">View all</Link>,
      content: (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr><th className="px-4 py-3 text-left">Event</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Stage</th><th className="px-4 py-3 text-left">Owner</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {events.slice(0, 12).map((event) => {
                const stageMeta = EVENT_STAGE_META[event.stage as EventStage]
                return (
                  <tr key={event.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/app/comms/events/${event.id}`} className="font-medium text-neutral-900 hover:text-orange-700">
                        {event.name}
                        {event.is_annual_congress && <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Congress</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{formatShortDate(event.start_date)}</td>
                    <td className="px-4 py-3 capitalize text-neutral-600">{event.event_type}</td>
                    <td className="px-4 py-3 text-neutral-600">{stageMeta?.label ?? event.stage}</td>
                    <td className="px-4 py-3 text-neutral-600">{event.ownerLabel ?? '—'}</td>
                  </tr>
                )
              })}
              {events.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No events to show.</td></tr>}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'whatsapp-channels',
      actions: <Link href="/app/comms/intake" className="text-xs font-semibold text-orange-700 hover:underline">Open organizer</Link>,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <div key={channel.key} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">{channel.label}</h3>
                {channel.waitingCount > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{channel.waitingCount} waiting</span>}
              </div>
              <div className="mt-3 space-y-2">
                {channel.recent.map((signal) => (
                  <div key={signal.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                    <p className="text-xs font-semibold text-neutral-800">{signal.senderName}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{signal.summary}</p>
                  </div>
                ))}
                {channel.recent.length === 0 && <p className="rounded-lg border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-400">No recent signals.</p>}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'update-feed',
      content: <TeamFeedContent feed={feed} owners={owners} />,
    },
  ]

  return (
    <AdaptiveDashboard
      dashboardId="comms-team"
      initialLayout={initialLayout}
      widgets={widgets}
      readOnly={readOnly}
      subtitle="Team work, meetings, signals and monitoring in one adaptable workspace."
      headerActions={<TaskCreateForm teamMembers={teamMembers} agendaItems={agendaItems} />}
      kpis={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Open team tasks" value={teamTasks.length} detail="across owners" />
          <Stat label="Agenda topics" value={agendaItems.length} detail="meeting queue" />
          <Stat label="New members" value={newMembers.length} detail="onboarding" />
          <Stat label="Events" value={events.length} detail="in the active pipeline" />
        </div>
      }
    />
  )
}
