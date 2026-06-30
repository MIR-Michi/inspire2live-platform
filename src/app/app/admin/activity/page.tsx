import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRoleLabel, getRoleBadgeColor } from '@/lib/role-access'
import { loadUserActivityMetrics, type UserActivity } from '@/lib/user-activity'

export const dynamic = 'force-dynamic'

const WINDOWS = [7, 30, 90] as const

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-900">Access Denied</p>
          <p className="text-sm text-neutral-500">Only PlatformAdmin users can access this page.</p>
        </div>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const requested = Number(params.days)
  const windowDays = WINDOWS.includes(requested as (typeof WINDOWS)[number]) ? requested : 30

  const { users, tracking, totalActiveMinutes, totalLogins, totalActions } = await loadUserActivityMetrics(
    supabase,
    windowDays
  )
  const activeUsers = users.filter(
    (u) => u.activeMinutes > 0 || u.pageviews > 0 || u.loginCount > 0 || u.actionCount > 0
  )
  const maxSpaceMinutes = Math.max(1, ...users.flatMap((u) => u.perSpace.map((s) => s.minutes)))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2 border-b border-neutral-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Admin</p>
        <h1 className="text-2xl font-semibold text-neutral-900">User activity</h1>
        <p className="max-w-3xl text-sm text-neutral-600">
          Engagement per registered user. <strong>Logins</strong> and <strong>actions</strong> are backfilled from the
          auth history and the platform&apos;s activity logs, so they reflect the past too. <strong>Active time</strong>{' '}
          only counts minutes when someone is genuinely interacting (visible tab + recent activity) — idle
          &ldquo;logged-in&rdquo; time is excluded — and, like page views and the per-space breakdown, is tracked from
          when this feature went live onward.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-neutral-500">Window:</span>
          {WINDOWS.map((days) => (
            <Link
              key={days}
              href={`/app/admin/activity?days=${days}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                days === windowDays
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Last {days} days
            </Link>
          ))}
        </div>
      </header>

      {!tracking && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Activity tracking storage isn&apos;t available yet — apply migration 00106 to start collecting metrics.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Active users" value={String(activeUsers.length)} meta={`of ${users.length} registered`} />
        <SummaryTile label="Logins" value={String(totalLogins)} meta="sign-ins (incl. history)" />
        <SummaryTile label="Actions" value={String(totalActions)} meta="recorded across the platform" />
        <SummaryTile label="Active time" value={formatMinutes(totalActiveMinutes)} meta="tracked from now on" />
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <UserActivityCard key={u.userId} activity={u} maxSpaceMinutes={maxSpaceMinutes} />
        ))}
        {users.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
            No registered users found.
          </p>
        )}
      </div>
    </div>
  )
}

function SummaryTile({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{meta}</p>
    </div>
  )
}

function UserActivityCard({ activity, maxSpaceMinutes }: { activity: UserActivity; maxSpaceMinutes: number }) {
  const hasAny =
    activity.loginCount > 0 || activity.actionCount > 0 || activity.activeMinutes > 0 || activity.pageviews > 0
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
            {initials(activity.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-neutral-900">{activity.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getRoleBadgeColor(activity.role)}`}>
                {getRoleLabel(activity.role)}
              </span>
            </div>
            <p className="truncate text-xs text-neutral-500">{activity.email ?? '—'}</p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm sm:grid-cols-6">
          <Metric label="Last login" value={formatLastSeen(activity.lastLogin)} />
          <Metric label="Logins" value={String(activity.loginCount)} />
          <Metric label="Actions" value={String(activity.actionCount)} />
          <Metric label="Active time" value={formatMinutes(activity.activeMinutes)} />
          <Metric label="Page views" value={String(activity.pageviews)} />
          <Metric label="Last active" value={formatLastSeen(activity.lastSeen)} />
        </dl>
      </div>

      {activity.perSpace.length > 0 && (
        <details className="group border-t border-neutral-100 px-5 py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-blue-800 hover:text-blue-900">
            <span className="group-open:hidden">Show {activity.spacesVisited} spaces ↓</span>
            <span className="hidden group-open:inline">Hide spaces ↑</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {activity.perSpace.map((space) => (
              <li key={space.space} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3">
                <span className="truncate text-xs font-semibold text-neutral-700">{space.space}</span>
                <span className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.max(4, Math.round((space.minutes / maxSpaceMinutes) * 100))}%` }}
                  />
                </span>
                <span className="whitespace-nowrap text-xs text-neutral-500">
                  {formatMinutes(space.minutes)} · {space.pageviews} views
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!hasAny && (
        <p className="border-t border-neutral-100 px-5 py-2 text-xs text-neutral-400">No recorded activity in this window.</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{label}</dt>
      <dd className="font-semibold text-neutral-900">{value}</dd>
    </div>
  )
}
