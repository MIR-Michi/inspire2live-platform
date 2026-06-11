import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CollapsibleCard } from '@/components/ui/collapsible-card'

// ─── Risk indicator helpers ───────────────────────────────────────────────────

function riskBadge(label: string, level: 'high' | 'medium' | 'ok') {
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const icons = { high: '⚠', medium: '⚡', ok: '✓' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[level]}`}>
      {icons[level]} {label}
    </span>
  )
}

function statCard(label: string, value: string | number, sub?: string, highlight?: boolean) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-red-700' : 'text-neutral-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}

const phaseColor: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-700',
  research: 'bg-purple-100 text-purple-700',
  execution: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-neutral-100 text-neutral-600',
}

const pillarColor: Record<string, string> = {
  inspire2live: 'bg-orange-100 text-orange-700',
  inspire2go: 'bg-blue-100 text-blue-700',
  world_campus: 'bg-emerald-100 text-emerald-700',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function InitiativeOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch full initiative details + health metrics
  const [{ data: dbInit }, { data: healthRow }] = await Promise.all([
    supabase
      .from('initiatives')
      .select('id, title, phase, status, pillar, description, objectives, cancer_types, countries, lead_id')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('initiative_health')
      .select(
        'id, member_count, open_tasks, blocked_tasks, completed_milestones, total_milestones, overdue_milestones, approaching_milestones, last_activity_at, lead_name, lead_country, lead_avatar_url, lead_id, total_tasks, completed_tasks',
      )
      .eq('id', id)
      .maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const init: any = dbInit

  if (!init) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-neutral-500">
        <p className="text-base font-medium">Initiative not found</p>
        <p className="mt-1 text-sm">It may have been removed or you may not have access.</p>
      </div>
    )
  }

  // Compose metrics from health view
  const memberCount = healthRow?.member_count ?? 0
  const openTasks = healthRow?.open_tasks ?? 0
  const blockedTasks = healthRow?.blocked_tasks ?? 0
  const completedMilestones = healthRow?.completed_milestones ?? 0
  const totalMilestones = healthRow?.total_milestones ?? 0
  const overdueMilestones = healthRow?.overdue_milestones ?? 0
  const approachingMilestones = healthRow?.approaching_milestones ?? 0
  const lastActivityAt: string | null = healthRow?.last_activity_at ?? null
  const totalTasks = healthRow?.total_tasks ?? null
  const completedTasks = healthRow?.completed_tasks ?? null

  // Lead info from health view (already joined)
  const leadName: string | null = healthRow?.lead_name ?? null
  const leadCountry: string | null = healthRow?.lead_country ?? null
  const leadRole: string | null = null

  // Core team — fetch from DB
  const { data: dbTeam } = await supabase
    .from('initiative_members')
    .select('user_id, role, profiles(full_name, role, country)')
    .eq('initiative_id', id)
    .limit(5)

  type CoreMember = { user_id: string; name: string; role: string; platform_role: string }
  const coreTeam: CoreMember[] = (dbTeam ?? []).map(m => {
    const p = m.profiles as { full_name?: string; role?: string } | null
    return { user_id: m.user_id, name: p?.full_name ?? 'Member', role: m.role ?? 'contributor', platform_role: p?.role ?? '' }
  })

  // Safe extras — objectives may be string[] or {title,status}[] from DB Json column
  const objectives: string[] = Array.isArray(init.objectives)
    ? (init.objectives as unknown[]).map((o) =>
        typeof o === 'string' ? o : typeof o === 'object' && o !== null && 'title' in o
          ? String((o as Record<string, unknown>).title)
          : JSON.stringify(o),
      )
    : []
  const countries: string[] = Array.isArray(init.countries) ? (init.countries as string[]) : []
  const cancerTypes: string[] = Array.isArray(init.cancer_types)
    ? (init.cancer_types as string[])
    : []
  const description: string = typeof init.description === 'string' ? init.description : ''

  // Capture server time once (avoids impure function lint error on Date.now)
  const nowMs = new Date().getTime()

  // Milestone progress %
  const milestonePercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  // Task completion %
  const taskPercent =
    totalTasks && totalTasks > 0 ? Math.round(((completedTasks ?? 0) / totalTasks) * 100) : null

  // Last activity label
  let lastActivityLabel = 'No recent activity'
  if (lastActivityAt) {
    const daysAgo = Math.floor((nowMs - new Date(lastActivityAt).getTime()) / 86400000)
    lastActivityLabel =
      daysAgo === 0
        ? 'Today'
        : daysAgo === 1
          ? '1 day ago'
          : daysAgo < 7
            ? `${daysAgo} days ago`
            : daysAgo < 14
              ? '1 week ago'
              : `${Math.floor(daysAgo / 7)} weeks ago`
  }

  // Risk assessment
  const risks: Array<{ label: string; level: 'high' | 'medium' | 'ok' }> = []
  if (blockedTasks > 0) risks.push({ label: `${blockedTasks} blocked task${blockedTasks > 1 ? 's' : ''}`, level: blockedTasks > 2 ? 'high' : 'medium' })
  if (overdueMilestones > 0) risks.push({ label: `${overdueMilestones} overdue milestone${overdueMilestones > 1 ? 's' : ''}`, level: 'high' })
  if (approachingMilestones > 0) risks.push({ label: `${approachingMilestones} milestone${approachingMilestones > 1 ? 's' : ''} approaching`, level: 'medium' })
  if (lastActivityAt) {
    const daysAgo = Math.floor((nowMs - new Date(lastActivityAt).getTime()) / 86400000)
    if (daysAgo > 14) risks.push({ label: 'Inactive 2+ weeks', level: 'high' })
    else if (daysAgo > 7) risks.push({ label: 'Low recent activity', level: 'medium' })
  }
  if (risks.length === 0) risks.push({ label: 'No active risks', level: 'ok' })

  const hasHighRisk = risks.some((r) => r.level === 'high')

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${phaseColor[init.phase ?? ''] ?? 'bg-neutral-100 text-neutral-600'}`}
        >
          {init.phase ?? 'Unknown phase'}
        </span>
        {init.pillar && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${pillarColor[init.pillar] ?? 'bg-neutral-100 text-neutral-600'}`}
          >
            {init.pillar.replace('_', ' ')}
          </span>
        )}
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-600">
          {init.status ?? 'active'}
        </span>
      </div>

      {/* ── Initiative Health Alert (if high risk) ── */}
      {hasHighRisk && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">⚠ This initiative has active risks that need attention</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-red-700">
            {risks.filter((r) => r.level === 'high').map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Collaboration Snapshot ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Collaboration Snapshot
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCard('Members', memberCount)}
          {statCard('Open Tasks', openTasks)}
          {statCard('Blocked', blockedTasks, undefined, blockedTasks > 0)}
          {statCard('Milestones', `${completedMilestones}/${totalMilestones}`, `${milestonePercent}% done`)}
        </div>
      </section>

      {/* ── Milestone progress bar ── */}
      {totalMilestones > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700">Milestone Progress</span>
            <span>{milestonePercent}% — {completedMilestones} of {totalMilestones} completed</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-3 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${milestonePercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {overdueMilestones > 0 && riskBadge(`${overdueMilestones} overdue`, 'high')}
            {approachingMilestones > 0 && riskBadge(`${approachingMilestones} approaching`, 'medium')}
            {overdueMilestones === 0 && approachingMilestones === 0 && riskBadge('On track', 'ok')}
          </div>
        </section>
      )}

      {/* ── Task progress bar (if we have data) ── */}
      {taskPercent !== null && totalTasks !== null && totalTasks > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700">Task Progress</span>
            <span>{taskPercent}% — {completedTasks ?? 0} of {totalTasks} completed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${taskPercent}%` }}
            />
          </div>
          {blockedTasks > 0 && (
            <div className="mt-2">
              {riskBadge(`${blockedTasks} task${blockedTasks > 1 ? 's' : ''} blocked`, blockedTasks > 2 ? 'high' : 'medium')}
            </div>
          )}
        </section>
      )}

      {/* ── Initiative Health Panel ── */}
      <CollapsibleCard title="Initiative Health" storageKey="init-health">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Risks */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Risk Indicators</p>
            <div className="flex flex-wrap gap-2">
              {risks.map((r) => (
                <span key={r.label}>{riskBadge(r.label, r.level)}</span>
              ))}
            </div>
          </div>
          {/* Activity */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Last Activity</p>
            <p className="text-sm font-medium text-neutral-700">{lastActivityLabel}</p>
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Description ── */}
      {description && (
        <CollapsibleCard title="About this Initiative" storageKey="init-about">
          <p className="text-sm leading-relaxed text-neutral-700">{description}</p>
        </CollapsibleCard>
      )}

      {/* ── Objectives ── */}
      {objectives.length > 0 && (
        <CollapsibleCard title="Objectives" storageKey="init-objectives">
          <ul className="space-y-2">
            {objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                {obj}
              </li>
            ))}
          </ul>
        </CollapsibleCard>
      )}

      {/* ── Geography & cancer types ── */}
      {(countries.length > 0 || cancerTypes.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {countries.length > 0 && (
            <CollapsibleCard title="Countries" storageKey="init-countries">
              <div className="flex flex-wrap gap-2">
                {countries.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </CollapsibleCard>
          )}
          {cancerTypes.length > 0 && (
            <CollapsibleCard title="Cancer Types" storageKey="init-cancer-types">
              <div className="flex flex-wrap gap-2">
                {cancerTypes.map((ct) => (
                  <span
                    key={ct}
                    className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700"
                  >
                    {ct}
                  </span>
                ))}
              </div>
            </CollapsibleCard>
          )}
        </div>
      )}

      {/* ── Core Team ── */}
      <CollapsibleCard
        title="Core Team"
        storageKey="init-core-team"
        actions={
          <Link href={`/app/initiatives/${id}/team`} className="text-xs text-orange-600 hover:underline">
            View full team →
          </Link>
        }
      >
        <div className="flex flex-wrap gap-3">
          {coreTeam.map(m => {
            const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            const roleColor = m.role === 'lead' ? 'bg-orange-100 text-orange-700' : m.role === 'reviewer' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            return (
              <div key={m.user_id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">{m.name}</p>
                  <span className={`text-[10px] font-medium ${roleColor}`}>{m.role.charAt(0).toUpperCase() + m.role.slice(1)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleCard>

      {/* ── Initiative Lead ── */}
      <CollapsibleCard title="Initiative Lead" storageKey="init-lead">
        {leadName ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
              {leadName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">{leadName}</p>
              <p className="text-xs text-neutral-500">
                {[leadRole, leadCountry].filter(Boolean).join(' · ') || 'Lead'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 italic">No lead assigned yet</p>
        )}
      </CollapsibleCard>
    </div>
  )
}
