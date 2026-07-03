# Sprint 16 — Tasks

Theme: Modular Component Foundation (Stage 1) — declare boundaries, zero DB change. Status values:
`Not Started` · `In Progress` · `Completed` · `Blocked`.

## Foundation — kernel + module scaffolding

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T01 | Define the `manifest.ts` type + a runtime schema validator (Zod) matching §4 of the concept (`data`, `provides`, `dependsOn`, `featureFlag`, `config`, `personas`, `roles`, `requirements`, `operations`) | Opus 4.8 | Completed | `src/kernel/manifest/{types,validate,index}.ts`. Dependency-free validator (repo has no zod; adding one is out of scope for a lean codebase) returning a discriminated `{ok, errors}` result; `defineManifest()` authoring helper. 13 unit tests (`manifest-validate.test.ts`) |
| S16-T02 | Stand up `src/kernel/` — move identity, rbac, shell, notifications, ai-client, ui out of flat `lib`/`components` into kernel sub-areas; update imports | Opus 4.8 | Completed | `src/kernel/` with `identity`, `rbac`, `notifications`, `ai-client`, `data`, `shell`, `ui`, `db`, `governance`, `manifest` + barrels + README. 13 cross-cutting libs `git mv`-d in with thin re-export **shims** at old `@/lib/*` paths (keeps 121 importers green; consumers migrate in T05+). AI *client* only; AI *features* stay in `ai-features`. `tsc` + build green |
| S16-T04 | Add `src/modules/` with a scaffold per component (folder, `index.ts`, `README.md`, `manifest.ts`) for all §8 components | Opus 4.8 | Completed | 10 components (contacts, intake, content, events, initiatives, tasks, onboarding, stories, feedback, ai-features), each with a **populated** manifest (real `data.tables`) + `src/modules/registry.ts`. Not empty stubs — the real table lists make the reconciliation check meaningful immediately |

## Governance — the three standing CI checks (§10, anti-pollution)

These are the sustainable fix for legacy pollution: they assert **exists = owned = reachable** on every
PR, so orphans/zombies/dead code fail the build instead of accreting until the next cleanup sprint. Each
is a *standing gate*, not a one-time audit.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T03a | **Check 1 — import-boundary.** Pure `classifyImport`/`findBoundaryViolations` (`src/kernel/governance/boundaries.ts`) + fs scan; a module may import kernel + another module's root `index`, never its internals, and the kernel may never import a component | Opus 4.8 | Completed | `governance-boundaries.test.ts`: zero violations in the live tree + fixtures asserting a deep import and a kernel→component import are flagged. Implemented as a dependency-free check (no `eslint-plugin-boundaries` install); can swap to the plugin later |
| S16-T03b | **Check 2 — table-ownership reconciliation.** `src/kernel/db/live-tables.ts` parses the migration history (CREATE − DROP; no live DB needed) → union of manifests' `data.tables` + `KERNEL_TABLES` + `PENDING_OWNERSHIP` + `QUARANTINE`; unclaimed / phantom / double-owned tables fail | Opus 4.8 | Completed | `governance-table-ownership.test.ts` (6 assertions). Reconciled all 76 live tables (63 component + 11 kernel + 2 pending `partner_*`); quarantine **empty** as intended. The check caught `hubs`/`resources` unassigned during authoring — proving it works — now owned by events/initiatives |
| S16-T03c | **Check 3 — reachability.** Assert UI-providing components aren't `headless`, headless ships no UI, non-headless declares UI, and every `public` component has a route on disk | Opus 4.8 | Completed | `governance-reachability.test.ts`. Full nav-mount-from-manifest verification is deferred to Stage 3 (shell composition), as noted in the test |
| S16-T03d | **Dead-code scan.** Standing version of S15-T06: every `src/lib`/`src/components` file must be imported somewhere in `src`; zero-reference files fail | Opus 4.8 | Completed | `governance-dead-code.test.ts` — dependency-free stand-in for `knip` (not installed); green over the current tree. Wired via `pnpm governance` + a named CI step in `ci.yml` |

## Reference component (end-to-end template)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T05 | Convert **feedback** end-to-end: `feedback_items` + `lib/feedback.ts` + `components/feedback/*` → `src/modules/feedback/` (manifest, index, domain, ui, api, README); update app routes to import via `index.ts` | Opus 4.8 | Completed | `lib/feedback.ts`→`domain/types.ts`; 5 components→`ui/`; extracted `domain/repository.ts` (reads) + `domain/actions.ts` (`'use server'` writes) + `api/export.ts` (export handler). `index.ts` is the public API; the 3 app routes (layout, admin page, export route) now import only `@/modules/feedback`; old `app/**/feedback/actions.ts` deleted. Pure move — `tsc`/lint/393 tests/governance/build all green; feedback routes build as dynamic |

