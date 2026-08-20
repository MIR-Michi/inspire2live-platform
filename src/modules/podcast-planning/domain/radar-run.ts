import 'server-only'

/**
 * podcast-planning/domain/radar-run.ts — the singleton run lock and the first
 * cost guardrail in the platform.
 *
 * The lock is the `conference_discovery_status` pattern: claim, write progress,
 * and self-heal a run that a serverless kill left marked `running` forever.
 *
 * The budget is new. `ai_usage_log` has recorded every call and its estimated
 * cost since the AI foundation shipped, and until now nothing has ever read it
 * to make a decision. Radar is the first unattended fan-out, so it is where
 * that changes — and the refusal is *written into the run status*, because a
 * guardrail nobody can see is indistinguishable from a broken feature
 * (ADR-0016 §5).
 *
 * The ceiling deliberately does not apply to a person pressing a button. A
 * human waiting for six names is not the runaway case, and a platform that
 * refuses to work for the person paying attention has optimised the wrong risk.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanningClient } from '@/modules/podcast-planning/domain/radar-repository'
import {
  planningAdminDb,
  readRadarStatusRow,
  writeRadarStatus,
} from '@/modules/podcast-planning/domain/radar-repository'

/** Matches the route's `maxDuration`, with headroom for the final status write. */
const STALE_RUN_MS = 330 * 1000

const BUDGET_WINDOW_DAYS = 30

/** The `feature` strings Radar writes to `ai_usage_log`. Spend is counted over these only. */
export const RADAR_FEATURES = ['podcast_radar_names', 'podcast_radar_topics'] as const

export type BudgetVerdict =
  | { withinBudget: true; spentUsd: number; limitUsd: number }
  | { withinBudget: false; spentUsd: number; limitUsd: number; reason: string }

/**
 * What Radar has cost in the trailing thirty days.
 *
 * Counts Radar's own features rather than all AI spend: a shared ceiling would
 * mean a busy month of meeting summaries silently switches Radar off, and the
 * operator would have no way to tell which feature stopped.
 */
export async function checkRadarBudget(limitUsd: number): Promise<BudgetVerdict> {
  const since = new Date(Date.now() - BUDGET_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data, error } = await admin
    .from('ai_usage_log')
    .select('estimated_cost_usd')
    .in('feature', RADAR_FEATURES)
    .gte('created_at', since)

  if (error) {
    // Fail open, loudly. A telemetry read that breaks should not be able to
    // switch a product feature off — but it must not be invisible either.
    console.error('[podcast-planning] budget check failed, allowing the run:', error.message)
    return { withinBudget: true, spentUsd: 0, limitUsd }
  }

  const spentUsd = (data ?? []).reduce(
    (total: number, row: { estimated_cost_usd: number | string | null }) =>
      total + Number(row.estimated_cost_usd ?? 0),
    0,
  )

  if (spentUsd >= limitUsd) {
    return {
      withinBudget: false,
      spentUsd,
      limitUsd,
      reason:
        `Radar has spent $${spentUsd.toFixed(2)} in the last ${BUDGET_WINDOW_DAYS} days, against a limit of ` +
        `$${limitUsd.toFixed(2)}. The scan did not run. Raise the limit in Platform Settings, or leave it — ` +
        `"Find names" on a question still works and is not affected.`,
    }
  }

  return { withinBudget: true, spentUsd, limitUsd }
}

/** Claim the lock. Returns false when a fresh run is already in progress. */
export async function claimRadarRun(): Promise<{ started: boolean; reason?: string }> {
  const db = await planningAdminDb()
  const current = await readRadarStatusRow(db)

  if (current.status === 'running' && current.startedAt) {
    const age = Date.now() - new Date(current.startedAt).getTime()
    if (age < STALE_RUN_MS) return { started: false, reason: 'already_running' }
  }

  await writeRadarStatus(db, {
    last_run_status: 'running',
    last_run_started_at: new Date().toISOString(),
    last_run_finished_at: null,
    last_run_message: 'Reading the open sources.',
    last_run_inserted: null,
  })
  return { started: true }
}

/**
 * Heal a run that was killed before it could write a final state.
 *
 * Called from the read path so the Radar screen never shows a spinner that will
 * spin forever — and says what happened rather than resetting to idle, because
 * "nothing was saved from that run" is information the reader needs.
 */
export async function healStaleRadarRun(db: PlanningClient): Promise<void> {
  const current = await readRadarStatusRow(db)
  if (current.status !== 'running' || !current.startedAt) return
  if (Date.now() - new Date(current.startedAt).getTime() <= STALE_RUN_MS) return

  await writeRadarStatus(db, {
    last_run_status: 'error',
    last_run_finished_at: new Date().toISOString(),
    last_run_message: 'The previous scan was interrupted before it finished. Nothing was saved from it.',
    last_run_inserted: null,
  })
}

export async function reportRadarProgress(message: string): Promise<void> {
  try {
    await writeRadarStatus(await planningAdminDb(), { last_run_message: message.slice(0, 600) })
  } catch (error) {
    // Progress is a courtesy; losing it must never fail the run itself.
    console.error('[podcast-planning] could not write Radar progress:', error)
  }
}

export async function finishRadarRun(
  status: 'success' | 'error',
  message: string,
  inserted: number | null,
): Promise<void> {
  await writeRadarStatus(await planningAdminDb(), {
    last_run_status: status,
    last_run_finished_at: new Date().toISOString(),
    last_run_message: message.slice(0, 600),
    last_run_inserted: inserted,
  })
}
