import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDefaultDashboardLayout, sanitizeDashboardLayout } from './layout'
import type { DashboardDefinition, DashboardLayoutState } from './types'

export async function loadDashboardLayout(
  supabase: SupabaseClient,
  userId: string,
  definition: DashboardDefinition,
  defaults?: Parameters<typeof buildDefaultDashboardLayout>[1],
): Promise<{ layout: DashboardLayoutState; customized: boolean }> {
  const { data, error } = await supabase
    .from('user_dashboard_preferences')
    .select('layout, layout_version')
    .eq('user_id', userId)
    .eq('dashboard_id', definition.id)
    .maybeSingle()

  if (error) {
    // A missing preference must never make the dashboard unavailable. Migration
    // deployment order and previews can briefly expose the app before the table.
    return { layout: buildDefaultDashboardLayout(definition, defaults), customized: false }
  }
  if (!data) return { layout: buildDefaultDashboardLayout(definition, defaults), customized: false }

  return {
    layout: sanitizeDashboardLayout(definition, data.layout, defaults),
    customized: true,
  }
}

export async function saveDashboardLayout(
  supabase: SupabaseClient,
  userId: string,
  definition: DashboardDefinition,
  layout: DashboardLayoutState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('user_dashboard_preferences').upsert(
    {
      user_id: userId,
      dashboard_id: definition.id,
      layout_version: definition.version,
      layout,
      updated_at: now,
    },
    { onConflict: 'user_id,dashboard_id' },
  )
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function resetDashboardLayout(
  supabase: SupabaseClient,
  userId: string,
  definition: DashboardDefinition,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('user_dashboard_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('dashboard_id', definition.id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
