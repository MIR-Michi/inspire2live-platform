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

type CoerceResult =
  | { ok: true; skip: true }
  | { ok: true; skip: false; value: unknown }
  | { ok: false; error: string }

/** Coerce and validate a raw form value against the field declaration. */
function coerce(field: SettingsFieldSpec, raw: unknown): CoerceResult {
  switch (field.type) {
    case 'boolean':
      return { ok: true, skip: false, value: raw === true || raw === 'true' || raw === 'on' }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
      // Preserve the settings framework's compatibility rule: malformed values
      // are ignored rather than replacing a valid stored value. Declared bounds,
      // however, are an explicit operator contract and therefore return an error.
      if (!Number.isFinite(n)) return { ok: true, skip: true }
      if (field.min !== undefined && n < field.min) {
        return { ok: false, error: `${field.label ?? field.key} must be at least ${field.min}.` }
      }
      if (field.max !== undefined && n > field.max) {
        return { ok: false, error: `${field.label ?? field.key} must be no more than ${field.max}.` }
      }
      if (field.step !== undefined && field.min !== undefined) {
        const units = (n - field.min) / field.step
        if (Math.abs(units - Math.round(units)) > 1e-9) {
          return { ok: false, error: `${field.label ?? field.key} must use increments of ${field.step}.` }
        }
      }
      return { ok: true, skip: false, value: n }
    }
    case 'enum':
      return field.options?.includes(String(raw))
        ? { ok: true, skip: false, value: String(raw) }
        : { ok: true, skip: true }
    default:
      return { ok: true, skip: false, value: typeof raw === 'string' ? raw : String(raw ?? '') }
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
    const coerced = coerce(field, values[field.key])
    if (!coerced.ok) return coerced
    if (coerced.skip) continue

    // The coalesced unique index makes (scope, component, key) single-valued, so
    // delete-then-insert is a safe upsert across the nullable component_id.
    const del = supabase
      .from('platform_settings')
      .delete()
      .eq('scope', panel.scope)
      .eq('key', field.key)
    const { error: deleteError } = await (panel.componentId === null
      ? del.is('component_id', null)
      : del.eq('component_id', panel.componentId))
    if (deleteError) return { ok: false, error: deleteError.message }

    const { error } = await supabase.from('platform_settings').insert({
      scope: panel.scope,
      component_id: panel.componentId,
      key: field.key,
      value: coerced.value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    if (error) return { ok: false, error: error.message }
    saved++
  }
  return { ok: true, saved }
}
