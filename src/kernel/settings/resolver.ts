/**
 * kernel/settings/resolver.ts
 *
 * Reads effective settings values with the ADR-0010 precedence
 * **manifest/panel default → platform_settings (DB) → env**, mirroring the shape
 * of `permissions.ts` (defaults in code, overrides in DB). Secret-typed fields
 * are never read from the DB; they resolve only from their `secretRef` env var
 * and are reported as configured/unset — never as a plaintext value.
 *
 * Takes a Supabase client argument (like `resolveAllSpaces`) so it stays a plain
 * function usable from any Server Component without a server-only dependency.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolvedField, SettingsPanel } from '@/kernel/settings/types'

type SettingRow = { scope: string; component_id: string | null; key: string; value: unknown }

/** Load every persisted settings row into a lookup keyed by scope/component/key. */
async function loadRows(supabase: SupabaseClient): Promise<Map<string, unknown>> {
  const { data } = await supabase
    .from('platform_settings')
    .select('scope, component_id, key, value')
  const map = new Map<string, unknown>()
  for (const row of (data ?? []) as SettingRow[]) {
    map.set(`${row.scope}:${row.component_id ?? ''}:${row.key}`, row.value)
  }
  return map
}

/** Resolve one panel's fields to their effective current values, for rendering. */
export async function resolvePanel(
  supabase: SupabaseClient,
  panel: SettingsPanel,
): Promise<ResolvedField[]> {
  const rows = await loadRows(supabase)
  return panel.fields.map((field) => {
    if (field.type === 'secret') {
      const envVal = field.secretRef ? process.env[field.secretRef] : undefined
      return {
        ...field,
        value: envVal ? '••••••••' : '',
        source: envVal ? 'env' : 'unset',
      }
    }
    const dbVal = rows.get(`${panel.scope}:${panel.componentId ?? ''}:${field.key}`)
    if (dbVal !== undefined) return { ...field, value: dbVal, source: 'db' }
    if (field.default !== undefined) return { ...field, value: field.default, source: 'default' }
    return { ...field, value: '', source: 'unset' }
  })
}

/**
 * Resolve a single setting value by scope/component/key. Falls back to the
 * declared default, then to an optional env bootstrap var. Returns `undefined`
 * for secret fields (callers must use the encrypted path, never this).
 */
export async function resolveSetting(
  supabase: SupabaseClient,
  panel: SettingsPanel,
  key: string,
): Promise<unknown> {
  const field = panel.fields.find((f) => f.key === key)
  if (!field || field.type === 'secret') return undefined
  const [resolved] = await resolvePanel(supabase, { ...panel, fields: [field] })
  return resolved?.value
}
