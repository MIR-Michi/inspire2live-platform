/**
 * kernel/settings/types.ts
 *
 * The shared shapes for the Platform Settings space (ADR-0010). A **panel** is
 * one editable settings surface — either a fixed kernel panel (Organization,
 * etc.) or a component panel derived from a manifest's typed `config`. Both are
 * rendered by the same field renderers and reconciled by the same governance
 * check, so the kernel and a component declare settings the same way.
 *
 * This file is dependency-free (no server-only, no DB) so the governance test
 * and the pure registry can import it in any context.
 */

import type { ConfigField } from '@/kernel/manifest'

/** A single config field plus the stable key it is stored under. */
export type SettingsFieldSpec = ConfigField & { key: string }

/** The scope a setting is persisted under (mirrors `platform_settings.scope`). */
export type SettingsScope = 'kernel' | 'component'

/** One editable settings surface, rendered from its `fields`. */
export type SettingsPanel = {
  /** Unique panel id — `kernel:<name>` or `component:<id>`. */
  id: string
  scope: SettingsScope
  /** null for kernel panels; the manifest id for component panels. */
  componentId: string | null
  title: string
  description?: string
  fields: SettingsFieldSpec[]
}

/** A field with its resolved current value (default → DB), for rendering. */
export type ResolvedField = SettingsFieldSpec & {
  /** Current effective value (never the plaintext of a secret). */
  value: unknown
  /** Where the value came from — drives the "overridden vs default" hint. */
  source: 'db' | 'default' | 'env' | 'unset'
}

/** The fully-qualified storage key for one setting. */
export function settingStorageKey(
  scope: SettingsScope,
  componentId: string | null,
  key: string,
): string {
  return `${scope}:${componentId ?? ''}:${key}`
}
