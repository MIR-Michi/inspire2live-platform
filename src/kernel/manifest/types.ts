/**
 * kernel/manifest/types.ts
 *
 * The declarative contract every component publishes (see
 * docs/MODULAR_COMPONENT_ARCHITECTURE.md §4 and ADR-0009). A manifest is the
 * single bridging artifact: it is read by humans today and, later, by the three
 * AI levels (collect requirements / build platform / operate platform). It is
 * *descriptive data* about things that already exist in the codebase — not a
 * runtime engine.
 *
 * The shape here is intentionally plain TypeScript (no schema library) so the
 * kernel takes on no new dependency; `validate.ts` provides the runtime check.
 */

/** How a component's UI is reached, used by the reachability governance check. */
export type ComponentSurface =
  /** Mounted inside the authenticated app nav (`role-access.ts`). */
  | 'internal'
  /** A public, unauthenticated route (e.g. the patient-stories site). */
  | 'public'
  /** No UI of its own — jobs / API / data only. */
  | 'headless'

/** What a component owns in the database (its data domain). */
export type ComponentData = {
  /** Target-state Postgres schema (Stage 2). Today everything is in `public`. */
  schema: string
  /** Today's namespacing inside `public` (informational). */
  tablePrefix?: string
  /** Tables this component owns. The table-ownership check reconciles against this. */
  tables: string[]
  /** `security_invoker` read views this component publishes as its read contract. */
  readViews?: string[]
  /** Migration numbers that created/altered this component's tables (traceability). */
  migrations?: string[]
}

/** The only things other components/kernel may consume — the public contract. */
export type ComponentProvides = {
  /** Named exports re-exported from the component's `index.ts`. */
  api?: string[]
  /** Domain events other components may react to (e.g. `intake.item.promoted`). */
  events?: string[]
  /** Mountable UI surfaces (component names). */
  ui?: string[]
  /**
   * True when this component exposes an editable settings panel in the Platform
   * Settings space (ADR-0010). It is rendered from `config`'s typed fields — no
   * bespoke form code. The settings governance check asserts this stays in sync
   * with `config`: a component that declares typed `config` fields must set this,
   * and vice-versa (no zombie panel, no orphan config).
   */
  settingsPanel?: boolean
}

// ─── Typed config vocabulary (ADR-0010) ──────────────────────────────────────
//
// `config` fields describe a component's operator-tunable settings. A field is
// either a typed `ConfigField` descriptor (rendered as a control in the settings
// shell and reconciled by governance) or, for backwards compatibility, a plain
// literal default. New settings should always use `ConfigField`.

/** The renderable field types the settings shell knows how to draw. */
export type ConfigFieldType =
  | 'string'
  | 'text'
  | 'boolean'
  | 'enum'
  | 'number'
  | 'cron'
  | 'color'
  | 'url'
  | 'email'
  /** A credential: never persisted in `platform_settings` as plaintext (§6). */
  | 'secret'

/** A single typed, self-rendering config field. */
export type ConfigField = {
  type: ConfigFieldType
  /** Human label shown above the control (defaults to a humanised key). */
  label?: string
  /** Optional helper text under the control. */
  description?: string
  /** Default value — the first link in the resolver chain (default → DB → env). */
  default?: unknown
  /** Allowed values for `type: 'enum'`. */
  options?: readonly string[]
  /** Lower bound for `type: 'number'`. Enforced in the renderer and persistence layer. */
  min?: number
  /** Upper bound for `type: 'number'`. Enforced in the renderer and persistence layer. */
  max?: number
  /** Input increment for `type: 'number'` (for example 1 for whole numbers). */
  step?: number
  /** For `type: 'secret'`: the env var / secret reference the value resolves from. */
  secretRef?: string
}

/** True for a typed `ConfigField` (vs a legacy plain-literal default). */
export function isConfigField(v: unknown): v is ConfigField {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { type?: unknown }).type === 'string'
  )
}

/** What a component is allowed to depend on. */
export type ComponentDependsOn = {
  /** Kernel areas (`identity`, `rbac`, `notifications`, `ai-client`, `shell`, `ui`). */
  kernel?: string[]
  /** Other components' contracts, e.g. `contacts@^1` — never their internals. */
  components?: string[]
}

/** Role gate for the component (maps onto the existing RBAC vocabulary). */
export type ComponentRoles = {
  read?: string[]
  write?: string[]
}

/** The declarative component contract. */
export type ComponentManifest = {
  /** Stable machine id, kebab-case (matches the `src/modules/<id>/` folder). */
  id: string
  /** Semver of the contract. */
  version: string
  /** Human title. */
  title: string
  /** One-sentence description — the L1 wizard reads this. */
  summary: string
  /** How the component's UI is reached (drives the reachability check). */
  surface: ComponentSurface
  /** The component's data domain. */
  data: ComponentData
  /** The public contract. */
  provides?: ComponentProvides
  /** Declared dependencies. */
  dependsOn?: ComponentDependsOn
  /** Feature flag that mounts/unmounts the component; `null` = always on. */
  featureFlag?: string | null
  /**
   * Composition config the generator can set and the Platform Settings space
   * renders (ADR-0010). Values are typed `ConfigField` descriptors (preferred)
   * or legacy plain-literal defaults. Keyed by a stable config key.
   */
  config?: Record<string, ConfigField | unknown>
  /** Personas served (traceability). */
  personas?: string[]
  /** Role gate. */
  roles?: ComponentRoles
  /** `REQ-*` identifiers this component satisfies. */
  requirements?: string[]
  /** Operations/agents the L3 (operate) AI may invoke. */
  operations?: string[]
}

/**
 * Identity helper for authoring a manifest with full type-checking and literal
 * inference. Prefer `defineManifest({ ... })` in each `src/modules/<id>/manifest.ts`.
 */
export function defineManifest<const T extends ComponentManifest>(manifest: T): T {
  return manifest
}
