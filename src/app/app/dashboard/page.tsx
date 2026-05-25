import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { getDashboardConfig } from '@/lib/dashboard-config'
import { buildDashboardGreeting, resolveDashboardVariant } from '@/lib/dashboard-view'
import { applyCanonicalCommsFallback, isCommsUser } from '@/lib/user-workspace'
import { getViewAsRole, getViewAsUserType } from '@/lib/view-as'

type InitiativeHealth = Tables<'initiative_health'>
type MemberActivity = Tables<'member_activity_summary'>

/* ─── RAG helpers ────────────────────────────────────────────────────────── */
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

const ragStyles = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
}
const ragLabel = { green: 'On track', amber: 'Needs attention', red: 'At risk' }

/* ─── Shared card ────────────────────────────────────────────────────────── */
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

function parseCampusDecision(value: string) {
  const parts = value.split('|').map((part) => part.trim())
  return {
    decision: parts[0]?.replace(/^Decision:\s*/i, '').trim() || value,
    owner: parts.find((part) => /^Owner:/i.test(part))?.replace(/^Owner:\s*/i, '').trim() || 'Unassigned',
  }
}

/* ─── Coordinator view ───────────────────────────────────────────────────── */
function CoordinatorDashboard({
  initiatives,
  inactive,
}: {
  initiatives: InitiativeHealth[]
  inactive: MemberActivity[]
}) {
  const green = initiatives.filter((i) => computeRag(i) === 'green').length
  const amber = initiatives.filter((i) => computeRag(i) === 'amber').length
  const red = initiatives.filter((i) => computeRag(i) === 'red').length
  const blocked = initiatives.reduce((sum, i) => sum + (i.blocked_tasks ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Stat bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Initiatives" value={initiatives.length} />
        <StatCard label="On Track" value={green} sub="green RAG" />
        <StatCard label="Needs Attention" value={amber} sub="amber RAG" />
        <StatCard label="Blocked Tasks" value={blocked} sub="across all initiatives" />
      </div>

      {/* RAG grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Initiative Health</h2>
          <Link href="/app/bureau" className="text-sm font-medium text-orange-600 hover:underline">
            Open Bureau →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Initiative</th>
                <th className="px-4 py-3 text-left">Phase</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Open tasks</th>
                <th className="px-4 py-3 text-right">Blocked</th>
                <th className="px-4 py-3 text-right">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {initiatives.map((i) => {
                const rag = computeRag(i)
                return (
                  <tr key={i.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/initiatives/${i.id}`}
                        className="font-medium text-neutral-900 hover:text-orange-700"
                      >
                        {i.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-neutral-600">{i.phase}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
                        <span className={`h-2 w-2 rounded-full ${ragStyles[rag]}`} />
                        {ragLabel[rag]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700">{i.open_tasks ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={i.blocked_tasks ? 'font-semibold text-red-600' : 'text-neutral-500'}>
                        {i.blocked_tasks ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700">{i.member_count ?? 0}</td>
                  </tr>
                )
              })}
              {initiatives.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No active initiatives yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inactivity alerts */}
      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            Inactivity Alerts
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {inactive.length}
            </span>
          </h2>
          <div className="rounded-xl border border-red-100 bg-white shadow-sm">
            <ul className="divide-y divide-neutral-100">
              {inactive.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{m.name}</p>
                    <p className="text-xs text-neutral-500">
                      {m.role} · {m.initiative_count} initiative
                      {m.initiative_count !== 1 ? 's' : ''} · {m.days_since_activity} days inactive
                    </p>
                  </div>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {m.days_since_activity}d inactive
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {inactive.length === 0 && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          No inactivity alerts right now. Member engagement is healthy.
        </p>
      )}

      {red > 0 && (
        <p className="text-sm text-red-600">
          ⚠ {red} initiative{red > 1 ? 's are' : ' is'} at risk. Open the Bureau to take action.
        </p>
      )}

      {initiatives.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-8 text-center">
          <p className="text-sm text-neutral-600">No initiatives are available yet for bureau monitoring.</p>
          <Link href="/app/initiatives" className="mt-2 inline-block text-sm font-medium text-orange-600 hover:underline">
            Open initiatives workspace →
          </Link>
        </div>
      )}
    </div>
  )
}

