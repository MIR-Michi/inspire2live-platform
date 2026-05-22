import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

type InitiativeHealth = Tables<'initiative_health'>

function computeRag(row: InitiativeHealth): 'green' | 'amber' | 'red' {
  const overdue = row.overdue_milestones ?? 0
  const blocked = row.blocked_tasks ?? 0
  const daysSince = row.last_activity_at
    ? Math.floor((Date.now() - new Date(row.last_activity_at).getTime()) / 86_400_000)
    : 999
  if (overdue > 0 || blocked >= 3 || daysSince > 14) return 'red'
  if (blocked > 0) return 'amber'
  return 'green'
}

const ragDot: Record<string, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500',
}
const ragLabel: Record<string, string> = {
  green: 'On track', amber: 'Needs attention', red: 'At risk',
}

const ACTIVITY_META: Record<string, { icon: string; color: string }> = {
  milestone:  { icon: '🏆', color: 'bg-emerald-100 text-emerald-700' },
  initiative: { icon: '🚀', color: 'bg-blue-100 text-blue-700' },
  member:     { icon: '👤', color: 'bg-orange-100 text-orange-700' },
  ethics:     { icon: '📋', color: 'bg-purple-100 text-purple-700' },
  partner:    { icon: '🤝', color: 'bg-teal-100 text-teal-700' },
  reporting:  { icon: '⚠️', color: 'bg-red-100 text-red-700' },
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${highlight ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${highlight ? 'text-red-700' : 'text-neutral-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

export default async function BoardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  // Role gate: only BoardMember and PlatformAdmin
  const role = profile?.role ?? ''
  if (role !== 'BoardMember' && role !== 'PlatformAdmin') {
    redirect('/app/dashboard')
  }

  const { data: allInitiatives } = await supabase
    .from('initiative_health')
    .select('*')
    .order('title')

  const initiatives: InitiativeHealth[] = allInitiatives ?? []

  const active = initiatives.filter(i => i.status === 'active').length
  const totalMilestonesDone = initiatives.reduce((s, i) => s + (i.completed_milestones ?? 0), 0)
  const totalMilestonesAll = initiatives.reduce((s, i) => s + (i.total_milestones ?? 0), 0)
  const totalMembers = initiatives.reduce((s, i) => s + (i.member_count ?? 0), 0)
  const totalBlocked = initiatives.reduce((s, i) => s + (i.blocked_tasks ?? 0), 0)
  const countries = new Set(initiatives.flatMap(i => i.countries ?? [])).size
  const atRisk = initiatives.filter(i => computeRag(i) === 'red').length

  // Initiative table data
  type TableRow = {
    id: string; title: string; phase: string; lead: string;
    milestonesPct: number; milestonesDone: number; milestonesTotal: number;
    rag: 'green' | 'amber' | 'red'; lastActivity: string | null;
  }

  const tableData: TableRow[] = initiatives.map(i => ({
    id: i.id!,
    title: i.title ?? '—',
    phase: i.phase ?? '—',
    lead: i.lead_name ?? '—',
    milestonesPct: (i.total_milestones ?? 0) > 0 ? Math.round(((i.completed_milestones ?? 0) / (i.total_milestones ?? 1)) * 100) : 0,
    milestonesDone: i.completed_milestones ?? 0,
    milestonesTotal: i.total_milestones ?? 0,
    rag: computeRag(i),
    lastActivity: i.last_activity_at ?? null,
  }))

  const nowMs = new Date().getTime()
  const activityFeed: { id: string; type: string; title: string; detail: string; date: string }[] = []

  // Governance reminders
  const GOVERNANCE = [
    { id: 'g1', type: 'reporting', label: 'WHO Africa Q1 Report', detail: 'Due 15 February 2026 · Palliative Care initiative', overdue: true },
    { id: 'g2', type: 'compliance', label: 'Annual Board Review', detail: 'Next scheduled: March 2026', overdue: false },
    { id: 'g3', type: 'decision',  label: 'Budget reallocation request pending', detail: '€12,000 from travel → curriculum translation', overdue: false },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Board Management Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Organizational transparency · Real-time portfolio overview
        </p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Initiatives" value={active} />
        <StatCard label="Total Members" value={totalMembers} />
        <StatCard label="Countries" value={countries} />
        <StatCard label="Milestones Done" value={totalMilestonesDone} sub={`of ${totalMilestonesAll} total`} />
        <StatCard label="Blocked Tasks" value={totalBlocked} highlight={totalBlocked > 0} />
        <StatCard label="At Risk" value={atRisk} highlight={atRisk > 0} sub="initiatives" />
      </div>

      {/* ── Org milestone progress ── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Organisation-wide Milestone Progress</h2>
          <span className="text-xs text-neutral-500">
            {totalMilestonesDone} of {totalMilestonesAll} completed ({totalMilestonesAll > 0 ? Math.round((totalMilestonesDone / totalMilestonesAll) * 100) : 0}%)
          </span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-4 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${totalMilestonesAll > 0 ? Math.round((totalMilestonesDone / totalMilestonesAll) * 100) : 0}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-200" /> Remaining</span>
        </div>
      </section>

      {/* ── Portfolio health table ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Portfolio Health</h2>
          <Link href="/app/initiatives" className="text-sm font-medium text-orange-600 hover:underline">
            Full initiative list →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Initiative</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Lead</th>
                <th className="px-4 py-3 text-left">Milestones</th>
                <th className="px-4 py-3 text-left">Risk</th>
                <th className="px-4 py-3 text-left">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tableData.map(row => {
                const daysAgo = row.lastActivity
                  ? Math.floor((nowMs - new Date(row.lastActivity).getTime()) / 86400000)
                  : null
                const actLabel = daysAgo === null ? '—' : daysAgo === 0 ? 'Today' : `${daysAgo}d ago`
                return (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/app/initiatives/${row.id}`} className="font-medium text-neutral-900 hover:text-orange-700">
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-neutral-600">{row.phase}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.lead}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-neutral-100">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${row.milestonesPct}%` }} />
                        </div>
                        <span className="text-xs text-neutral-500">{row.milestonesDone}/{row.milestonesTotal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${ragDot[row.rag]}`} />
                        {ragLabel[row.rag]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${daysAgo !== null && daysAgo > 14 ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
                      {actLabel}
                    </td>
                  </tr>
                )
              })}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No initiatives found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Activity Stream ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Organisation Activity Stream</h2>
          <div className="space-y-2">
            {activityFeed.map(a => {
              const meta = ACTIVITY_META[a.type] ?? { icon: '📌', color: 'bg-neutral-100 text-neutral-700' }
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{a.detail}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
            {activityFeed.length === 0 && (
              <div className="rounded-xl border border-dashed border-neutral-300 py-8 text-center text-neutral-400 text-sm">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </section>

        {/* ── Governance & Compliance ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Governance & Compliance</h2>
          <div className="space-y-2">
            {GOVERNANCE.map(g => (
              <div
                key={g.id}
                className={`rounded-xl border p-4 shadow-sm ${g.overdue ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${g.overdue ? 'text-red-900' : 'text-neutral-900'}`}>
                      {g.overdue && <span className="mr-1">⚠</span>}{g.label}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">{g.detail}</p>
                  </div>
                  {g.overdue && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Action needed</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Board note */}
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900">Board Notes</h3>
            <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
              Full board agenda management, decision logging, and governance document repository are planned for a future release. 
              This dashboard currently provides real-time initiative portfolio visibility.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/app/initiatives" className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                All Initiatives
              </Link>
              <Link href="/app/network" className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                Network View
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
