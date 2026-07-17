import Link from 'next/link'
import type { Tables } from '@/types/database'
import type { DashboardLayoutState, DashboardWidgetContent } from '@/kernel/dashboard'
import { AdaptiveDashboard } from '@/kernel/ui/dashboard/adaptive-dashboard'

export type InitiativeHealth = Tables<'initiative_health'>
export type MemberActivity = Tables<'member_activity_summary'>

export type DashboardNewsItem = {
  id: string
  category: string
  headline: string
  summary: string
  source: string
  sourceUrl: string
  region: string
  published: string
}

export type InitiativeTaskRow = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  initiative_id: string
}

function computeRag(row: InitiativeHealth): 'green' | 'amber' | 'red' {
  const overdue = row.overdue_milestones ?? 0
  const blocked = row.blocked_tasks ?? 0
  const approaching = row.approaching_milestones ?? 0
  const daysSince = row.last_activity_at
    ? Math.floor((Date.now() - new Date(row.last_activity_at).getTime()) / 86_400_000)
    : 999
  if (overdue > 0 || blocked >= 3 || daysSince > 14) return 'red'
  if (approaching > 0 || blocked > 0) return 'amber'
  return 'green'
}

const ragStyles = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500' }
const ragLabel = { green: 'On track', amber: 'Needs attention', red: 'At risk' }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[var(--i2l-radius-card)] border border-neutral-200 bg-white p-4 shadow-[var(--i2l-shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

function FieldNewsfeed({ newsfeed }: { newsfeed: DashboardNewsItem[] }) {
  const meta: Record<string, { label: string; color: string }> = {
    medical: { label: 'Medical', color: 'bg-blue-100 text-blue-700' },
    policy: { label: 'Policy', color: 'bg-teal-100 text-teal-700' },
    advocacy: { label: 'Advocacy', color: 'bg-orange-100 text-orange-700' },
  }
  return (
    <div className="space-y-2">
      {newsfeed.map((item) => {
        const category = meta[item.category] ?? { label: item.category, color: 'bg-neutral-100 text-neutral-700' }
        return (
          <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              {item.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-semibold leading-snug text-neutral-900 hover:text-orange-700 hover:underline">{item.headline}</a>
              ) : <p className="flex-1 text-sm font-semibold leading-snug text-neutral-900">{item.headline}</p>}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${category.color}`}>{category.label}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">{item.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
              <span>{item.source}</span><span>·</span><span>{item.region}</span><span>·</span>
              <span>{new Date(item.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )
      })}
      {newsfeed.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-400">No newsfeed items available.</p>}
    </div>
  )
}

export function CoordinatorDashboard({
  initiatives,
  inactive,
  newsfeed,
  initialLayout,
  readOnly,
}: {
  initiatives: InitiativeHealth[]
  inactive: MemberActivity[]
  newsfeed: DashboardNewsItem[]
  initialLayout: DashboardLayoutState
  readOnly: boolean
}) {
  const green = initiatives.filter((item) => computeRag(item) === 'green').length
  const amber = initiatives.filter((item) => computeRag(item) === 'amber').length
  const red = initiatives.filter((item) => computeRag(item) === 'red').length
  const blocked = initiatives.reduce((sum, item) => sum + (item.blocked_tasks ?? 0), 0)

  const widgets: DashboardWidgetContent[] = [
    {
      id: 'initiative-health',
      content: (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr><th className="px-4 py-3 text-left">Initiative</th><th className="px-4 py-3 text-left">Phase</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Open tasks</th><th className="px-4 py-3 text-right">Blocked</th><th className="px-4 py-3 text-right">Members</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {initiatives.map((initiative) => {
                const rag = computeRag(initiative)
                return (
                  <tr key={initiative.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3"><Link href={`/app/initiatives/${initiative.id}`} className="font-medium text-neutral-900 hover:text-orange-700">{initiative.title}</Link></td>
                    <td className="px-4 py-3 capitalize text-neutral-600">{initiative.phase}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${ragStyles[rag]}`} />{ragLabel[rag]}</span></td>
                    <td className="px-4 py-3 text-right text-neutral-700">{initiative.open_tasks ?? 0}</td>
                    <td className="px-4 py-3 text-right"><span className={initiative.blocked_tasks ? 'font-semibold text-red-600' : 'text-neutral-500'}>{initiative.blocked_tasks ?? 0}</span></td>
                    <td className="px-4 py-3 text-right text-neutral-700">{initiative.member_count ?? 0}</td>
                  </tr>
                )
              })}
              {initiatives.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No active initiatives yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'inactivity-alerts',
      content: inactive.length > 0 ? (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-red-100 bg-white">
          {inactive.map((member) => (
            <li key={member.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div><p className="text-sm font-medium text-neutral-900">{member.name}</p><p className="text-xs text-neutral-500">{member.role} · {member.initiative_count} initiative{member.initiative_count !== 1 ? 's' : ''}</p></div>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{member.days_since_activity}d inactive</span>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">No inactivity alerts right now. Member engagement is healthy.</p>,
    },
    {
      id: 'portfolio-alerts',
      content: red > 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">{red} initiative{red > 1 ? 's are' : ' is'} at risk. Review the portfolio and blocked work.</p>
      ) : <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">Portfolio is currently on track.</p>,
    },
    { id: 'field-newsfeed', content: <FieldNewsfeed newsfeed={newsfeed} /> },
  ]

  return (
    <AdaptiveDashboard
      dashboardId="coordinator"
      initialLayout={initialLayout}
      widgets={widgets}
      readOnly={readOnly}
      kpis={<div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="Total initiatives" value={initiatives.length} /><StatCard label="On track" value={green} /><StatCard label="Needs attention" value={amber} /><StatCard label="Blocked tasks" value={blocked} /></div>}
    />
  )
}

export function AdvocateDashboard({
  initiatives,
  tasks,
  newsfeed,
  initialLayout,
  readOnly,
}: {
  initiatives: InitiativeHealth[]
  tasks: InitiativeTaskRow[]
  newsfeed: DashboardNewsItem[]
  initialLayout: DashboardLayoutState
  readOnly: boolean
}) {
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const overdue = openTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date())
  const priorityStyle: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-neutral-100 text-neutral-600' }

  const widgets: DashboardWidgetContent[] = [
    {
      id: 'my-tasks',
      actions: <Link href="/app/tasks" className="text-xs font-semibold text-orange-700 hover:underline">View all →</Link>,
      content: (
        <div className="space-y-2">
          {openTasks.slice(0, 8).map((task) => {
            const isOverdue = Boolean(task.due_date && new Date(task.due_date) < new Date())
            return (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${priorityStyle[task.priority] ?? priorityStyle.low}`}>{task.priority}</span>
                <Link href={`/app/initiatives/${task.initiative_id}/tasks`} className="flex-1 text-sm font-medium text-neutral-900 hover:text-orange-700">{task.title}</Link>
                {task.due_date && <span className={`shrink-0 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>{isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>
            )
          })}
          {openTasks.length === 0 && <p className="rounded-lg border border-emerald-200 bg-emerald-50 py-8 text-center text-sm text-emerald-700">No open tasks. You are all caught up.</p>}
        </div>
      ),
    },
    {
      id: 'my-initiatives',
      actions: <Link href="/app/initiatives" className="text-xs font-semibold text-orange-700 hover:underline">Browse initiatives →</Link>,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {initiatives.map((initiative) => {
            const rag = computeRag(initiative)
            const percent = initiative.total_milestones && initiative.total_milestones > 0 ? Math.round(((initiative.completed_milestones ?? 0) / initiative.total_milestones) * 100) : 0
            return (
              <Link key={initiative.id} href={`/app/initiatives/${initiative.id}`} className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-orange-300">
                <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-neutral-900">{initiative.title}</h3><span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ragStyles[rag]}`} title={ragLabel[rag]} /></div>
                <p className="mt-2 text-xs capitalize text-neutral-500">{initiative.phase} · {initiative.countries?.join(', ') || '—'}</p>
                <div className="mt-3"><div className="flex justify-between text-xs text-neutral-500"><span>Milestones</span><span>{initiative.completed_milestones ?? 0}/{initiative.total_milestones ?? 0}</span></div><div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div></div>
              </Link>
            )
          })}
          {initiatives.length === 0 && <p className="col-span-2 rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">You have not joined any initiatives yet.</p>}
        </div>
      ),
    },
    { id: 'field-newsfeed', content: <FieldNewsfeed newsfeed={newsfeed} /> },
  ]

  return (
    <AdaptiveDashboard
      dashboardId="advocate"
      initialLayout={initialLayout}
      widgets={widgets}
      readOnly={readOnly}
      kpis={<div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><StatCard label="My initiatives" value={initiatives.length} /><StatCard label="Open tasks" value={openTasks.length} /><StatCard label="Overdue" value={overdue.length} sub={overdue.length > 0 ? 'action needed' : 'all clear'} /></div>}
    />
  )
}

export function BoardDashboard({
  initiatives,
  newsfeed,
  initialLayout,
  readOnly,
}: {
  initiatives: InitiativeHealth[]
  newsfeed: DashboardNewsItem[]
  initialLayout: DashboardLayoutState
  readOnly: boolean
}) {
  const active = initiatives.filter((item) => item.status === 'active').length
  const countries = new Set(initiatives.flatMap((item) => item.countries ?? [])).size
  const members = initiatives.reduce((sum, item) => sum + (item.member_count ?? 0), 0)
  const milestonesDone = initiatives.reduce((sum, item) => sum + (item.completed_milestones ?? 0), 0)
  const red = initiatives.filter((item) => computeRag(item) === 'red').length

  const widgets: DashboardWidgetContent[] = [
    {
      id: 'portfolio-overview',
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.slice(0, 9).map((initiative) => {
            const rag = computeRag(initiative)
            return (
              <Link key={initiative.id} href={`/app/initiatives/${initiative.id}`} className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-orange-300">
                <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-neutral-900">{initiative.title}</h3><span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ragStyles[rag]}`} title={ragLabel[rag]} /></div>
                <p className="mt-1 text-xs capitalize text-neutral-500">{initiative.phase}</p>
                <p className="mt-2 text-xs text-neutral-700">{initiative.member_count ?? 0} contributors · {initiative.countries?.length ?? 0} countr{(initiative.countries?.length ?? 0) === 1 ? 'y' : 'ies'}</p>
              </Link>
            )
          })}
          {initiatives.length === 0 && <p className="col-span-3 rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">Portfolio data will appear here once initiatives are active.</p>}
        </div>
      ),
    },
    {
      id: 'portfolio-risks',
      content: red > 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{red} initiative{red > 1 ? 's are' : ' is'} currently at risk and may require board attention.</p> : <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">No portfolio risks need board attention right now.</p>,
    },
    { id: 'field-newsfeed', content: <FieldNewsfeed newsfeed={newsfeed} /> },
  ]

  return (
    <AdaptiveDashboard
      dashboardId="board"
      initialLayout={initialLayout}
      widgets={widgets}
      readOnly={readOnly}
      kpis={<div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="Active initiatives" value={active} /><StatCard label="Countries" value={countries} /><StatCard label="Contributors" value={members} /><StatCard label="Milestones completed" value={milestonesDone} /></div>}
    />
  )
}
