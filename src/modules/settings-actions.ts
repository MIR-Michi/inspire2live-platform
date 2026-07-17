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

function unexpectedSaveError(cause: unknown): SaveSettingsResult {
  const message = cause instanceof Error ? cause.message : 'Unexpected settings error'
  return {
    ok: false,
    error: `The design settings were not saved. ${message}`,
  }
}

export async function saveSettingsPanel(
  panelId: string,
  values: Record<string, unknown>,
): Promise<SaveSettingsResult> {
  try {
    const panel = findSettingsPanel(panelId)
    if (!panel) return { ok: false, error: `Unknown settings panel: ${panelId}` }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profileError) return { ok: false, error: `Could not verify your permissions: ${profileError.message}` }
    if (!isPlatformAdmin(profile?.role)) return { ok: false, error: 'Platform Admin access is required.' }

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
  } catch (cause) {
    return unexpectedSaveError(cause)
  }
}
