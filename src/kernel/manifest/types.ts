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
  /** Composition config the generator can set (shape is component-specific). */
  config?: Record<string, unknown>
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
