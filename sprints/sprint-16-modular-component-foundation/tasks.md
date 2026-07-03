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
| S16-T05 | Convert **feedback** end-to-end: `feedback_items` + `lib/feedback.ts` + `components/feedback/*` → `src/modules/feedback/` (manifest, index, domain, ui, api, README); update app routes to import via `index.ts` | TBD | Not Started | Reference PR the other moves copy; existing feedback tests must stay green; no behavior change |

## Component manifests + moves (one PR each, mechanical)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T06 | **stories** — manifest + move the **public** patient-stories site (`/stories`, `lib/patient-stories.ts`, `patient_stories*`) into `src/modules/stories/` | TBD | Not Started | Public site only — the internal editorial Stories workspace was deleted in Sprint 15; do not resurrect it. Low-risk, kernel-only deps |
| S16-T07 | **onboarding** — manifest + move `member-onboarding*` into `src/modules/onboarding/` | TBD | Not Started | Depends on contacts (CRM sync) + tasks (onboarding tasks) contracts |
| S16-T08 | **tasks** — manifest + relocate existing `src/lib/tasks/*` into `src/modules/tasks/domain/`; document `unified_tasks` as its read view | TBD | Not Started | Already modular (ADR-0008); mostly a move + manifest |
| S16-T09 | **contacts** — manifest + move `comms-crm*`, `campus_members`, contact-identity into `src/modules/contacts/`; publish the identity spine as its contract | TBD | Not Started | Holds the ADR-0007 spine; kernel identity references it — settle that seam here |
| S16-T10 | **intake** — manifest + move `comms-webhook*`, `comms-classifier`, `whatsapp-*`, `intake_*` into `src/modules/intake/` | TBD | Not Started | Depends on contacts (resolve senders) + ai-client |
| S16-T11 | **content** — manifest + move `comms-media`, `comms-integrations`, `comms-digest`, calendar into `src/modules/content/` | TBD | Not Started | — |
| S16-T12 | **events** — manifest + move `comms-conferences/events`, `campus-*`, congress **guest-attend** into `src/modules/events/`; **flag internal splits** (conferences vs podcast vs campus vs guest-attend) | TBD | Not Started | Live surfaces only — the retired internal Annual Congress *workspace* tables are **not** owned here (Stage-2 drop). Expect a split; record as a follow-up ADR if so |
| S16-T13 | **initiatives** — manifest + move `initiative-*` into `src/modules/initiatives/` | TBD | Not Started | — |
| S16-T14 | **ai-features** — manifest + move `lib/ai/*` feature code (org feed, meeting summary, newsfeed jobs) into `src/modules/ai-features/`; keep the AI *client* in kernel | TBD | Not Started | Depends on kernel ai-client + intake/events/contacts contracts |

## Traceability + docs

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T15 | Scope `docs/TRACEABILITY.md` per component — every `REQ-*` maps to one owning component; add `REQ-ARCH-MODULAR-00{1,2,3}` | TBD | Not Started | Cross-check against each manifest's `requirements` field |
| S16-T16 | Update `docs/IMPLEMENTATION_GUIDE.md` + `sprints/README.md` references to point at the module structure; add a "how to add a component" short guide | TBD | Not Started | Uses feedback (S16-T05) as the worked example |

## Verification

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T17 | Full gate — typecheck, lint, all three governance checks (import-boundary, table-ownership reconciliation, reachability + `knip`), unit, e2e all green; assert `supabase/migrations/` is unchanged and no runtime behavior differs | TBD | Not Started | Stage 1 exit criterion; behavior parity is the whole point |
