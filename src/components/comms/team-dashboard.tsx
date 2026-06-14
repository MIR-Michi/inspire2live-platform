import Link from 'next/link'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { TileGroup } from '@/components/ui/tile-group'
import type { TeamDashboardData } from '@/lib/comms-dashboard-data'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'
import { formatMeetingLabel } from '@/lib/comms-agenda'
import { TeamFeed } from '@/components/comms/team-feed'
import { AgendaAddForm } from '@/components/comms/agenda-add-form'
import { AgendaItemCard } from '@/components/comms/agenda-item-card'
import { TaskCreateForm } from '@/components/comms/task-create-form'

function formatShortDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function TeamDashboard({ data }: { data: TeamDashboardData }) {
  const { channels, events, agendaGroups, agendaItems, teamMembers, feed, owners } = data

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TaskCreateForm teamMembers={teamMembers} agendaItems={agendaItems} />
      </div>

      <TileGroup groupId="comms-team-dashboard" className="space-y-6">
        {/* ── WhatsApp channels ── */}
        <CollapsibleCard key="comms-team-channels" title="WhatsApp channels" storageKey="comms-team-channels">
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((channel) => (
              <div key={channel.key} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">{channel.label}</h3>
                  {channel.waitingCount > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                      {channel.waitingCount} waiting
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {channel.recent.map((signal) => (
                    <div key={signal.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                      <p className="text-xs font-semibold text-neutral-800">{signal.senderName}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{signal.summary}</p>
                    </div>
                  ))}
                  {channel.recent.length === 0 && (
                    <p className="rounded-lg border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-400">
                      No recent signals.
                    </p>
                  )}
                </div>
                <Link
                  href="/app/comms/intake"
                  className="mt-3 inline-flex text-xs font-semibold text-orange-700 hover:underline"
                >
                  Open channel intake →
                </Link>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        {/* ── Events ── */}
        <CollapsibleCard
          key="comms-team-events"
          title="Events"
          storageKey="comms-team-events"
          actions={
            <Link href="/app/comms/events" className="text-sm font-medium text-orange-600 hover:underline">
              All events →
            </Link>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Stage</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {events.slice(0, 12).map((event) => {
                  const stageMeta = EVENT_STAGE_META[event.stage as EventStage]
                  return (
                    <tr key={event.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/comms/events/${event.id}`}
                          className="font-medium text-neutral-900 hover:text-orange-700"
                        >
                          {event.name}
                          {event.is_annual_congress && (
                            <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                              Congress
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{formatShortDate(event.start_date)}</td>
                      <td className="px-4 py-3 capitalize text-neutral-600">{event.event_type}</td>
                      <td className="px-4 py-3 text-neutral-600">{stageMeta?.label ?? event.stage}</td>
                      <td className="px-4 py-3 text-neutral-600">{event.ownerLabel ?? '—'}</td>
                    </tr>
                  )
                })}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      No events to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>

        {/* ── Weekly meeting agenda ── */}
        <CollapsibleCard key="comms-team-agenda" title="Weekly meeting agenda" storageKey="comms-team-agenda">
          <div className="space-y-4">
            {agendaGroups.map((group) => (
              <div
                key={group.meetingDate}
                className={`rounded-2xl border p-4 shadow-sm ${
                  group.isUpcoming ? 'border-orange-200 bg-orange-50/60' : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Meeting — {formatMeetingLabel(group.meetingDate)}
                    {group.isUpcoming && (
                      <span className="ml-2 rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                        Upcoming
                      </span>
                    )}
                  </h3>
                  {group.isUpcoming && <AgendaAddForm meetingDate={group.meetingDate} />}
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <AgendaItemCard key={item.id} item={item} />
                  ))}
                  {group.items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                      No agenda items yet. Add the first one for this meeting.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        {/* ── Update feed ── */}
        <TeamFeed key="comms-team-feed" feed={feed} owners={owners} />
      </TileGroup>
    </div>
  )
}
