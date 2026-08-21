/**
 * podcast-planning/domain/radar-config.ts — Radar's tunable numbers.
 *
 * Kept apart from `PlanningConfig`, which is the scoring and stage vocabulary
 * every card is measured against. These are operational: cadence, ceilings and
 * a budget. Mixing them would mean the board could not render without resolving
 * a spend limit it has no interest in.
 *
 * Every one of them is a guess until three real reviews have been run, which is
 * exactly why they resolve through Platform Settings rather than being written
 * into the code.
 */

import { componentPanel, resolveSetting } from '@/kernel/settings'
import { createClient } from '@/kernel/data/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { manifest } from '@/modules/podcast-planning/manifest'

export type RadarConfig = {
  enabled: boolean
  /** Kept in every query so a search cannot wander out of the organisation's field. */
  domainAnchor: string
  intervalDays: number
  lookbackDays: number
  maxNames: number
  minSources: number
  maxTopicsPerRun: number
  maxSearchesPerRun: number
  monthlyBudgetUsd: number
  retentionClosedCardMonths: number
}

export const DEFAULT_RADAR_CONFIG: RadarConfig = {
  enabled: true,
  domainAnchor: 'cancer',
  intervalDays: 14,
  lookbackDays: 120,
  maxNames: 12,
  minSources: 2,
  maxTopicsPerRun: 10,
  maxSearchesPerRun: 8,
  monthlyBudgetUsd: 25,
  retentionClosedCardMonths: 12,
}

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

/**
 * Resolve the settings.
 *
 * `background` picks the service-role client, because a cron has no session and
 * would otherwise read nothing and quietly fall back to defaults — which is how
 * an operator's disable flag gets ignored.
 */
export async function resolveRadarConfig(
  opts: { background?: boolean } = {},
): Promise<RadarConfig> {
  const panel = componentPanel(manifest)
  if (!panel) return DEFAULT_RADAR_CONFIG

  try {
    const supabase = opts.background ? createAdminClient() : await createClient()
    const read = (key: string) => resolveSetting(supabase as never, panel, key)
    const [
      enabled,
      domainAnchor,
      intervalDays,
      lookbackDays,
      maxNames,
      minSources,
      maxTopicsPerRun,
      maxSearchesPerRun,
      monthlyBudgetUsd,
      retentionClosedCardMonths,
    ] = await Promise.all([
      read('radarEnabled'),
      read('radarDomainAnchor'),
      read('radarIntervalDays'),
      read('radarLookbackDays'),
      read('radarMaxNames'),
      read('radarMinSources'),
      read('radarMaxTopicsPerRun'),
      read('radarMaxSearchesPerRun'),
      read('radarMonthlyBudgetUsd'),
      read('retentionClosedCardMonths'),
    ])

    return {
      enabled: bool(enabled, DEFAULT_RADAR_CONFIG.enabled),
      domainAnchor:
        typeof domainAnchor === 'string' && domainAnchor.trim()
          ? domainAnchor.trim().toLowerCase()
          : DEFAULT_RADAR_CONFIG.domainAnchor,
      intervalDays: num(intervalDays, DEFAULT_RADAR_CONFIG.intervalDays),
      lookbackDays: num(lookbackDays, DEFAULT_RADAR_CONFIG.lookbackDays),
      maxNames: num(maxNames, DEFAULT_RADAR_CONFIG.maxNames),
      minSources: num(minSources, DEFAULT_RADAR_CONFIG.minSources),
      maxTopicsPerRun: num(maxTopicsPerRun, DEFAULT_RADAR_CONFIG.maxTopicsPerRun),
      maxSearchesPerRun: num(maxSearchesPerRun, DEFAULT_RADAR_CONFIG.maxSearchesPerRun),
      monthlyBudgetUsd: num(monthlyBudgetUsd, DEFAULT_RADAR_CONFIG.monthlyBudgetUsd),
      retentionClosedCardMonths: num(
        retentionClosedCardMonths,
        DEFAULT_RADAR_CONFIG.retentionClosedCardMonths,
      ),
    }
  } catch (error) {
    console.error('[podcast-planning] Radar settings unavailable, using defaults:', error)
    return DEFAULT_RADAR_CONFIG
  }
}
