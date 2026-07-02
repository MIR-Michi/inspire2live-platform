import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STAGE_META, STAGE_ORDER, normalizeStage } from '@/lib/initiative-stages'
import type { InitiativeStage } from '@/lib/initiative-stages'
import { PlaceholderButton } from '@/components/ui/client-buttons'

// ─── Status style map ─────────────────────────────────────────────────────────
const statusStyle: Record<string, { ring: string; dot: string; badge: string; label: string }> = {
  completed:  { ring: 'border-emerald-300', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  in_progress:{ ring: 'border-blue-300',    dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',      label: 'In Progress' },
  upcoming:   { ring: 'border-neutral-200', dot: 'bg-neutral-300', badge: 'bg-neutral-100 text-neutral-600',label: 'Upcoming' },
  overdue:    { ring: 'border-red-300',     dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700',        label: 'Overdue' },
}

const fileIcon = (
  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
  </svg>
)

type MilestoneItem = {
  id: string
  title: string
  stage: InitiativeStage
  status: string
  target_date: string
  completed_date: string | null
  evidence_required: boolean
  description: string
  outcome: string | null
}

export default async function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch initiative for context
  const { data: dbInit } = await supabase
    .from('initiatives')
    .select('phase, title')
    .eq('id', id)
    .maybeSingle()

  // Fetch milestones
  const { data: dbMilestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('initiative_id', id)
    .order('target_date')

  const nowMs = new Date().getTime()

  // Map DB milestones to unified type
  const milestones: MilestoneItem[] = (dbMilestones ?? []).map(m => {
    const isOverdue = m.status !== 'completed' && new Date(m.target_date).getTime() < nowMs
    return {
      id: m.id,
      title: m.title,
      stage: normalizeStage(dbInit?.phase),
      status: isOverdue ? 'overdue' : m.status,
      target_date: m.target_date,
      completed_date: m.completed_date,
      evidence_required: m.evidence_required,
      description: m.description ?? '',
      outcome: null,
    }
  })

  // Summary
  const totalCount = milestones.length
  const completedCount = milestones.filter(m => m.status === 'completed').length
  const overdueCount = milestones.filter(m => {
    const isOverdue = m.status !== 'completed' && new Date(m.target_date).getTime() < nowMs
    return m.status === 'overdue' || isOverdue
  }).length
  const inProgressCount = milestones.filter(m => m.status === 'in_progress').length
  const milestonePercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const nextMilestone = milestones.find(m => m.status !== 'completed')

  // Current stage
  const currentStage = normalizeStage(dbInit?.phase ?? 'execution')
  const currentStageIdx = STAGE_ORDER.indexOf(currentStage)

  // Group milestones by stage
  const byStage: Partial<Record<InitiativeStage, MilestoneItem[]>> = {}
  for (const m of milestones) {
    const s = m.stage ?? currentStage
    if (!byStage[s]) byStage[s] = []
    byStage[s]!.push(m)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Milestones Timeline</h2>
          <p className="text-sm text-neutral-500">{completedCount} of {totalCount} completed</p>
        </div>
        <PlaceholderButton
          label="Add Milestone"
          message="Adding milestones is coming in the next release."
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        />
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: totalCount, color: 'text-neutral-900' },
          { label: 'Completed', value: completedCount, color: 'text-emerald-700' },
          { label: 'In Progress', value: inProgressCount, color: 'text-blue-700' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-700' : 'text-neutral-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">Overall Progress</span>
          <span>{milestonePercent}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${milestonePercent}%` }} />
        </div>
        {nextMilestone && (
          <p className="mt-2 text-xs text-neutral-500">
            Next: <span className="font-medium text-neutral-800">{nextMilestone.title}</span>
            {' '}— target {new Date(nextMilestone.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* ── Initiative Stage Pipeline ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Initiative Stage Pipeline</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGE_ORDER.map((stage, idx) => {
            const meta = STAGE_META[stage]
            const isDone = idx < currentStageIdx
            const isCurrent = idx === currentStageIdx
            return (
              <div key={stage} className="flex items-center">
                <div className={`flex flex-col items-center rounded-lg px-3 py-2 text-center transition-all ${
                  isCurrent ? `${meta.color} ring-2 ring-offset-1 ring-orange-400 shadow-sm` :
                  isDone ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-50 text-neutral-400'
                }`}>
                  <span className="text-xs font-semibold whitespace-nowrap">{meta.label}</span>
                  {isCurrent && <span className="mt-0.5 text-[10px] font-medium opacity-70">Current</span>}
                  {isDone && <span className="mt-0.5 text-[10px]">✓</span>}
                </div>
                {idx < STAGE_ORDER.length - 1 && (
                  <div className={`mx-1 h-0.5 w-5 rounded-full ${idx < currentStageIdx ? 'bg-emerald-400' : 'bg-neutral-200'}`} />
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">{STAGE_META[currentStage].description}</p>
      </div>

      {/* ── Timeline ── */}
      <div className="space-y-6">
        {STAGE_ORDER.map(stage => {
          const items = byStage[stage]
          if (!items || items.length === 0) return null
          const meta = STAGE_META[stage]
          return (
            <div key={stage}>
              {/* Stage section header */}
              <div className="mb-3 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>{meta.label} Stage</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Milestone items */}
              <div className="relative ml-3 space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-neutral-200" />

                {items.map((m, idx) => {
                  const isOverdueCalc = m.status !== 'completed' && new Date(m.target_date).getTime() < nowMs
                  const displayStatus = m.status === 'overdue' || isOverdueCalc ? 'overdue' : m.status
                  const s = statusStyle[displayStatus] ?? statusStyle.upcoming
                  return (
                    <div key={m.id} className={`relative pl-8 ${idx < items.length - 1 ? 'pb-6' : ''}`}>
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white ${s.ring}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                      </div>

                      {/* Card */}
                      <div className={`rounded-xl border bg-white p-4 shadow-sm ${s.ring}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-neutral-900">{m.title}</h4>
                              {m.evidence_required && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  {fileIcon} Evidence required
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                              <span>Target: <span className="font-medium text-neutral-700">{new Date(m.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                              {m.completed_date && (
                                <span className="text-emerald-600">✓ Completed: {new Date(m.completed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>
                            {s.label}
                          </span>
                        </div>

                        {m.description && (
                          <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed">{m.description}</p>
                        )}

                        {m.outcome && (
                          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            <span className="font-semibold">Outcome: </span>{m.outcome}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
