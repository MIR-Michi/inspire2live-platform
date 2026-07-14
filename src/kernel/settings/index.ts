/**
 * kernel/settings — the Platform Settings mechanism (ADR-0010): the store's
 * types, the kernel panels, the panel-derivation + reconciliation, the resolver,
 * and the write primitive. It never imports a component — the component catalog
 * is bound in `src/modules/settings-registry.ts`.
 *
 * Import from `@/kernel/settings`, never the files directly.
 */

export type {
  SettingsPanel,
  SettingsFieldSpec,
  SettingsScope,
  ResolvedField,
} from '@/kernel/settings/types'
export { settingStorageKey } from '@/kernel/settings/types'

export { kernelPanels, organizationPanel } from '@/kernel/settings/kernel-panels'
export {
  composePanels,
  componentPanel,
  componentPanels,
  reconcileSettings,
} from '@/kernel/settings/registry'
export type { SettingsReconciliation } from '@/kernel/settings/registry'
export { resolvePanel, resolveSetting } from '@/kernel/settings/resolver'
export { persistPanelValues } from '@/kernel/settings/persist'
export type { PersistResult } from '@/kernel/settings/persist'
