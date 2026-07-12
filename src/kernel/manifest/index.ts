/**
 * kernel/manifest — the public API for the component-manifest contract.
 *
 * Import from `@/kernel/manifest`, never from the files directly.
 */

export type {
  ComponentManifest,
  ComponentSurface,
  ComponentData,
  ComponentProvides,
  ComponentDependsOn,
  ComponentRoles,
} from '@/kernel/manifest/types'
export { defineManifest } from '@/kernel/manifest/types'
export { validateManifest, assertManifest } from '@/kernel/manifest/validate'
export type { ValidationResult } from '@/kernel/manifest/validate'