/* ─── Advocate / Clinician / Researcher view ─────────────────────────────── */
function AdvocateDashboard({
  initiatives,
  tasks,
}: {
  initiatives: InitiativeHealth[]
  tasks: { id: string; title: string; status: string; priority: string; due_date: string | null; initiative_id: string }[]
}) {
  const myTasks = tasks.filter((t) => t.status !== 'done')
  const overdue = myTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date())

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="My Initiatives" value={initiatives.length} />
        <StatCard label="Open Tasks" value={myTasks.length} />
        <StatCard label="Overdue" value={overdue.length} sub={overdue.length > 0 ? 'action needed' : 'all clear'} />
      </div>

      {/* My tasks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">My Tasks</h2>
          <Link href="/app/tasks" className="text-sm font-medium text-orange-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="space-y-2">
          {myTasks.slice(0, 6).map((t) => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date()
            const priorityStyle: Record<string, string> = {
              urgent: 'bg-red-100 text-red-700',
              high: 'bg-orange-100 text-orange-700',
              medium: 'bg-amber-100 text-amber-700',
              low: 'bg-neutral-100 text-neutral-600',
            }
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${priorityStyle[t.priority] ?? 'bg-neutral-100 text-neutral-600'}`}
                >
                  {t.priority}
                </span>
                <Link
                  href={`/app/initiatives/${t.initiative_id}/tasks`}
                  className="flex-1 text-sm font-medium text-neutral-900 hover:text-orange-700"
                >
                  {t.title}
                </Link>
                {t.due_date && (
                  <span className={`shrink-0 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
                    {isOverdue ? '⚠ ' : ''}
                    {new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            )
          })}
          {myTasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
              No open tasks. Great work — or check with your coordinator!
            </p>
          )}
        </div>
      </section>

      {/* My initiatives */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">My Initiatives</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {initiatives.map((i) => {
            const rag = computeRag(i)
            const pct =
              i.total_milestones && i.total_milestones > 0
                ? Math.round(((i.completed_milestones ?? 0) / i.total_milestones) * 100)
                : 0
            return (
              <Link
                key={i.id}
                href={`/app/initiatives/${i.id}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-orange-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">{i.title}</h3>
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ragStyles[rag]}`} title={ragLabel[rag]} />
                </div>
                <p className="mt-2 text-xs text-neutral-500 capitalize">{i.phase} · {i.countries?.join(', ') || '—'}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Milestones</span>
                    <span>{i.completed_milestones ?? 0}/{i.total_milestones ?? 0}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            )
          })}
          {initiatives.length === 0 && (
            <p className="col-span-2 rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
              You haven&apos;t joined any initiatives yet.{' '}
              <Link href="/app/initiatives" className="text-orange-600 hover:underline">
                Browse initiatives →
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

/* ─── Board view ─────────────────────────────────────────────────────────── */
function BoardDashboard({ initiatives }: { initiatives: InitiativeHealth[] }) {
  const active = initiatives.filter((i) => i.status === 'active').length
  const countries = new Set(initiatives.flatMap((i) => i.countries ?? [])).size
  const members = initiatives.reduce((s, i) => s + (i.member_count ?? 0), 0)
  const milestonesDone = initiatives.reduce((s, i) => s + (i.completed_milestones ?? 0), 0)
  const red = initiatives.filter((i) => computeRag(i) === 'red').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Initiatives" value={active} />
        <StatCard label="Countries" value={countries} />
        <StatCard label="Contributors" value={members} />
        <StatCard label="Milestones Completed" value={milestonesDone} />
      </div>

      {red > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {red} initiative{red > 1 ? 's are' : ' is'} currently at risk and may require board attention.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Portfolio Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.slice(0, 6).map((i) => {
            const rag = computeRag(i)
            return (
              <Link
                key={i.id}
                href={`/app/initiatives/${i.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-orange-300 block"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">{i.title}</h3>
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ragStyles[rag]}`} />
                </div>
                <p className="mt-1 text-xs text-neutral-500 capitalize">{i.phase}</p>
                <p className="mt-2 text-xs text-neutral-700">
                  {i.member_count ?? 0} contributors · {i.countries?.length ?? 0} countr{(i.countries?.length ?? 0) === 1 ? 'y' : 'ies'}
                </p>
              </Link>
            )
          })}

          {initiatives.length === 0 && (
            <p className="col-span-3 rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
              Portfolio data will appear here once initiatives are active.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function CommsDashboardPanel({
  name,
  tasks,
  contentItems,
  incomingItems,
  projectSummaries,
  decisions,
}: {
  name: string | null | undefined
  tasks: { id: string; title: string; status: string; priority: string; due_date: string | null; initiative_id: string }[]
  contentItems: { id: string; title: string; status: string; scheduled_at: string | null; source_link: string | null }[]
  incomingItems: { id: string; sender_name: string; content_type: string; raw_content: string; source_url: string | null; captured_at: string }[]
  projectSummaries: { id: string; title: string; summary: string; href: string; label: string }[]
  decisions: { id: string; decision: string; owner: string; href: string; meeting: string }[]
}) {
  const firstName = (name ?? 'Michael').split(' ')[0]
  const openTasks = tasks.filter((task) => task.status !== 'done')
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
        <StatCard label="My Open Tasks" value={openTasks.length} sub="assigned to you" />
        <StatCard label="My Content" value={contentItems.length} sub="drafts and scheduled cards" />
        <StatCard label="Incoming Messages" value={incomingItems.length} sub="waiting for review" />
        <StatCard label="Project Summaries" value={projectSummaries.length} sub="campus and events" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Deadlines</h3>
            <Link href="/app/comms/planner?view=my_items" className="text-xs font-semibold text-orange-700 hover:underline">
              My items
            </Link>
          </div>
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
        </section>

        <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Incoming for review</h3>
            <Link href="/app/comms/intake" className="text-xs font-semibold text-orange-700 hover:underline">
              Open intake
            </Link>
          </div>
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
        </section>
      </div>

      <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Project summaries</h3>
          <Link href="/app/comms/campus" className="text-xs font-semibold text-orange-700 hover:underline">
            Open campus
          </Link>
        </div>
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
      </section>

      <section className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Recent decisions</h3>
          <Link href="/app/comms/campus" className="text-xs font-semibold text-orange-700 hover:underline">
            Open meetings
          </Link>
        </div>
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
      </section>

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

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileWithUserType, error: profileWithUserTypeError } = await supabase
    .from('profiles')
    .select('name, role, onboarding_completed, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()
  let profile = profileWithUserType

  if (profileWithUserTypeError) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('name, role, onboarding_completed, comms_team')
      .eq('id', user.id)
      .maybeSingle()
    profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
  }

  profile = applyCanonicalCommsFallback(profile, user.email)

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const actualRole = profile?.role ?? 'PatientAdvocate'
  const isAdmin = actualRole === 'PlatformAdmin'
  const viewAsRole = isAdmin ? await getViewAsRole() : null
  const viewAsUserType = isAdmin ? await getViewAsUserType() : null
  const effectiveProfile = profile
    ? {
        ...profile,
        role: viewAsRole ?? profile.role,
        user_type: viewAsUserType ?? profile.user_type,
        comms_team: profile.comms_team || viewAsUserType === 'comms',
      }
    : profile

  const role = effectiveProfile?.role ?? 'PatientAdvocate'
  const dashboardConfig = getDashboardConfig(effectiveProfile?.user_type)
  const showCommsBlocks = isCommsUser(effectiveProfile)
  const dashboardVariant = resolveDashboardVariant(role)
  const isCoordinator = dashboardVariant === 'coordinator'
  const isBoard = dashboardVariant === 'board'

  /* Fetch initiative health */
  const { data: allInitiatives } = await supabase
    .from('initiative_health')
    .select('*')
    .order('title')

  const initiatives = allInitiatives ?? []

  /* For coordinator: inactive members (14+ days) */
  let inactiveMembers: MemberActivity[] = []
  if (isCoordinator) {
    const { data } = await supabase
      .from('member_activity_summary')
      .select('*')
      .gt('days_since_activity', 14)
      .eq('onboarding_completed', true)
      .order('days_since_activity', { ascending: false })
      .limit(10)
    inactiveMembers = data ?? []
  }

  /* For advocates: user's initiatives */
  let myInitiatives: InitiativeHealth[] = []
  let myTasks: {
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    initiative_id: string
  }[] = []

  if (!isCoordinator && !isBoard) {
    const { data: memberRows } = await supabase
      .from('initiative_members')
      .select('initiative_id')
      .eq('user_id', user.id)
    const memberIds = memberRows?.map((r) => r.initiative_id) ?? []
    myInitiatives = initiatives.filter((i) => i.id && memberIds.includes(i.id))

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, initiative_id')
      .eq('assignee_id', user.id)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
    myTasks = taskRows ?? []
  }

  const greeting = buildDashboardGreeting(profile?.name)

  let commsPersonalTasks: {
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    initiative_id: string
  }[] = []
  let commsContentItems: {
    id: string
    title: string
    status: string
    scheduled_at: string | null
    source_link: string | null
  }[] = []
  let commsIncomingItems: {
    id: string
    sender_name: string
    content_type: string
    raw_content: string
    source_url: string | null
    captured_at: string
  }[] = []
  let commsProjectSummaries: { id: string; title: string; summary: string; href: string; label: string }[] = []
  let commsDecisionItems: { id: string; decision: string; owner: string; href: string; meeting: string }[] = []

  if (showCommsBlocks) {
    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()).toISOString()

    const [
      { data: personalTaskRows },
      { data: contentRows },
      { data: incomingRows },
      { data: campusRows },
      { data: eventRows },
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, initiative_id')
        .eq('assignee_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(8),
      supabase
        .from('content_calendar')
        .select('id, title, status, scheduled_at, source_link')
        .eq('author_id', user.id)
        .neq('status', 'archived')
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from('intake_items')
        .select('id, sender_name, content_type, raw_content, source_url, captured_at')
        .eq('status', 'unreviewed')
        .order('captured_at', { ascending: false })
        .limit(6),
      supabase
        .from('campus_sessions')
        .select('id, session_date, theme, summary, decisions_for_publication')
        .order('session_date', { ascending: false })
        .limit(4),
      supabase
        .from('events')
        .select('id, name, start_date, location_city, location_country, notes')
        .gte('start_date', today.toISOString().slice(0, 10))
        .lt('start_date', nextMonth.slice(0, 10))
        .order('start_date', { ascending: true })
        .limit(2),
    ])

    commsPersonalTasks = personalTaskRows ?? []
    commsContentItems = contentRows ?? []
    commsIncomingItems = incomingRows ?? []
    commsProjectSummaries = [
      ...((campusRows ?? []).map((row) => ({
        id: `campus-${row.id}`,
        title: row.theme || `Campus session ${formatShortDate(row.session_date)}`,
        summary: row.summary || 'Campus session notes and action items are ready for review.',
        href: `/app/comms/campus/${new Date(row.session_date).getFullYear()}/${new Date(row.session_date).getMonth() + 1}`,
        label: 'Campus',
      }))),
      ...((eventRows ?? []).map((row) => ({
        id: `event-${row.id}`,
        title: row.name,
        summary: row.notes || [row.location_city, row.location_country].filter(Boolean).join(', ') || 'Upcoming event needs follow-up planning.',
        href: `/app/comms/events/${row.id}`,
        label: 'Event',
      }))),
    ]
    commsDecisionItems = (campusRows ?? [])
      .flatMap((row) =>
        (row.decisions_for_publication ?? []).map((decision, index) => {
          const parsed = parseCampusDecision(decision)
          return {
            id: `${row.id}-${index}`,
            decision: parsed.decision,
            owner: parsed.owner,
            href: `/app/comms/campus/${new Date(row.session_date).getFullYear()}/${new Date(row.session_date).getMonth() + 1}`,
            meeting: row.theme || `Campus ${formatShortDate(row.session_date)}`,
          }
        })
      )
      .slice(0, 4)
  }

  const { data: dbNotifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8)

  const notifications = dbNotifications ?? []
  const unreadCount = notifications.filter(n => !n.is_read).length

  const newsfeed: { id: string; category: string; headline: string; summary: string; source: string; region: string; published: string }[] = []

  const NOTIF_META: Record<string, { icon: string; color: string }> = {
    task_assigned:    { icon: '✅', color: 'bg-blue-100 text-blue-700' },
    milestone_completed: { icon: '🏆', color: 'bg-emerald-100 text-emerald-700' },
    discussion_reply: { icon: '💬', color: 'bg-purple-100 text-purple-700' },
    member_joined:    { icon: '👤', color: 'bg-orange-100 text-orange-700' },
    initiative_update:{ icon: '🚀', color: 'bg-teal-100 text-teal-700' },
    org_update:       { icon: '📢', color: 'bg-amber-100 text-amber-700' },
    media_recovery_offer: { icon: '🖼️', color: 'bg-violet-100 text-violet-700' },
  }

  const NEWSFEED_META: Record<string, { label: string; color: string }> = {
    medical:  { label: 'Medical',   color: 'bg-blue-100 text-blue-700' },
    policy:   { label: 'Policy',    color: 'bg-teal-100 text-teal-700' },
    advocacy: { label: 'Advocacy',  color: 'bg-orange-100 text-orange-700' },
  }

  const nowMs = new Date().getTime()
  const timeAgo = (dateStr: string) => {
    const diff = nowMs - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{dashboardConfig.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {greeting} {dashboardConfig.subtitle}
        </p>
      </div>

      {showCommsBlocks && (
        <CommsDashboardPanel
          name={profile?.name}
          tasks={commsPersonalTasks}
          contentItems={commsContentItems}
          incomingItems={commsIncomingItems}
          projectSummaries={commsProjectSummaries}
          decisions={commsDecisionItems}
        />
      )}

      {isCoordinator && !showCommsBlocks && (
        <CoordinatorDashboard initiatives={initiatives} inactive={inactiveMembers} />
      )}
      {isBoard && !showCommsBlocks && <BoardDashboard initiatives={initiatives} />}
      {!isCoordinator && !isBoard && !showCommsBlocks && (
        <AdvocateDashboard initiatives={myInitiatives} tasks={myTasks} />
      )}

      {/* ── Notifications + Newsfeed ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Notifications */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <Link href="/app/notifications" className="text-sm font-medium text-orange-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 6).map(n => {
              const meta = NOTIF_META[n.type] ?? { icon: '🔔', color: 'bg-neutral-100 text-neutral-600' }
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 shadow-sm transition-colors ${
                    !n.is_read ? 'border-blue-200 bg-blue-50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-blue-900' : 'text-neutral-900'}`}>
                        {!n.is_read && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-neutral-400">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{n.body}</p>
                  </div>
                </div>
              )
            })}
            {notifications.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-400">
                No notifications yet.
              </p>
            )}
          </div>
        </section>

        {/* Newsfeed */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Field Newsfeed</h2>
          </div>
          <div className="space-y-2">
            {newsfeed.map(nf => {
              const meta = NEWSFEED_META[nf.category] ?? { label: nf.category, color: 'bg-neutral-100 text-neutral-700' }
              return (
                <div key={nf.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900 leading-snug flex-1">{nf.headline}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{nf.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-neutral-400">
                    <span>{nf.source}</span>
                    <span>·</span>
                    <span>{nf.region}</span>
                    <span>·</span>
                    <span>{new Date(nf.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              )
            })}
            {newsfeed.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-400">
                No newsfeed items available.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
