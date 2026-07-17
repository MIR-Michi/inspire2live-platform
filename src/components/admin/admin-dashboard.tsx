import Link from 'next/link'
import { getRoleLabel, getRoleBadgeColor } from '@/lib/role-access'
import { UnifiedTaskList } from '@/components/tasks/unified-task-list'
import type { AdminDashboardData, AttentionTone } from '@/lib/admin-dashboard-data'
import type { DashboardLayoutState, DashboardWidgetContent } from '@/kernel/dashboard'
import { AdaptiveDashboard } from '@/kernel/ui/dashboard/adaptive-dashboard'

function StatTile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'default' | 'red' | 'amber' }) {
  const valueColor = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-neutral-900'
  return (
    <div className="rounded-[var(--i2l-radius-card)] border border-neutral-200 bg-white p-4 shadow-[var(--i2l-shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

const ATTENTION_DOT: Record<AttentionTone, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  neutral: 'bg-neutral-300',
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

function ViewAll({ href }: { href: string }) {
  return <Link href={href} className="text-xs font-semibold text-orange-700 hover:underline">View all →</Link>
}

export function AdminDashboard({
  data,
  initialLayout,
  readOnly = false,
}: {
  data: AdminDashboardData
  initialLayout: DashboardLayoutState
  readOnly?: boolean
}) {
  const { kpis, attention, roleDistribution, recentSignups, recentActivity, system, myTasks } = data
  const money = (number: number) => `$${number.toFixed(number >= 100 ? 0 : 2)}`

  const widgets: DashboardWidgetContent[] = [
    {
      id: 'my-tasks',
      content: <UnifiedTaskList tasks={myTasks} emptyLabel="No open tasks assigned to you right now." />,
    },
    {
      id: 'needs-attention',
      content: attention.length === 0 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">All clear ✓ — nothing needs your attention right now.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {attention.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ATTENTION_DOT[item.tone]}`} />
                <span className="text-sm text-neutral-700"><strong className="text-neutral-900">{item.count}</strong> {item.label}</span>
                <span className="ml-auto text-xs text-neutral-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'people-access',
      actions: <ViewAll href="/app/admin/users" />,
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {roleDistribution.map((item) => (
              <span key={item.role} className={`rounded-full px-2.5 py-1 text-xs font-medium ${getRoleBadgeColor(item.role)}`}>
                {getRoleLabel(item.role)} · {item.count}
              </span>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent signups</p>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {recentSignups.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-900">{user.name}</p><p className="truncate text-xs text-neutral-500">{user.email}</p></div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                    <span className="text-xs text-neutral-400">{formatShortDate(user.createdAt)}</span>
                  </div>
                </li>
              ))}
              {recentSignups.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-500">No users yet.</li>}
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'activity-engagement',
      actions: <ViewAll href="/app/admin/activity" />,
      content: (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {recentActivity.map((activity) => (
            <li key={activity.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <p className="min-w-0 truncate text-sm text-neutral-800"><strong className="font-medium text-neutral-900">{activity.name}</strong> <span className="text-neutral-500">· {activity.kind === 'pageview' ? 'viewed' : 'active in'} {activity.space}</span></p>
              <span className="shrink-0 text-xs text-neutral-400">{formatRelative(activity.occurredAt)}</span>
            </li>
          ))}
          {recentActivity.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-500">No recent activity tracked.</li>}
        </ul>
      ),
    },
    {
      id: 'system-health',
      actions: <ViewAll href="/app/admin/ai" />,
      content: (
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="AI credential" value={system.aiConfigured ? 'Set' : 'Missing'} tone={system.aiConfigured ? 'default' : 'red'} />
          <StatTile label="AI spend (7d)" value={money(kpis.aiSpend7d)} sub={`${kpis.aiErrors7d} errors`} tone={kpis.aiErrors7d > 0 ? 'red' : 'default'} />
          <StatTile label="Failed emails (7d)" value={system.emailFailures7d} tone={system.emailFailures7d > 0 ? 'red' : 'default'} />
          <StatTile label="Permission overrides" value={system.permissionOverrides} sub="active" />
        </div>
      ),
    },
  ]

  return (
    <AdaptiveDashboard
      dashboardId="admin"
      initialLayout={initialLayout}
      widgets={widgets}
      readOnly={readOnly}
      kpis={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Users" value={kpis.totalUsers} sub={`${kpis.activeUsers} active`} />
          <StatTile label="Active this week" value={kpis.weeklyActiveUsers} sub="signed-in users" />
          <StatTile label="Onboarding" value={kpis.onboardingPending} sub={kpis.onboardingPending > 0 ? 'pending' : 'all complete'} tone={kpis.onboardingPending > 0 ? 'amber' : 'default'} />
          <StatTile label="Open feedback" value={kpis.openFeedback} sub={kpis.openFeedback > 0 ? 'awaiting response' : 'clear'} tone={kpis.openFeedback > 0 ? 'amber' : 'default'} />
          <StatTile label="AI spend (7d)" value={money(kpis.aiSpend7d)} sub={kpis.aiErrors7d > 0 ? `${kpis.aiErrors7d} errors` : 'no errors'} tone={kpis.aiErrors7d > 0 ? 'red' : 'default'} />
        </div>
      }
    />
  )
}
