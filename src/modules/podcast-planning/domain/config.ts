/**
 * podcast-planning/domain/config.ts — effective component configuration.
 *
 * Same shape and same reasoning as the network component's: every threshold the
 * concept names resolves through Platform Settings (default → DB → env) and
 * falls back to the declared defaults if the store is unreachable. The planner
 * must keep working when settings do not.
 */

import { componentPanel, resolveSetting } from '@/kernel/settings'
import { createClient } from '@/kernel/data/server'
import { manifest } from '@/modules/podcast-planning/manifest'
import type { PlanningConfig } from '@/modules/podcast-planning/domain/types'
import { DEFAULT_PLANNING_CONFIG } from '@/modules/podcast-planning/domain/types'

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function resolvePlanningConfig(): Promise<PlanningConfig> {
  const panel = componentPanel(manifest)
  if (!panel) return DEFAULT_PLANNING_CONFIG

  try {
    const supabase = await createClient()
    const read = (key: string) => resolveSetting(supabase, panel, key)
    const [
      openAskLimit,
      liveQuestionLimit,
      nudgeAfterDays,
      silenceIsNoAfterDays,
      planningStallDays,
      timelinessHalfLifeDays,
    ] = await Promise.all([
      read('openAskLimit'),
      read('liveQuestionLimit'),
      read('nudgeAfterDays'),
      read('silenceIsNoAfterDays'),
      read('planningStallDays'),
      read('timelinessHalfLifeDays'),
    ])

    return {
      openAskLimit: num(openAskLimit, DEFAULT_PLANNING_CONFIG.openAskLimit),
      liveQuestionLimit: num(liveQuestionLimit, DEFAULT_PLANNING_CONFIG.liveQuestionLimit),
      nudgeAfterDays: num(nudgeAfterDays, DEFAULT_PLANNING_CONFIG.nudgeAfterDays),
      silenceIsNoAfterDays: num(silenceIsNoAfterDays, DEFAULT_PLANNING_CONFIG.silenceIsNoAfterDays),
      planningStallDays: num(planningStallDays, DEFAULT_PLANNING_CONFIG.planningStallDays),
      timelinessHalfLifeDays: num(
        timelinessHalfLifeDays,
        DEFAULT_PLANNING_CONFIG.timelinessHalfLifeDays,
      ),
    }
  } catch (error) {
    console.error('[podcast-planning] settings unavailable, using declared defaults:', error)
    return DEFAULT_PLANNING_CONFIG
  }
}
