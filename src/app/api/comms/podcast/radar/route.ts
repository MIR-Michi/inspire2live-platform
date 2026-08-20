import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  checkRadarBudget,
  claimRadarRun,
  finishRadarRun,
  planningAdminDb,
  readRadarStatusRow,
  reportRadarProgress,
  resolveRadarConfig,
  runRadarScan,
} from '@/modules/podcast-planning'

export const maxDuration = 300

/**
 * The fortnightly scan.
 *
 * Fires weekly but scans fortnightly: the schedule is deliberately tighter than
 * the cadence so that `radarIntervalDays` — which an operator can change — is
 * what actually decides, and a missed week is picked up by the next tick rather
 * than waiting a fortnight. The interval gate below is what enforces it.
 *
 * Four gates before any money is spent, in cheapest-first order: the feature
 * flag, the operator's enable switch, the interval, and the trailing-thirty-day
 * spend. Every refusal is a *reported* refusal — three of them write the reason
 * into the run status, where the Radar screen shows it, because a scan that
 * stops silently is indistinguishable from one that is broken (ADR-0016 §5).
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // First because it is an env read, and because a platform with AI switched
  // off has not failed — reporting 503 here would show a red cron every week.
  if (!isAiEnabled()) return NextResponse.json({ ok: true, skipped: 'ai_disabled' })

  const config = await resolveRadarConfig({ background: true })
  if (!config.enabled) return NextResponse.json({ ok: true, skipped: 'radar_disabled' })

  const status = await readRadarStatusRow(await planningAdminDb())
  if (status.finishedAt) {
    const ageMs = Date.now() - new Date(status.finishedAt).getTime()
    if (ageMs < config.intervalDays * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: 'interval_not_elapsed' })
    }
  }

  const budget = await checkRadarBudget(config.monthlyBudgetUsd)
  if (!budget.withinBudget) {
    // Written to the status row rather than only returned: the operator does
    // not read cron responses, they read the screen.
    await finishRadarRun('error', budget.reason, 0)
    return NextResponse.json({ ok: true, skipped: 'over_budget', spentUsd: budget.spentUsd })
  }

  return runScan()
}

/**
 * Manual run. Bypasses the interval — an operator asking for a scan means now —
 * but not the budget, because a button that can be pressed repeatedly is
 * exactly the case the ceiling is for.
 */
export async function POST() {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return NextResponse.json(
      { ok: false, error: 'You do not have access to the podcast planner.' },
      { status: 403 },
    )
  }

  const config = await resolveRadarConfig()
  const budget = await checkRadarBudget(config.monthlyBudgetUsd)
  if (!budget.withinBudget) {
    return NextResponse.json({ ok: false, error: budget.reason }, { status: 429 })
  }
  return runScan()
}

async function runScan() {
  if (!isAiEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI features are disabled.' }, { status: 503 })
  }

  const claim = await claimRadarRun()
  if (!claim.started) return NextResponse.json({ ok: true, skipped: 'already_running' })

  try {
    const [db, config] = await Promise.all([
      planningAdminDb(),
      resolveRadarConfig({ background: true }),
    ])
    const result = await runRadarScan(db, config, { onProgress: reportRadarProgress })
    await finishRadarRun('success', result.message, result.proposals)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Radar scan failed.'
    await finishRadarRun('error', message, null)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
