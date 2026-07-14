/**
 * kernel/settings/persist.ts
 *
 * The kernel primitive that writes a settings panel's non-secret values into
 * `platform_settings`. It coerces each value to its declared type and enforces
 * the SECRET GUARD (ADR-0010 §6): a `type: 'secret'` field is never written —
 * the store holds non-secret, blueprint-portable values only.
 *
 * Auth, catalog lookup, and revalidation live in the module-layer action
 * (`src/modules/settings-actions.ts`); this primitive takes an already-resolved
 * panel + an authenticated user id and a Supabase client, so it stays free of
 * the component catalog and the kernel import boundary holds.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SettingsFieldSpec, SettingsPanel } from '@/kernel/settings/types'

export type PersistResult =
  | { ok: true; saved: number }
  | { ok: false; error: string }

/** Coerce a raw form value to the field's declared type. `undefined` = skip. */
function coerce(field: SettingsFieldSpec, raw: unknown): unknown {
  switch (field.type) {
    case 'boolean':
      return raw === true || raw === 'true' || raw === 'on'
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
      return Number.isFinite(n) ? n : undefined
    }
    case 'enum':
      return field.options?.includes(String(raw)) ? String(raw) : undefined
    default:
      return typeof raw === 'string' ? raw : String(raw ?? '')
  }
}

/** Persist a panel's non-secret values (replace-in-place per key). */
export async function persistPanelValues(
  supabase: SupabaseClient,
  panel: SettingsPanel,
  values: Record<string, unknown>,
  userId: string,
): Promise<PersistResult> {
  let saved = 0
  for (const field of panel.fields) {
    if (field.type === 'secret') continue // never persisted here (secret guard)
    if (!(field.key in values)) continue
    const value = coerce(field, values[field.key])
    if (value === undefined) continue

    // The coalesced unique index makes (scope, component, key) single-valued, so
    // delete-then-insert is a safe upsert across the nullable component_id.
    const del = supabase
      .from('platform_settings')
      .delete()
      .eq('scope', panel.scope)
      .eq('key', field.key)
    await (panel.componentId === null
      ? del.is('component_id', null)
      : del.eq('component_id', panel.componentId))

    const { error } = await supabase.from('platform_settings').insert({
      scope: panel.scope,
      component_id: panel.componentId,
      key: field.key,
      value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    if (error) return { ok: false, error: error.message }
    saved++
  }
  return { ok: true, saved }
}
