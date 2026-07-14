/**
 * modules/settings-registry.ts
 *
 * Binds the kernel settings mechanism to the live component catalog. This is a
 * top-level `src/modules/*` file (not inside a component folder), so — like
 * `modules/registry.ts` — it may import both the kernel and every component's
 * manifest. It is the one place that composes kernel panels with all component
 * panels into the full settings tree.
 */

import { componentManifests } from '@/modules/registry'
import { composePanels } from '@/kernel/settings'
import type { SettingsPanel } from '@/kernel/settings'

/** Kernel panels + every component's config panel — the full settings tree. */
export function allSettingsPanels(): SettingsPanel[] {
  return composePanels(componentManifests)
}

/** Look up one panel by its id (`kernel:<name>` or `component:<id>`). */
export function findSettingsPanel(id: string): SettingsPanel | undefined {
  return allSettingsPanels().find((p) => p.id === id)
}
