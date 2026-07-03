# ADR-0009: Modular Component Architecture (manifest-described components, kernel + composition)

- **Status:** proposed
- **Date:** 2026-07-03
- **Owners:** Michael Wittinger

## Context

The platform is a single hardwired Next.js + Supabase application. Its capabilities are entangled at
every layer:

- **Application:** `src/lib/` is ~80 flat files (~40 `comms-*`); the only thing stopping the CRM from
  reaching into intake internals is naming convention.
- **Database:** all ~90 tables live in the single `public` schema. Ownership is expressed only by
  informal, inconsistent prefixes (`comms_crm_*`, `intake_*`, `conference_*` vs `congress_*` vs
  `campus_*`, `comms_crm` vs `crm`).
- **Delivery:** sprints sequence features, but nothing records which tables/files belong to which
  capability, so nothing is extractable or reusable.

The stated midterm goal is a **component toolbox**: a library of self-contained capabilities from which
an AI wizard can generate *related* platforms by collecting requirements and composing components. That
future has one hard prerequisite — **clear, independent components with stable contracts, represented
identically in the repo and in the database.** The three planned AI levels (L1 collect requirements,
L2 build platform, L3 operate platform) all need the platform to be *legible* as discrete capabilities.

We already have the seed pattern. **ADR-0008** (unified task domain layer) established: a
`security_invoker` view as a read contract, a TypeScript domain layer as the single behavior source,
thin adapters over focused per-context tables, and "contract by convention first, physical migration only
if it ever pays." **ADR-0007** established a canonical identity spine. This ADR generalizes those two
successes into the shape of *every* component and defines a staged, reversible transition.

- Related requirements: `REQ-ARCH-MODULAR-001` (independent components represented in repo + DB),
  `REQ-ARCH-MODULAR-002` (machine-readable component catalog enabling composition),
  `REQ-ARCH-MODULAR-003` (per-component feature-flag mountability).