## Component manifests + moves (one PR each, mechanical)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T06 | ~~**stories** — move the public patient-stories site into `src/modules/stories/`~~ **→ RETIRED instead** | Opus 4.8 | Completed | Product decision: the patient-stories feature is not needed. Deleted the `/stories` routes + module + registry entry; forward migration `00153` drops `patient_stories`/`patient_story_events`/`story_status_changes` + 4 trigger functions (validated on Postgres 16); seed rows removed. Follow-up (separate): the dead `'stories'` RBAC PlatformSpace vocabulary + 00022/00023 permission rows |
| S16-T07 | **onboarding** — move `member-onboarding*` into `src/modules/onboarding/` | Opus 4.8 | Completed | 1 domain + 1 ui, moved via git-mv + re-export shim at old path (build stays green; consumers migrate off shims later) |
| S16-T08 | **tasks** — relocate existing `src/lib/tasks/*` into `src/modules/tasks/domain/` | Opus 4.8 | Completed | 7 domain (incl. `lib/tasks/*` ADR-0008 layer + `comms-tasks`/`comms-status`) + 5 ui. `unified_tasks` declared as the read view in the manifest |
| S16-T09 | **contacts** — move `comms-crm*` + CRM UI into `src/modules/contacts/` | Opus 4.8 | Completed | 3 domain + 5 ui. Campus/identity remain via the shared spine (ADR-0007) referenced through the kernel |
| S16-T10 | **intake** — move `comms-webhook*`, `comms-classifier`, `whatsapp-*` into `src/modules/intake/` | Opus 4.8 | Completed | 8 domain + 6 ui |
| S16-T11 | **content** — move `comms-media`, `comms-integrations`, `comms-digest`, calendar into `src/modules/content/` | Opus 4.8 | Completed | 4 domain + 4 ui |
| S16-T12 | **events** — move `comms-conferences/events`, `campus-*`, agenda, transcripts, congress **guest-attend** into `src/modules/events/` | Opus 4.8 | Completed | 11 domain + 25 ui (incl. the `conferences/` subtree). Confirmed the internal-split hunch — events is by far the largest module; a follow-up ADR should split it (conferences / podcast / campus / guest-attend) |
| S16-T13 | **initiatives** — move `initiative-*` into `src/modules/initiatives/` | Opus 4.8 | Completed | 2 domain + 2 ui |
| S16-T14 | **ai-features** — move `lib/ai/*` feature code into `src/modules/ai-features/`; keep the AI *client* in kernel | Opus 4.8 | Completed | 15 domain + 3 ui. AI client/models/crypto/feature-flag stayed in kernel; the moved feature files' relative `./client`/`./models` imports were repointed to `@/kernel/ai-client/*` (and the matching test mock updated) |

> **T07–T14 approach + residual shared set.** Migrated by `git mv` + a re-export shim at each old `@/lib/*` / `@/components/comms/*` path (all named exports, no relative sibling coupling → zero importer rewrites, build stays green). Genuinely cross-cutting comms files were **not** force-assigned to one module and remain in `src/lib` / `src/components/comms` for now: the dashboard aggregators (`comms-dashboard-data`, `comms-personal-dashboard-data`, `team-dashboard`, `team-feed`, `comms-dashboard-toggle`), shared comms infra (`comms-access`, `comms-constants`, `comms-workflow`), and generic UI (`nav-select`, `optional-field`, `role-badge`). These belong to a future "comms shell" and are a documented follow-up. Public-API curation of each module's `index.ts` (as done for feedback in T05) also follows as consumers move off the shims.

## Traceability + docs

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T15 | Scope `docs/TRACEABILITY.md` per component — every `REQ-*` maps to one owning component; add `REQ-ARCH-MODULAR-00{1,2,3}` | Opus 4.8 | Completed | Added a "Component Ownership" section: component→requirements table (derived from each manifest's `requirements`) + kernel note + the 3 architecture REQs marked `done` |
| S16-T16 | Update `docs/IMPLEMENTATION_GUIDE.md` + `sprints/README.md` references to point at the module structure; add a "how to add a component" short guide | Opus 4.8 | Completed | Guide §3: added constraint #7 (module boundaries), a "Modular Component Architecture" subsection (kernel+modules tree, governance gates) and a 5-step "How to add a component" using `feedback` as the worked example. `sprints/README.md`: added a "Code structure" section + modular-architecture references |

## Verification

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T17 | Full gate — typecheck, lint, all three governance checks, unit+coverage, e2e all green; assert no runtime behavior differs from the modular moves | Opus 4.8 | Completed | **All green:** `tsc` clean · lint clean (1 pre-existing warning) · governance 29/29 · 393 unit + coverage gate (functions 61.25% / lines 60.76% ≥ 60 — coverage `include` updated to track `src/modules/**/domain` + `src/kernel` where the logic moved) · build green · e2e 6 passed / 2 skipped (auth-required; run via a temp browser-path override — sandbox pins a different Playwright build). **Migrations note:** the modular refactor (T01–T14) added **zero** migrations; the branch's `00153`/`00154` are the separately-authorized *stories retirement* + *RBAC-space cleanup*, not modular changes — those intentionally change behavior, the moves do not |
