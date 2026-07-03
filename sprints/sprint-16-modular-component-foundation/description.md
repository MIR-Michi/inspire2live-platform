# Sprint 16 — Modular Component Foundation (Stage 1)

> **Status:** Planning
> **Theme:** Introduce the component model — declare boundaries with zero database change. Stand up `src/modules/` + `src/kernel/`, author a `manifest.ts` per component, enforce import boundaries in CI, and prove the full pattern end-to-end on one low-risk component.
> **Depends on:** ADR-0009 (modular component architecture) and its seed patterns ADR-0008 (unified task domain layer) and ADR-0007 (unified contact identity).

## Goal

Turn the platform's implicit capabilities into **explicit, independent components** at the code layer,
without touching the database. Shipping this sprint produces:

1. **A kernel** — `src/kernel/` holding the cross-cutting concerns every component depends on (identity,
   RBAC, shell/nav, notifications + activity, AI client) and no component owns.
2. **A component per capability** — `src/modules/<component>/` for each capability in §8 of the concept
   (contacts, intake, content, events, initiatives, tasks, onboarding, stories, feedback, ai-features),
   each with a single `index.ts` public API and the ADR-0008 domain-layer shape.
3. **A manifest per component** — `manifest.ts` declaring what each component owns (tables, migrations,
   views), provides (public API, events, mountable UI), depends on (kernel + other components' contracts),
   how it is configured/flagged, whom it serves (personas, roles, `REQ-*`), and which L3 operations it
   exposes.
4. **Enforced boundaries + anti-pollution governance** — the three standing CI checks (§10): import-boundary
   lint (generated from manifests), table-ownership reconciliation (with a seeded quarantine list), and
   reachability + `knip` dead-code — so orphans, zombies, and dead code fail the build.
5. **Per-component traceability** — `docs/TRACEABILITY.md` scoped so every requirement maps to an owning
   component.
6. **One component migrated end-to-end** — the **feedback** component fully converted to the new shape as
   the reference implementation the others copy.

Every change in this sprint is a **move + declare**, not a rewrite. No table is created, altered, or
relocated. The database stays exactly as it is; only the code's structure and its documented boundaries
change. This keeps Stage 1 low-risk and fully reversible.

## Rationale

- The platform's parts are entangled only by convention: `src/lib/` is ~80 flat files (~40 `comms-*`),
  and all ~90 tables share the `public` schema with informal prefixes. Nothing prevents cross-capability
  coupling, and nothing records which files/tables belong to which capability — so nothing is reusable.
- The **midterm goal is a component toolbox** an AI wizard composes into related platforms. Its hard
  prerequisite is clear, independent components with stable contracts, represented identically in the repo
  and DB (ADR-0009). Legibility — not new AI — is what the three future AI levels need first.
- We are generalizing patterns **already proven in this codebase**: `src/lib/tasks/` is already a module
  domain layer (ADR-0008), `comms_crm_contacts` is already a canonical identity spine (ADR-0007), and
  `lib/ai/feature-flag.ts` + `comms_team` already gate optional surfaces. Stage 1 spreads these shapes to
  every capability rather than inventing anything new.
- Doing the code layer first, with **zero DB change**, de-risks the harder Stage 2 (prefix→schema
  relocation). Authoring the manifests also forces latent seams into the open — most likely that the live
  `events` component splits (conferences vs podcast vs campus vs congress guest-attend) — improving the
  model before any migration touches it.
- The decomposition is drawn from the **live nav** (`role-access.ts`), not table prefixes — retired-but-
  not-yet-dropped tables (`hubs`, `resources`, the internal `congress_*` workspace, the internal Stories
  workspace) get no component; they are Stage-2 drop candidates.
- Sequenced immediately after Sprint 15 (legacy cleanup) so the boundaries are drawn over a codebase with
  the retired spaces already removed, not around dead code.

## Technical approach

**No database migrations.** Stage 1 is code-and-docs only. Each manifest *describes* the tables and
migrations a component already owns (`tablePrefix`, `tables`, `migrations`) so ownership is recorded and
lint-checkable while every table stays in `public`. Physical prefix→schema relocation is Stage 2 (later
sprints), lowest-risk components first.

**Kernel extraction.** `src/kernel/` gathers what every component depends on and no component owns:
`identity/` (profiles, auth, the ADR-0007 contact spine + `crm_resolve_contact`), `rbac/` (roles,
permissions, view-as, the `is_comms_team_or_admin()` policy family), `shell/` (nav + layout), 
`notifications/` (`notify`, `activity_log`, `user_activity_events`), `ai-client/` (`lib/ai/client.ts`,
`models.ts`, usage logging), and `ui/` (today's `src/components/ui`). The AI *client* is kernel; AI
*features* stay with the component whose data they enrich.

**Module shape (generalized from `src/lib/tasks/`).** Each `src/modules/<component>/` has: `manifest.ts`;
`index.ts` (the only public import surface — re-exports exactly the manifest's `provides.api` and
`provides.ui`); `domain/` (`types.ts`, `repository.ts`, `actions.ts`, and `status.ts` where relevant);
`ui/`; `api/`; `jobs/`; and a `README.md` mirroring the manifest. The existing flat `lib/comms-*.ts` and
domain-foldered `src/components/*` files move into the module that owns them; imports update to the new
paths. `src/app/*` stays a thin routing layer that delegates into modules.

**Governance — the three standing CI checks (concept §10, anti-pollution).** This is the sustainable fix
for legacy pollution: rather than a one-time reachability audit, three checks assert **exists = owned =
reachable** on every PR, so orphans/zombies/dead code fail the build instead of accreting until the next
Sprint-15-style cleanup.
1. **Import-boundary lint.** A script reads every `manifest.ts` and emits an `eslint-plugin-boundaries`
   config: a module may import `@/kernel/*` and another module's package root `@/modules/<x>` (its
   `index.ts`) but never `@/modules/<x>/domain|ui|api/*`. Converts the boundary from convention into a check.
2. **Table-ownership reconciliation.** Diff live DB tables against the union of every manifest's
   `data.tables`; an unclaimed table fails CI unless it is in `src/kernel/db/quarantine.ts` with an owner,
   reason, and `dropBy`. This is what makes a retired space's tables impossible to leave lingering silently —
   the exact debt Sprint 15 had to chase by hand. The quarantine **starts empty**: Sprint 15's `00152`
   already dropped the residual orphans, so at Stage 1 every remaining table is expected to be
   manifest-claimed, and any unclaimed table the check finds is a genuine new finding.
3. **Reachability + dead-code.** Assert every component with `provides.ui` is mounted in the live nav (or
   marked `public`/`headless`), and add `knip` (not installed today) as a standing dead-code gate — the
   S15-T06 scan, made permanent so it never needs running by hand again.

**Reference component — feedback.** `feedback_items` + `src/lib/feedback.ts` +
`src/components/feedback/*` is small, self-contained, and depends only on the kernel — the ideal first
full conversion. It becomes `src/modules/feedback/` end-to-end (manifest, index, domain, ui, api, README)
and serves as the template PR every other component's move copies. No feedback behavior changes.

**Manifests are descriptive, not a runtime engine.** Nothing in this sprint reads manifests at runtime
except the lint-config generator. The composable shell (reading manifests to mount nav) is Stage 3, not
now.

## Acceptance criteria

- [ ] `src/kernel/` exists with `identity`, `rbac`, `shell`, `notifications`, `ai-client`, `ui`
      sub-areas; cross-cutting helpers moved out of flat `lib`.
- [ ] `src/modules/<component>/` exists for every component in §8 of the concept, each with a
      `manifest.ts`, an `index.ts` public API, and a `README.md`.
- [ ] Every `manifest.ts` records the component's owned tables, migrations, read views, provided API/UI,
      dependencies, feature flag, config, personas, roles, and `REQ-*` — validated by a manifest schema check.
- [ ] **All three governance CI checks (§10) run in CI and can fail the build:** (1) import-boundary lint
      (deliberate violation fails, proven by a fixture); (2) table-ownership reconciliation (an unclaimed,
      un-quarantined table fails); (3) reachability + `knip` dead-code scan.
- [ ] `src/kernel/db/quarantine.ts` exists (starts empty — Sprint 15's `00152` dropped the residual
      orphans); the reconciliation check passes with every live table manifest-claimed.
- [ ] `docs/TRACEABILITY.md` maps every requirement to exactly one owning component; new
      `REQ-ARCH-MODULAR-00{1,2,3}` are recorded.
- [ ] The **feedback** component is fully converted end-to-end and is the documented reference; feedback
      behavior is unchanged (existing tests green).
- [ ] **Zero** database migrations added; `supabase/migrations/` is untouched.
- [ ] Typecheck, lint, unit, and e2e suites pass; no runtime behavior change anywhere.

## Out of scope (later stages)

- **Any DB change** — prefix→schema relocation and published per-component views are Stage 2.
- **Composable shell** — mounting nav/routes from manifests is Stage 3.
- **Catalog + blueprint format** and regenerating I2L from its own blueprint are Stage 4.
- **The three AI levels** (L1 wizard, L2 generator, L3 operator) are Stage 5.

## References

- Concept: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`
- Decision: ADR-0009 (modular component architecture)
- Seed patterns: ADR-0008 (unified task domain layer), ADR-0007 (unified contact identity)
- Conventions: `docs/IMPLEMENTATION_GUIDE.md`, `sprints/README.md`
