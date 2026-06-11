/**
 * Congress Workspace – Overview
 *
 * All operational data now comes from Supabase (congress_tasks,
 * congress_workstreams, congress_raid_items, congress_approval_requests).
 * No demo/hardcoded data is rendered.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToCongressAssignment } from '@/lib/congress-assignments'
import type { CongressAssignmentRow } from '@/lib/congress-assignments'
import { EVENT_STATUS_META, normalizeEventStatus } from '@/lib/congress'
import { SetCongressRoles } from '@/components/roles/set-congress-roles'
import { WorkspaceNav } from '@/components/congress/workspace/workspace-nav'
import { ContextPanel } from '@/components/congress/workspace/context-panel'
import { HealthChip } from '@/components/ui/health-chip'
import { responsibilitySummary } from '@/lib/congress-policy'
import { fetchLatestWorkspaceEvent } from '@/lib/congress-workspace/current-event'
import { WorkspaceDiagnostics } from '@/components/congress/workspace/workspace-diagnostics'
import { StageBanner } from '@/components/congress/workspace/stage-banner'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { updateCongressStatus } from '@/app/app/congress/workspace/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

type DbTask = {
  id: string
  title: string
  status: string
  priority: string
  lane: string
  due_date: string | null
  owner_name: string | null
}

type DbWorkstream = {
  id: string
  title: string
  health: string
  progress_pct: number
  next_milestone: string | null
  owner_role: string | null
}

type DbRaidItem = {
  id: string
  title: string
  type: string
  status: string
  priority: string
}

type DbApproval = {
  id: string
  status: string
}

type DbActivity = {
  id: string
  action: string
  entity_title: string | null
  created_at: string
}

// ─── Local UI helpers ────────────────────────────────────────────────────────

function CyclePhaseBar({
  status,
  canEdit,
  congressId,
}: {
  status: unknown
  canEdit: boolean
  congressId: string | null
}) {
  const phases = [
    { key: 'planning',        label: 'Planning' },
    { key: 'open_for_topics', label: 'Topics Open' },
    { key: 'agenda_set',      label: 'Agenda Set' },
    { key: 'live',            label: 'Live' },
    { key: 'post_congress',   label: 'Post-Congress' },
    { key: 'archived',        label: 'Archived' },
  ] as const
  const activeIdx = phases.findIndex((p) => p.key === normalizeEventStatus(status))
  return (
    <div className="flex items-center gap-0">
      {phases.map((phase, i) => {
        const past = i < activeIdx
        const current = i === activeIdx
        const interactive = canEdit && Boolean(congressId)
        return (
          <div key={phase.key} className="flex items-center">
            <form action={updateCongressStatus} className="flex flex-col items-center gap-0.5">
              <input type="hidden" name="congress_id" value={congressId ?? ''} />
              <input type="hidden" name="status" value={phase.key} />
              <button
                type="submit"
                disabled={!interactive}
                className={[
                  'flex flex-col items-center gap-0.5 focus:outline-none',
                  interactive ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
                title={
                  interactive
                    ? `Set stage to: ${phase.label}`
                    : 'Only Platform Admins can change the congress stage'
                }
              >
                <div className={[
                  'h-2.5 w-2.5 rounded-full border-2',
                  past    ? 'bg-orange-500 border-orange-500' : '',
                  current ? 'bg-white border-orange-500 ring-2 ring-orange-300' : '',
                  !past && !current ? 'bg-neutral-200 border-neutral-300' : '',
                  interactive ? 'hover:scale-110 transition-transform' : '',
                ].join(' ')} />
                <span className={[
                  'text-[10px] hidden sm:block',
                  current ? 'font-bold text-orange-700' : 'text-neutral-400',
                  interactive ? 'hover:text-neutral-700' : '',
                ].join(' ')}>
                  {phase.label}
                </span>
              </button>
            </form>
            {i < phases.length - 1 && (
              <div className={['h-0.5 w-6 sm:w-10 mx-0.5 -mt-3.5',
                i < activeIdx ? 'bg-orange-400' : 'bg-neutral-200',
              ].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PhaseBadge({ status }: { status: unknown }) {
  const m = EVENT_STATUS_META[normalizeEventStatus(status)]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.badge}`}>
      {m.label}
    </span>
  )
}

function AuthorityStrip({
  platformRole,
  congressRoles,
  tone,
}: {
  platformRole: string
  congressRoles: string[]
  tone: string
}) {
  const hasCongressRole = congressRoles.length > 0
  const isAdmin = platformRole === 'PlatformAdmin'
  const canEdit = tone === 'success' || isAdmin

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
      <span>
        <span className="font-semibold text-neutral-900">Platform:</span> {platformRole}
      </span>
      <span className="text-neutral-300">·</span>
      {hasCongressRole ? (
        <span>
          <span className="font-semibold text-neutral-900">Congress role:</span>{' '}
          {congressRoles.join(', ')}
        </span>
      ) : (
        <span className="text-neutral-500">
          <span className="font-semibold text-neutral-700">Congress role:</span>{' '}
          None assigned
          {!isAdmin && (
            <span className="ml-1 text-neutral-400">— ask an admin to add a congress assignment for you</span>
          )}
          {isAdmin && (
            <span className="ml-1 text-neutral-400">— use User Management to assign congress responsibilities</span>
          )}
        </span>
      )}
      <span className="text-neutral-300">·</span>
      <span className={canEdit ? 'text-green-700' : 'text-amber-700'}>
        {canEdit ? '✓ Can edit' : '⚠ View only'}
      </span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CongressWorkspaceOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const platformRole: string = profile?.role ?? 'PatientAdvocate'
  const isAdmin = platformRole === 'PlatformAdmin'

  // ── Event ──
  const { event: currentEvent, issues: eventIssues } = await fetchLatestWorkspaceEvent(supabase)
  const usingDemoEvent = !currentEvent

  // ── Assignments for current user ──
  const { data: dbAssignments, error: assignmentsError } = await supabase
    .from('congress_assignments')
    .select('*')
    .eq('congress_id', currentEvent?.id ?? '__none__')
    .eq('user_id', user.id)

  const assignmentRows: CongressAssignmentRow[] = (dbAssignments ?? []) as unknown as CongressAssignmentRow[]
  const usingDemoAssignments = assignmentRows.length === 0

  const assignments = assignmentRows.map(r => rowToCongressAssignment(r))
  const congressRoles = assignments.map(a => a.projectRole)
  const resp = responsibilitySummary(platformRole, congressRoles)

  // ── Operational data — all from DB ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [
    { data: rawTasks, error: tasksError },
    { data: rawWorkstreams, error: workstreamsError },
    { data: rawRaid, error: raidError },
    { data: rawApprovals, error: approvalsError },
    { data: rawActivity, error: activityError },
  ] = await Promise.all([
    currentEvent
      ? sb
          .from('congress_tasks')
          .select('id, title, status, priority, lane, due_date, owner_name')
          .eq('congress_id', currentEvent.id)
          .neq('status', 'done')
          .order('priority')
      : { data: [], error: null },
    currentEvent
      ? sb
          .from('congress_workstreams')
          .select('id, title, health, progress_pct, next_milestone, owner_role')
          .eq('congress_id', currentEvent.id)
          .order('sort_order')
      : { data: [], error: null },
    currentEvent
      ? sb
          .from('congress_raid_items')
          .select('id, title, type, status, priority')
          .eq('congress_id', currentEvent.id)
          .in('status', ['open', 'mitigating'])
          .order('priority')
      : { data: [], error: null },
    currentEvent
      ? sb
          .from('congress_approval_requests')
          .select('id, status')
          .eq('congress_id', currentEvent.id)
          .in('status', ['submitted', 'in_review'])
      : { data: [], error: null },
    currentEvent
      ? sb
          .from('congress_activity_log')
          .select('id, action, entity_title, created_at')
          .eq('congress_id', currentEvent.id)
          .order('created_at', { ascending: false })
          .limit(6)
      : { data: [], error: null },
  ])

  const tasks: DbTask[]        = (rawTasks       ?? []) as DbTask[]
  const workstreams: DbWorkstream[] = (rawWorkstreams ?? []) as DbWorkstream[]
  const raidItems: DbRaidItem[] = (rawRaid        ?? []) as DbRaidItem[]
  const approvals: DbApproval[] = (rawApprovals   ?? []) as DbApproval[]
  const activity: DbActivity[]   = (rawActivity    ?? []) as DbActivity[]

  // ── Derived data from DB records ──
  const nowTasks   = tasks.filter(t => t.lane === 'now')
  const nextTasks  = tasks.filter(t => t.lane === 'next')
  const laterTasks = tasks.filter(t => t.lane === 'later')
  const urgentNow  = nowTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').slice(0, 3)

  const topWorkstream  = workstreams[0] ?? null
  const topRiskItem    = raidItems.find(r => r.type === 'risk' || r.type === 'issue') ?? raidItems[0] ?? null
  const pendingCount   = approvals.length

  // KPIs derived from workstream health
  const kpis = workstreams.slice(0, 4).map(ws => ({
    id: ws.id,
    label: ws.title.split('&')[0].trim(),
    value: ws.health === 'on_track' ? 'On track' : ws.health === 'blocked' ? 'Blocked' : 'At risk',
    status: ws.health === 'on_track' ? 'good' as const : ws.health === 'blocked' ? 'bad' as const : 'warn' as const,
  }))

  const allIssues = [...eventIssues]
  if (assignmentsError) allIssues.push({ scope: 'congress_assignments.select', message: assignmentsError.message, code: assignmentsError.code, hint: (assignmentsError as unknown as { hint?: string }).hint })
  if (tasksError) allIssues.push({ scope: 'congress_tasks.select', message: tasksError.message, code: tasksError.code, hint: (tasksError as unknown as { hint?: string }).hint })
  if (workstreamsError) allIssues.push({ scope: 'congress_workstreams.select', message: workstreamsError.message, code: workstreamsError.code, hint: (workstreamsError as unknown as { hint?: string }).hint })
  if (raidError) allIssues.push({ scope: 'congress_raid_items.select', message: raidError.message, code: raidError.code, hint: (raidError as unknown as { hint?: string }).hint })
  if (approvalsError) allIssues.push({ scope: 'congress_approval_requests.select', message: approvalsError.message, code: approvalsError.code, hint: (approvalsError as unknown as { hint?: string }).hint })
  if (activityError) allIssues.push({ scope: 'congress_activity_log.select', message: activityError.message, code: activityError.code, hint: (activityError as unknown as { hint?: string }).hint })

  return (
    <div className="mx-auto max-w-6xl">
      <WorkspaceDiagnostics issues={allIssues} />

      <SetCongressRoles roles={congressRoles} />

      {/* ── HEADER ROW ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            {currentEvent?.title ?? 'Congress'} — Workspace
          </h1>
          <p className="text-xs text-neutral-500">Execution view · triage your work for today</p>
        </div>
        {currentEvent?.status && (
          <div className="flex items-center gap-2">
            <PhaseBadge status={currentEvent.status} />
            <span className="hidden text-xs text-neutral-400 sm:block">
              {EVENT_STATUS_META[normalizeEventStatus(currentEvent.status)].label} phase
            </span>
          </div>
        )}
      </div>

      {/* ── PHASE BAR ──────────────────────────────────────────────────────── */}
      {currentEvent?.status && (
        <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
          <CyclePhaseBar
            status={currentEvent.status}
            canEdit={isAdmin}
            congressId={currentEvent?.id ?? null}
          />
        </div>
      )}

      {currentEvent?.status && (
        <div className="mt-3">
          <StageBanner status={currentEvent.status} startDate={currentEvent?.start_date ?? null} />
        </div>
      )}

      {/* ── ROLE AUTHORITY STRIP ──────────────────────────────────────────── */}
      <div className="mt-3">
        <AuthorityStrip
          platformRole={platformRole}
          congressRoles={congressRoles}
          tone={resp.tone}
        />
      </div>

      {/* ── WORKSPACE NAV ──────────────────────────────────────────────────── */}
      <div className="mt-4">
        <WorkspaceNav active="overview" status={currentEvent?.status} />
      </div>

      {/* ── ADMIN ONLY: setup warning ───────────────────────────────────────── */}
      {isAdmin && (usingDemoEvent || usingDemoAssignments) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-semibold text-amber-900">Admin: production data missing</p>
          <ul className="mt-1 list-disc pl-4 text-amber-800 space-y-0.5">
            {usingDemoEvent && <li>No rows in <code className="rounded bg-white/60 px-1">congress_events</code> — add at least one current event.</li>}
            {usingDemoAssignments && <li>No rows in <code className="rounded bg-white/60 px-1">congress_assignments</code> for your user — assign yourself via User Management.</li>}
          </ul>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
      <div className="mt-5 flex gap-6">
        <div className="min-w-0 flex-1 space-y-6">

          {/* PRIMARY ACTION ZONE: urgent "Now" items */}
          {urgentNow.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-700">
                  Action required now
                </h2>
                <a href="/app/congress/workspace/tasks"
                   className="text-xs text-orange-600 hover:underline">
                  All tasks →
                </a>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {urgentNow.map(t => (
                  <div key={t.id}
                       className="flex flex-col gap-1 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
                      {t.priority}
                    </p>
                    <p className="text-sm font-semibold text-neutral-900 leading-tight">{t.title}</p>
                    <p className="text-xs text-neutral-500">{t.owner_name ?? 'Unowned'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TRIAGE VIEW: Now / Next / Later */}
          <CollapsibleCard variant="plain" title="This week" storageKey="congress-ws-thisweek">
            <div className="grid gap-3 md:grid-cols-3">
              {(
                [
                  { label: 'NOW',  tasks: nowTasks,   accent: 'border-orange-300 bg-orange-50/40' },
                  { label: 'NEXT', tasks: nextTasks,  accent: 'border-neutral-200 bg-white' },
                  { label: 'LATER',tasks: laterTasks, accent: 'border-neutral-200 bg-neutral-50' },
                ] as const
              ).map(({ label, tasks: laneTasks, accent }) => (
                <div key={label} className={`rounded-xl border p-3 ${accent}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p>
                  <div className="mt-2 space-y-1.5">
                    {laneTasks.length === 0 && (
                      <p className="text-xs text-neutral-400 italic">Nothing here</p>
                    )}
                    {laneTasks.map(t => (
                      <div key={t.id}
                           className="rounded-lg border border-neutral-200 bg-white/70 px-2.5 py-1.5">
                        <p className="text-xs font-medium text-neutral-900 leading-snug">{t.title}</p>
                        <p className="text-[10px] text-neutral-400">{t.status} · {t.owner_name ?? 'Unowned'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {tasks.length === 0 && (
              <p className="mt-3 text-center text-xs text-neutral-400">
                No open tasks for this congress yet.{' '}
                <a href="/app/congress/workspace/tasks" className="text-orange-600 hover:underline">View tasks →</a>
              </p>
            )}
          </CollapsibleCard>

          {/* OPEN RISKS from DB */}
          {raidItems.length > 0 && (
            <CollapsibleCard
              variant="plain"
              title="Open risks & issues"
              storageKey="congress-ws-risks"
              actions={
                <a href="/app/congress/workspace/raid" className="text-xs text-neutral-500 hover:underline">
                  Full RAID log →
                </a>
              }
            >
              <div className="space-y-2">
                {raidItems.slice(0, 3).map(r => (
                  <div key={r.id}
                       className={['flex items-start gap-3 rounded-lg border px-3 py-2 text-xs',
                         r.priority === 'high'
                           ? 'border-red-200 bg-red-50 text-red-800'
                           : 'border-amber-200 bg-amber-50 text-amber-800',
                       ].join(' ')}>
                    <span className="font-semibold uppercase mt-0.5">{r.type}</span>
                    <span>{r.title}</span>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* ACTIVITY (placeholder — no activity log table yet) */}
          <CollapsibleCard variant="plain" title="Recent changes" storageKey="congress-ws-activity">
            <div className="space-y-1.5">
              {activity.length === 0 && (
                <p className="text-xs text-neutral-400 italic">No recent activity recorded yet.</p>
              )}
              {activity.length > 0 && (
                <ol className="space-y-1">
                  {activity.map(a => (
                    <li key={a.id} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white/70 px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-800">
                          {a.action.replaceAll('_', ' ')}
                          {a.entity_title ? <span className="text-neutral-500"> · {a.entity_title}</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-neutral-400">
                        {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </CollapsibleCard>
        </div>

        {/* ── CONTEXT SIDEBAR ─────────────────────────────────────────────── */}
        <ContextPanel
          title="Event health"
          subtitle="Key metrics for the current congress"
        >
          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Next milestone
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 leading-tight">
              {topWorkstream?.next_milestone ?? 'No milestone recorded'}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Top risk
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 leading-tight">
              {topRiskItem?.title ?? 'No open risks'}
            </p>
            <a href="/app/congress/workspace/raid"
               className="mt-1 text-[10px] text-orange-600 hover:underline block">
              View RAID →
            </a>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Pending approvals
            </p>
            <p className="mt-1 text-sm text-neutral-700">
              {pendingCount > 0 ? `${pendingCount} pending` : 'None pending'}
            </p>
            <a href="/app/congress/workspace/approvals"
               className="mt-1 text-[10px] text-orange-600 hover:underline block">
              Review →
            </a>
          </div>

          {kpis.length > 0 && (
            <div className="space-y-1.5">
              {kpis.map(k => (
                <HealthChip key={k.id} label={k.label} value={k.value} status={k.status} />
              ))}
            </div>
          )}
        </ContextPanel>
      </div>
    </div>
  )
}
