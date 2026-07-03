# Sprint 16 — Tasks

Theme: Modular Component Foundation (Stage 1) — declare boundaries, zero DB change. Status values:
`Not Started` · `In Progress` · `Completed` · `Blocked`.

## Foundation — kernel + module scaffolding

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T01 | Define the `manifest.ts` type + a runtime schema validator (Zod) matching §4 of the concept (`data`, `provides`, `dependsOn`, `featureFlag`, `config`, `personas`, `roles`, `requirements`, `operations`) | TBD | Not Started | Type lives in `src/kernel/manifest/`; validator is reused by all three governance checks below |
| S16-T02 | Stand up `src/kernel/` — move identity, rbac, shell, notifications, ai-client, ui out of flat `lib`/`components` into kernel sub-areas; update imports | TBD | Not Started | AI *client* only (`ai/client.ts`, `models.ts`, usage log); AI *features* stay in `ai-features` module |
| S16-T04 | Add `src/modules/` with an empty scaffold per component (folder, `index.ts`, `README.md`, placeholder `manifest.ts`) for all §8 components | TBD | Not Started | Scaffold only; file moves happen per-component below |

## Governance — the three standing CI checks (§10, anti-pollution)

These are the sustainable fix for legacy pollution: they assert **exists = owned = reachable** on every
PR, so orphans/zombies/dead code fail the build instead of accreting until the next cleanup sprint. Each
is a *standing gate*, not a one-time audit.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S16-T03a | **Check 1 — import-boundary lint.** Generator reads all `manifest.ts`, emits `eslint-plugin-boundaries` config (kernel + module-root `index.ts` imports allowed; deep `@/modules/x/domain/**` forbidden); wire into CI | TBD | Not Started | Include a fixture that deliberately violates a boundary and asserts CI fails |
| S16-T03b | **Check 2 — table-ownership reconciliation.** Diff live DB tables (`information_schema.tables`) against the union of every manifest's `data.tables`; an unclaimed table fails CI unless it is in `src/kernel/db/quarantine.ts` with `{ owner, reason, dropBy }`. The quarantine **starts empty** — Sprint 15 (00152) already dropped the residual orphans, so at Stage 1 every remaining table is expected to be manifest-claimed. Any table the check finds unclaimed is a real finding to own or drop | TBD | Not Started | This is the check that makes retired-space tables impossible to leave lingering silently; replaces the old one-time reachability audit |
| S16-T03c | **Check 3 — reachability.** Assert every component whose manifest declares `provides.ui` is mounted in the live nav (`role-access.ts`) or marked `surface: 'public' \| 'headless'`; an unreachable component (zombie) fails CI. Also validates the §8 cut once during the move | TBD | Not Started | Promotes the Sprint-16 reachability idea from a manual pre-move audit to a permanent gate |
| S16-T03d | **Dead-code scan.** Add `knip` (no dead-code tool is installed today); wire `pnpm knip` into CI as a standing gate — the S15-T06 scan that had to be run by hand | TBD | Not Started | Configure entrypoints (Next.js `app/`, cron routes, scripts) so route/handler files aren't false-flagged |

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