- Full concept: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`.

## Decision

Adopt a **manifest-described component model** in which each capability is represented identically in
three places — a **code module** (`src/modules/<component>/`), a **data domain** (one Postgres schema,
today one table prefix), and a **declarative `manifest.ts`** that bridges the two — with a thin
**platform kernel** every component depends on and no component owns.

1. **Component = code module + data domain + manifest.** One folder per component under `src/modules/`,
   shaped like the existing `src/lib/tasks/` domain layer: `domain/` (types, repository, actions),
   `ui/`, `api/`, `jobs/`, `db/`, and a single `index.ts` public API. One Postgres schema per component
   owns its tables, RLS, and published read views.

2. **The manifest is the single bridging artifact.** `manifest.ts` declares, in structured data, what a
   component owns (tables, migrations, views), provides (public API, events, mountable UI), depends on
   (kernel + other components' contracts), how it is configured and flagged, whom it serves (personas,
   roles, `REQ-*`), and which L3 operations it exposes. The same manifests are read by humans now and by
   all three AI levels later — they are simultaneously documentation, the input to an import-boundary
   linter, the AI catalog, and the composition unit.

3. **A thin kernel holds cross-cutting concerns** — identity (the ADR-0007 spine), RBAC, shell/nav,
   notifications + activity, and the AI *client*. The AI client is kernel; AI *features* belong to the
   component whose data they enrich. The kernel is always included; components are selected.

4. **Boundaries are enforced, not hoped for.** (a) Import only through `index.ts`, checked by an ESLint
   boundary rule generated from the manifests. (b) Cross-component reads only through `security_invoker`
   views (per ADR-0008). (c) Cross-component writes only through the owner's domain actions (the ADR-0008
   adapter rule). (d) No cross-component FKs except into the kernel identity spine. (e) Every component is
   feature-flaggable, and *absence* is a clean, working state — generalizing today's `comms_team` flag
   and `lib/ai/feature-flag.ts`.

5. **Governance makes the boundaries self-enforcing against legacy pollution.** Legacy pollution
   (Sprint 15's orphaned tables, dead files, unreachable spaces) is a **reconciliation gap** between three
   sets that should be identical: what *exists* (physical tables/files), what is *owned* (claimed by a
   manifest), and what is *reachable* (mounted in the live nav). Three **standing CI checks** keep them
   reconciled on every PR: (a) **table-ownership reconciliation** — every physical table is claimed by a
   manifest or listed in an explicit `db/quarantine.ts` with an owner and `dropBy` date, so a retired
   space's tables can never linger silently; (b) **reachability** — every component with UI is mounted in
   nav or declared public/headless; (c) **dead-code scan** (`knip`). The quarantine list turns Sprint 15's
   prose "kept for reason X" into structured, re-reviewed data. This is the *same* invariant that
   guarantees the L2 generator emits clean platforms (an orphan table cannot exist if CI requires an
   owner), so anti-pollution and composability are one mechanism.

6. **Transition is staged and reversible (Stage 0 → 5).** Stage 1 declares boundaries with **zero DB
   change** (manifests + module moves + kernel + the three governance CI checks). Stage 2 relocates tables
   prefix→schema one component at a time, lowest-risk first, and turns on table-ownership reconciliation.
   Stages 3–5 add the composable shell, a blueprint/catalog format (proven by regenerating I2L from its own
   blueprint), and finally the three AI levels. No stage past 4 begins until the current platform has been
   regenerated from a blueprint.

## Alternatives considered

1. **Microservices / per-component databases and deploys.** Physically distribute each component. Rejected:
   adds operational cost (network, transactions, deploy orchestration) with no benefit at current scale,
   and works against a single Supabase project. Modularity within one app + one database gives the
   independence we need for the toolbox without the distribution tax — the same risk/reward logic ADR-0008
   used to reject the god-table.

2. **Big-bang schema split.** Move all ~90 tables into per-component schemas in one migration set.
   Rejected: high-risk, drags every RLS policy and every generated type through one change, with a long
   unmergeable window. The prefix→schema-per-component incremental path is reversible and shippable.

3. **Keep flat, document harder.** Add a doc mapping files/tables to capabilities but change no structure.
   Rejected: documentation drifts from unenforced boundaries within a sprint; the AI levels need a
   *checkable* structure and a machine-readable catalog, which a wiki page cannot provide.

4. **Manifest-described components + kernel + staged transition (chosen).** Delivers real, enforced
   boundaries and a machine-readable catalog while reusing patterns already proven in the codebase
   (ADR-0007, ADR-0008), with each stage independently valuable and reversible.

## Consequences

### Positive

- One capability is reasoned about once, in one place, across repo + DB + manifest.
- Boundaries become CI-checkable (import lint) instead of convention.
- Legacy pollution becomes a build failure, not a recurring cleanup sprint: the three governance checks
  keep *exists = owned = reachable* reconciled continuously, so orphans/zombies/dangling refs surface the
  moment they appear instead of accreting until the next Sprint-15-style audit.
- The manifest catalog is exactly the input the L1 wizard, L2 generator, and L3 operator need — the AI
  transition sits on legibility we build incrementally, not a rewrite.
- Fully staged and reversible; Stage 1 touches no database. The current platform keeps working throughout.
- Writing manifests forces latent seams into the open (e.g. the live `events` component likely splits into
  conferences vs podcast vs campus vs congress guest-attend), improving the model as a side effect. The
  decomposition is derived from the **live nav** (`role-access.ts`), not table prefixes — several prefixed
  table groups (`hubs`, `resources`, the internal `congress_*` workspace, the internal Stories workspace)
  were retired by Sprint 15 and get **no** owning component; they are Stage-2 drop candidates.

### Negative / trade-offs

- Up-front discipline: every capability must be assigned an owner, and file/table moves touch many imports.
- The manifest is a second place that must stay in sync with the code it describes; the import-boundary
  linter mitigates drift by deriving from it.
- Prefix→schema relocation is real migration work with RLS and generated-types churn, done component by
  component over several sprints.
- Boundaries are enforced by lint + convention + views, not (yet) by physical separation — same posture
  ADR-0008 accepted for tasks.

### When physical separation would become right

If a component ever needs an independent deploy cadence, an independent scaling profile, or genuine data
isolation (e.g. a tenant boundary), promote it out of the shared app/database then — not before. The
component/manifest structure is exactly what makes that later extraction tractable.

## Rollout / Migration plan

**Stage 1 (next sprint — `sprint-16-modular-component-foundation`, no DB change):**
1. Add `src/modules/` and `src/kernel/`; extract the kernel (identity, rbac, shell, notifications,
   ai-client).
2. Author `manifest.ts` for each component in §8 of the concept; move owning `lib`/`components` files in.
3. Add the three governance CI checks (§10): import-boundary lint (from manifests), reachability, and the
   `knip` dead-code scan; seed `db/quarantine.ts` with the residual orphans Sprint 15 surfaced.
4. Scope requirement traceability per component in `docs/TRACEABILITY.md`.
5. Pilot the full pattern on one low-risk component end-to-end (proposed: **feedback**).

**Stage 2+ (later sprints):** relocate tables prefix→schema one component at a time (feedback, stories
first; contacts, events last); publish per-component read views; then composable shell, catalog/blueprint,
and the AI levels — each gated on the previous stage being real.

## References

- Concept: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`
- Seed patterns: ADR-0008 (unified task domain layer), ADR-0007 (unified contact identity)
- Related: ADR-0006 (Communications Workspace), `lib/ai/feature-flag.ts`, `lib/tasks/*`
- Delivery: `sprints/sprint-16-modular-component-foundation/`
