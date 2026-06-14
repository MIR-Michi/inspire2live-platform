import Link from 'next/link'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { TileGroup } from '@/components/ui/tile-group'
import { TaskStatusControl } from '@/components/comms/task-status-control'
import type { CommsTaskRecord } from '@/lib/comms-tasks'
import type {
  PersonalTask,
  PersonalContentItem,
  PersonalIncomingItem,
  PersonalProjectSummary,
  PersonalDecision,
} from '@/lib/comms-personal-dashboard-data'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

function formatShortDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function CommsDashboardPanel({
  name,
  tasks,
  commsTasks,
  contentItems,
  incomingItems,
  projectSummaries,
  decisions,
}: {
  name: string | null | undefined
  tasks: PersonalTask[]
  commsTasks: CommsTaskRecord[]
  contentItems: PersonalContentItem[]
  incomingItems: PersonalIncomingItem[]
  projectSummaries: PersonalProjectSummary[]
  decisions: PersonalDecision[]
}) {
  const firstName = (name ?? 'there').split(' ')[0]
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const openCommsTasks = commsTasks.filter((task) => task.status !== 'completed' && task.status !== 'skipped')
  const dueSoon = [
    ...openTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.due_date,
      label: task.priority,
      href: `/app/initiatives/${task.initiative_id}/tasks`,
    })),
    ...contentItems.map((item) => ({
      id: `content-${item.id}`,
      title: item.title,
      date: item.scheduled_at,
      label: item.status,
      href: '/app/comms/planner?view=my_items',
    })),
  ].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  return (
    <section className="space-y-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">My communications dashboard</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950">Hello {firstName}, here is what needs your attention.</h2>
          <p className="mt-1 text-sm text-orange-900/80">
            Your deadlines, assigned content, incoming WhatsApp signals, and project summaries are gathered in one place.
          </p>
        </div>
        <Link
          href="/app/comms/planner"
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Open planner
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Open Tasks" value={openTasks.length + openCommsTasks.length} sub="assigned to you" />
        <StatCard label="My Content" value={contentItems.length} sub="drafts and scheduled cards" />
        <StatCard label="Incoming Messages" value={incomingItems.length} sub="waiting for review" />
        <StatCard label="Project Summaries" value={projectSummaries.length} sub="campus and events" />
      </div>

      <TileGroup groupId="comms-personal-dashboard" className="grid gap-4 lg:grid-cols-2">
        <CollapsibleCard
          key="comms-personal-deadlines"
          tone="orange"
          title="Deadlines"
          storageKey="comms-personal-deadlines"
          actions={
            <Link href="/app/comms/planner?view=my_items" className="text-xs font-semibold text-orange-700 hover:underline">
              My items
            </Link>
          }
        >
          <div className="space-y-2">
            {dueSoon.slice(0, 6).map((item) => (
              <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
                <span className="line-clamp-1 text-sm font-medium text-neutral-900">{item.title}</span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                  {formatShortDate(item.date)}
                </span>
              </Link>
            ))}
            {dueSoon.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                No personal deadlines are assigned right now.
              </p>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          key="comms-personal-tasks"
          tone="orange"
          title="My tasks"
          storageKey="comms-personal-tasks"
        >
          <div className="space-y-2">
            {commsTasks.map((task) => (
              <div key={task.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                  {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{task.description}</p>}
                  {task.dueDate && <p className="mt-1 text-xs text-neutral-500">Due {formatShortDate(task.dueDate)}</p>}
                </div>
                <TaskStatusControl taskId={task.id} status={task.status} />
              </div>
            ))}
            {commsTasks.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                No tasks assigned to you yet.
              </p>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          key="comms-personal-incoming"
          tone="orange"
          title="Incoming for review"
          storageKey="comms-personal-incoming"
          actions={
            <Link href="/app/comms/intake" className="text-xs font-semibold text-orange-700 hover:underline">
              Open intake
            </Link>
          }
        >
          <div className="space-y-2">
            {incomingItems.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{item.sender_name}</p>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {item.content_type.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{item.raw_content}</p>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-900">
                    Open source
                  </a>
                )}
              </div>
            ))}
            {incomingItems.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                No incoming messages are waiting.
              </p>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          key="comms-personal-summaries"
          className="lg:col-span-2"
          tone="orange"
          title="Project summaries"
          storageKey="comms-personal-summaries"
          actions={
            <Link href="/app/comms/campus" className="text-xs font-semibold text-orange-700 hover:underline">
              Open campus
            </Link>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {projectSummaries.map((item) => (
              <Link key={item.id} href={item.href} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 hover:bg-white">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">{item.label}</span>
                <p className="mt-2 text-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{item.summary}</p>
              </Link>
            ))}
            {projectSummaries.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                No campus or event summaries yet.
              </p>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          key="comms-personal-decisions"
          className="lg:col-span-2"
          tone="orange"
          title="Recent decisions"
          storageKey="comms-personal-decisions"
          actions={
            <Link href="/app/comms/campus" className="text-xs font-semibold text-orange-700 hover:underline">
              Open meetings
            </Link>
          }
        >
          <div className="space-y-2">
            {decisions.map((item) => (
              <Link key={item.id} href={item.href} className="block rounded-lg border border-neutral-200 px-3 py-3 hover:bg-neutral-50">
                <p className="text-sm font-medium text-neutral-900">{item.decision}</p>
                <p className="mt-1 text-xs text-neutral-500">{item.owner} · {item.meeting}</p>
              </Link>
            ))}
            {decisions.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                No structured decisions captured yet.
              </p>
            )}
          </div>
        </CollapsibleCard>
      </TileGroup>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/app/comms/campus" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Campus feed
        </Link>
        <Link href="/app/comms/events" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Events
        </Link>
        <Link href="/app/comms/library" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Library
        </Link>
      </div>
    </section>
  )
}
