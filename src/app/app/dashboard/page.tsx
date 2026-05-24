import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { getDashboardConfig } from '@/lib/dashboard-config'
import { buildDashboardGreeting, resolveDashboardVariant } from '@/lib/dashboard-view'
import { applyCanonicalCommsFallback, isCommsUser } from '@/lib/user-workspace'

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
  todayCount,
  weekCount,
  attentionCount,
  readyCount,
}: {
  todayCount: number
  weekCount: number
  attentionCount: number
  readyCount: number
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Communications workspace</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950">Today&apos;s comms control room</h2>
          <p className="mt-1 text-sm text-orange-900/80">
            A shared dashboard slice for planning, campus signals, review queues, and safe manual publishing.
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
        <StatCard label="What's Up Today" value={todayCount} sub="scheduled or captured today" />
        <StatCard label="This Week" value={weekCount} sub="planned content cards" />
        <StatCard label="Needs Attention" value={attentionCount} sub="unreviewed intake" />
        <StatCard label="Content Ready" value={readyCount} sub="scheduled or approved assets" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/app/comms/campus" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Campus feed and month view
        </Link>
        <Link href="/app/comms/events" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Events and Annual Congress follow-up
        </Link>
        <Link href="/app/comms/library" className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold text-orange-900 shadow-sm hover:border-orange-400">
          Library search and rights checks
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

  const role = profile?.role ?? 'PatientAdvocate'
  const dashboardConfig = getDashboardConfig(profile?.user_type)
  const showCommsBlocks = isCommsUser(profile)
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

  let commsTodayCount = 0
  let commsWeekCount = 0
  let commsAttentionCount = 0
  let commsReadyCount = 0

  if (showCommsBlocks) {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
    const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString()

    const [
      { count: scheduledToday },
      { count: capturedToday },
      { count: plannedWeek },
      { count: unreviewed },
      { count: scheduledReady },
      { count: approvedAssets },
    ] = await Promise.all([
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStart)
        .lt('scheduled_at', tomorrowStart),
      supabase
        .from('intake_items')
        .select('id', { count: 'exact', head: true })
        .gte('captured_at', todayStart)
        .lt('captured_at', tomorrowStart),
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStart)
        .lt('scheduled_at', weekEnd),
      supabase
        .from('intake_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unreviewed'),
      supabase
        .from('content_calendar')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled'),
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('rights_status', 'approved_for_publication'),
    ])

    commsTodayCount = (scheduledToday ?? 0) + (capturedToday ?? 0)
    commsWeekCount = plannedWeek ?? 0
    commsAttentionCount = unreviewed ?? 0
    commsReadyCount = (scheduledReady ?? 0) + (approvedAssets ?? 0)
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
          todayCount={commsTodayCount}
          weekCount={commsWeekCount}
          attentionCount={commsAttentionCount}
          readyCount={commsReadyCount}
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
