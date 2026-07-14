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
  ConfigField,
  ConfigFieldType,
} from '@/kernel/manifest/types'
export { defineManifest, isConfigField } from '@/kernel/manifest/types'
export { validateManifest, assertManifest } from '@/kernel/manifest/validate'
export type { ValidationResult } from '@/kernel/manifest/validate'
