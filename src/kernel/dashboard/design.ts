import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePanel } from '@/kernel/settings/resolver'
import { designSystemPanel } from '@/kernel/settings/kernel-panels'
import {
  DEFAULT_DASHBOARD_DESIGN,
  type DashboardDesignConfig,
  type DashboardDensity,
  type DashboardPreset,
} from './types'

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

export async function resolveDashboardDesignConfig(supabase: SupabaseClient): Promise<DashboardDesignConfig> {
  try {
    const fields = await resolvePanel(supabase, designSystemPanel)
    const values = Object.fromEntries(fields.map((field) => [field.key, field.value]))
    const split = Number(values.dashboardDefaultSplitRatio)
    return {
      density: enumValue<DashboardDensity>(values.dashboardDensity, ['comfortable', 'compact'], DEFAULT_DASHBOARD_DESIGN.density),
      radius: enumValue(values.radiusStyle, ['crisp', 'rounded', 'soft'], DEFAULT_DASHBOARD_DESIGN.radius),
      elevation: enumValue(values.elevationStyle, ['minimal', 'subtle', 'layered'], DEFAULT_DASHBOARD_DESIGN.elevation),
      motion: enumValue(values.motionProfile, ['calm', 'balanced', 'expressive'], DEFAULT_DASHBOARD_DESIGN.motion),
      taskCelebration: values.taskCelebration !== false && values.taskCelebration !== 'false',
      defaultPreset: enumValue<DashboardPreset>(values.dashboardDefaultPreset, ['balanced', 'focus', 'overview'], DEFAULT_DASHBOARD_DESIGN.defaultPreset),
      defaultSplitRatio: Number.isFinite(split) ? Math.min(0.78, Math.max(0.42, split)) : DEFAULT_DASHBOARD_DESIGN.defaultSplitRatio,
    }
  } catch {
    return DEFAULT_DASHBOARD_DESIGN
  }
}
