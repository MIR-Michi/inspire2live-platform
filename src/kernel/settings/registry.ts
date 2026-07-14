/**
 * kernel/settings/registry.ts
 *
 * The kernel-side settings *mechanism*: deriving a panel from a manifest,
 * composing panels, and reconciling the settings surface. It never imports a
 * component (ADR-0009 §9 kernel boundary) — the caller supplies the manifest
 * list. The component catalog is bound in `src/modules/settings-registry.ts`,
 * which is allowed to import both the kernel and `@/modules/registry`.
 *
 * Pure and dependency-free (no DB, no server-only).
 */

import type { ComponentManifest } from '@/kernel/manifest'
import { isConfigField } from '@/kernel/manifest'
import { kernelPanels } from '@/kernel/settings/kernel-panels'
import type { SettingsFieldSpec, SettingsPanel } from '@/kernel/settings/types'
import { settingStorageKey } from '@/kernel/settings/types'

/** Derive a component's settings panel from its manifest's typed config fields. */
export function componentPanel(manifest: ComponentManifest): SettingsPanel | null {
  const config = manifest.config ?? {}
  const fields: SettingsFieldSpec[] = Object.entries(config)
    .filter(([, field]) => isConfigField(field))
    .map(([key, field]) => ({ key, ...(field as object) })) as SettingsFieldSpec[]

  if (fields.length === 0) return null
  return {
    id: `component:${manifest.id}`,
    scope: 'component',
    componentId: manifest.id,
    title: manifest.title,
    description: manifest.summary,
    fields,
  }
}

/** Every component that exposes a settings panel, in the given order. */
export function componentPanels(manifests: ComponentManifest[]): SettingsPanel[] {
  return manifests
    .map((m) => componentPanel(m))
    .filter((p): p is SettingsPanel => p !== null)
}

/** Kernel panels + component panels — the full settings tree for a manifest set. */
export function composePanels(manifests: ComponentManifest[]): SettingsPanel[] {
  return [...kernelPanels, ...componentPanels(manifests)]
}

// ─── Governance reconciliation (ADR-0010 §6) ──────────────────────────────────

export type SettingsReconciliation = {
  /** Component declares typed config but no `settingsPanel` (orphan config). */
  orphanConfigs: string[]
  /** Component sets `settingsPanel` but declares no typed config (zombie panel). */
  zombiePanels: string[]
  /** Two panels claim the same (scope, component, key) storage slot. */
  duplicateKeys: string[]
}

/**
 * Reconcile the declared settings surface: every typed config field is owned by
 * exactly one panel, and `provides.settingsPanel` agrees with `config`. Pure, so
 * the governance test can assert it with no DB.
 */
export function reconcileSettings(manifests: ComponentManifest[]): SettingsReconciliation {
  const orphanConfigs: string[] = []
  const zombiePanels: string[] = []

  for (const m of manifests) {
    const typedCount = Object.values(m.config ?? {}).filter(isConfigField).length
    const declaresPanel = m.provides?.settingsPanel === true
    if (typedCount > 0 && !declaresPanel) orphanConfigs.push(m.id)
    if (declaresPanel && typedCount === 0) zombiePanels.push(m.id)
  }

  const seen = new Map<string, string>()
  const duplicateKeys: string[] = []
  for (const panel of composePanels(manifests)) {
    for (const field of panel.fields) {
      const slot = settingStorageKey(panel.scope, panel.componentId, field.key)
      const prior = seen.get(slot)
      if (prior) duplicateKeys.push(`${slot} -> ${prior}, ${panel.id}`)
      else seen.set(slot, panel.id)
    }
  }

  return { orphanConfigs, zombiePanels, duplicateKeys }
}
