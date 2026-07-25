/**
 * network/domain/config.ts — effective component configuration.
 *
 * Every threshold the concept names is manifest `config`, not a constant
 * (ADR-0013 §3), so an operator can retune the component in Platform Settings
 * without a deploy and a blueprint can set it per tenant later. This module
 * resolves the panel through the kernel resolver (default → DB → env) and falls
 * back to the declared defaults if the settings store is unreachable — the
 * planner must keep working when settings do not.
 *
 * It derives the panel from *its own* manifest rather than importing the
 * component registry, so the component stays self-contained and extractable.
 */

import { componentPanel, resolveSetting } from '@/kernel/settings'
import { createClient } from '@/kernel/data/server'
import { manifest } from '@/modules/network/manifest'
import type { NetworkConfig } from '@/modules/network/domain/types'
import { DEFAULT_NETWORK_CONFIG } from '@/modules/network/domain/types'

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** The component's effective settings. Never throws; falls back to defaults. */
export async function resolveNetworkConfig(): Promise<NetworkConfig> {
  const panel = componentPanel(manifest)
  if (!panel) return DEFAULT_NETWORK_CONFIG

  try {
    const supabase = await createClient()
    const read = (key: string) => resolveSetting(supabase, panel, key)
    const [minRouteStrength, maxRoutesShown, twoStepDiscount, introducerCooldownDays] =
      await Promise.all([
        read('minRouteStrength'),
        read('maxRoutesShown'),
        read('twoStepDiscount'),
        read('introducerCooldownDays'),
      ])

    return {
      minRouteStrength: num(minRouteStrength, DEFAULT_NETWORK_CONFIG.minRouteStrength),
      maxRoutesShown: num(maxRoutesShown, DEFAULT_NETWORK_CONFIG.maxRoutesShown),
      twoStepDiscount: num(twoStepDiscount, DEFAULT_NETWORK_CONFIG.twoStepDiscount),
      introducerCooldownDays: num(
        introducerCooldownDays,
        DEFAULT_NETWORK_CONFIG.introducerCooldownDays,
      ),
    }
  } catch (error) {
    console.error('[network] settings unavailable, using declared defaults:', error)
    return DEFAULT_NETWORK_CONFIG
  }
}
