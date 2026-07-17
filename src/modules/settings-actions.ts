'use server'

/**
 * The server action behind every Platform Settings panel (ADR-0010). It resolves
 * the authoritative panel by id server-side, gates to PlatformAdmin, then
 * delegates coercion and persistence to the kernel.
 */

import { revalidatePath } from 'next/cache'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'
import { persistPanelValues } from '@/kernel/settings'
import type { PersistResult } from '@/kernel/settings'
import { componentSettingsHref, findSettingsPanel } from '@/modules/settings-registry'

export type SaveSettingsResult = PersistResult

export async function saveSettingsPanel(
  panelId: string,
  values: Record<string, unknown>,
): Promise<SaveSettingsResult> {
  const panel = findSettingsPanel(panelId)
  if (!panel) return { ok: false, error: `Unknown settings panel: ${panelId}` }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) return { ok: false, error: 'PlatformAdmin required' }

  const result = await persistPanelValues(supabase, panel, values, user.id)
  if (!result.ok) return result

  revalidatePath('/app/settings')
  revalidatePath('/app/settings/organization')
  revalidatePath('/app/settings/design')
  // Design defaults are resolved in the app shell and dashboard pages.
  if (panel.id === 'kernel:design-system') {
    revalidatePath('/app', 'layout')
    revalidatePath('/app/dashboard')
    revalidatePath('/app/comms/dashboard')
  }
  if (panel.componentId) {
    revalidatePath(`/app/settings/components/${panel.componentId}`)
    revalidatePath(componentSettingsHref(panel.componentId))
  }
  return result
}
