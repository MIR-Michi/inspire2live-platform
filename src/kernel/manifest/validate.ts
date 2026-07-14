/**
 * kernel/manifest/validate.ts
 *
 * Dependency-free runtime validator for a ComponentManifest. Kept as plain
 * TypeScript so the kernel adds no schema-library dependency; if the team later
 * adopts a schema lib, this is the single place to swap it.
 *
 * Returns a discriminated result rather than throwing, so callers (the
 * governance CI checks) can collect and report every problem in one pass.
 */

import type { ComponentManifest, ComponentSurface, ConfigFieldType } from '@/kernel/manifest/types'
import { isConfigField } from '@/kernel/manifest/types'

export type ValidationResult =
  | { ok: true; manifest: ComponentManifest }
  | { ok: false; errors: string[] }

const SURFACES: readonly ComponentSurface[] = ['internal', 'public', 'headless']
const CONFIG_FIELD_TYPES: readonly ConfigFieldType[] = [
  'string', 'text', 'boolean', 'enum', 'number', 'cron', 'color', 'url', 'email', 'secret',
]
const ID_RE = /^[a-z][a-z0-9-]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** Validate an unknown value as a ComponentManifest. */
export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = []
  const at = (id: unknown, msg: string) =>
    errors.push(`[${typeof id === 'string' ? id : '?'}] ${msg}`)

  if (!isRecord(input)) {
    return { ok: false, errors: ['manifest must be an object'] }
  }
  const m = input as Record<string, unknown>
  const id = m.id

  // --- identity ---
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) {
    at(id, '`id` must be a kebab-case string (^[a-z][a-z0-9-]*$)')
  }
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    at(id, '`version` must be a semver string (e.g. "1.0.0")')
  }
  if (typeof m.title !== 'string' || m.title.trim() === '') {
    at(id, '`title` must be a non-empty string')
  }
  if (typeof m.summary !== 'string' || m.summary.trim() === '') {
    at(id, '`summary` must be a non-empty string')
  }
  if (typeof m.surface !== 'string' || !SURFACES.includes(m.surface as ComponentSurface)) {
    at(id, `\`surface\` must be one of ${SURFACES.join(' | ')}`)
  }

  // --- data (required) ---
  if (!isRecord(m.data)) {
    at(id, '`data` must be an object')
  } else {
    const d = m.data
    if (typeof d.schema !== 'string' || d.schema.trim() === '') {
      at(id, '`data.schema` must be a non-empty string')
    }
    if (!isStringArray(d.tables)) {
      at(id, '`data.tables` must be an array of strings')
    } else if (new Set(d.tables).size !== d.tables.length) {
      at(id, '`data.tables` contains duplicates')
    }
    if (d.tablePrefix !== undefined && typeof d.tablePrefix !== 'string') {
      at(id, '`data.tablePrefix` must be a string when present')
    }
    if (d.readViews !== undefined && !isStringArray(d.readViews)) {
      at(id, '`data.readViews` must be an array of strings when present')
    }
    if (d.migrations !== undefined && !isStringArray(d.migrations)) {
      at(id, '`data.migrations` must be an array of strings when present')
    }
  }

  // --- provides (optional) ---
  if (m.provides !== undefined) {
    if (!isRecord(m.provides)) {
      at(id, '`provides` must be an object when present')
    } else {
      for (const k of ['api', 'events', 'ui'] as const) {
        if (m.provides[k] !== undefined && !isStringArray(m.provides[k])) {
          at(id, `\`provides.${k}\` must be an array of strings when present`)
        }
      }
      if (m.provides.settingsPanel !== undefined && typeof m.provides.settingsPanel !== 'boolean') {
        at(id, '`provides.settingsPanel` must be a boolean when present')
      }
    }
  }

  // --- dependsOn (optional) ---
  if (m.dependsOn !== undefined) {
    if (!isRecord(m.dependsOn)) {
      at(id, '`dependsOn` must be an object when present')
    } else {
      for (const k of ['kernel', 'components'] as const) {
        if (m.dependsOn[k] !== undefined && !isStringArray(m.dependsOn[k])) {
          at(id, `\`dependsOn.${k}\` must be an array of strings when present`)
        }
      }
    }
  }

  // --- featureFlag (optional; string or null) ---
  if (
    m.featureFlag !== undefined &&
    m.featureFlag !== null &&
    typeof m.featureFlag !== 'string'
  ) {
    at(id, '`featureFlag` must be a string or null when present')
  }

  // --- roles (optional) ---
  if (m.roles !== undefined) {
    if (!isRecord(m.roles)) {
      at(id, '`roles` must be an object when present')
    } else {
      for (const k of ['read', 'write'] as const) {
        if (m.roles[k] !== undefined && !isStringArray(m.roles[k])) {
          at(id, `\`roles.${k}\` must be an array of strings when present`)
        }
      }
    }
  }

  // --- simple optional string arrays ---
  for (const k of ['personas', 'requirements', 'operations'] as const) {
    if (m[k] !== undefined && !isStringArray(m[k])) {
      at(id, `\`${k}\` must be an array of strings when present`)
    }
  }

  // --- config (optional record of typed fields or legacy plain defaults) ---
  let typedFieldCount = 0
  if (m.config !== undefined) {
    if (!isRecord(m.config)) {
      at(id, '`config` must be an object when present')
    } else {
      for (const [key, field] of Object.entries(m.config)) {
        if (!isConfigField(field)) continue // legacy plain-literal default — allowed
        typedFieldCount++
        if (!CONFIG_FIELD_TYPES.includes(field.type)) {
          at(id, `\`config.${key}.type\` must be one of ${CONFIG_FIELD_TYPES.join(' | ')}`)
        }
        if (field.type === 'enum' && !isStringArray(field.options)) {
          at(id, `\`config.${key}\` is an enum and must declare a string \`options\` array`)
        }
        if (field.options !== undefined && !isStringArray(field.options)) {
          at(id, `\`config.${key}.options\` must be an array of strings when present`)
        }
      }
    }
  }

  // --- settingsPanel ↔ typed config consistency (ADR-0010 §6 governance) ---
  const declaresPanel = isRecord(m.provides) && m.provides.settingsPanel === true
  if (declaresPanel && typedFieldCount === 0) {
    at(id, '`provides.settingsPanel` is true but `config` declares no typed fields (zombie panel)')
  }
  if (!declaresPanel && typedFieldCount > 0) {
    at(id, '`config` declares typed fields but `provides.settingsPanel` is not true (orphan config)')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, manifest: input as ComponentManifest }
}

/** Throwing variant for author-time assertions. */
export function assertManifest(input: unknown): ComponentManifest {
  const result = validateManifest(input)
  if (!result.ok) {
    throw new Error(`Invalid component manifest:\n  - ${result.errors.join('\n  - ')}`)
  }
  return result.manifest
}
