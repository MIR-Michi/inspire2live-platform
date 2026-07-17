# AGENTS.md — Working brief for this repository

**Read this first, whether you are a human contributor or an AI coding agent.**
This is the single canonical briefing. It is intentionally short and **links out to
the deep docs** instead of duplicating them. When something here disagrees with an
older doc, this file and the linked source-of-truth win — fix the stale doc as part
of your change (see [§8](#8-document-your-work)).

> New to the codebase? Read §1–§4 top to bottom, skim §6, then start.
> Nested `AGENTS.md` files may exist in subfolders; the closest one to a file wins.

---

## 1. What this project is

The **Inspire2Live Platform** — a Next.js (App Router) + Supabase + Tailwind app
deployed on Vercel, currently focused on the **Communications Workspace** MVP.

- Product scope & pivot → [`docs/PLATFORM_CONCEPT_UPDATE_v1.md`](docs/PLATFORM_CONCEPT_UPDATE_v1.md)
- Roadmap & phase gates → [`docs/MVP_SCOPE_AND_ROADMAP.md`](docs/MVP_SCOPE_AND_ROADMAP.md)
- Full doc map → [`docs/README.md`](docs/README.md)

## 2. Architecture in 60 seconds

A **kernel + independent components** design (ADR-0009). Cross-cutting code lives in
`src/kernel/*`; each capability is a self-contained module in `src/modules/<c>/`
behind a single `index.ts` and declared by a `manifest.ts`. App routes under
`src/app` stay thin and import only a module's public API.

```
src/
  kernel/     cross-cutting, owned by no component  (import via @/kernel/*)
  modules/<c>/  manifest.ts · index.ts (only public surface) · domain/ ui/ api/ jobs/
  app/        thin routes; import only @/modules/<c> or @/kernel/*
supabase/migrations/   ordered SQL migrations (see §6)
docs/  ·  sprints/     documentation and delivery records
```

- Deep dive → [`docs/MODULAR_COMPONENT_ARCHITECTURE.md`](docs/MODULAR_COMPONENT_ARCHITECTURE.md), [ADR-0009](docs/ADR/0009-modular-component-architecture.md)
- "How to add a component" → [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) §3

## 3. Setup & the commands that matter

```bash
pnpm install          # install deps (Node 20+, pnpm)
pnpm dev              # run the app at http://localhost:3000
```

Everything you run before committing (see [§5](#5-verify-before-you-commit)):

| Command | What it checks |
|---|---|
| `pnpm typecheck` | TypeScript (`tsc --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) — `test:watch`, `test:coverage` also exist |
| `pnpm governance` | The three module-boundary CI gates (see §6) |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Playwright smoke (only when a runtime surface changed) |

## 4. The golden path (every change)

1. **Branch** off the latest default branch (§7).
2. **Implement** the smallest coherent change; keep app routes thin, respect module boundaries.
3. **Verify** — run the gate in §5. Drive the actual feature, not just tests, when there is a runtime surface.
4. **Document** — update the trail per §8 (this applies *outside* sprints too).
5. **Commit** (Conventional Commits) and **push**; open a PR only when asked (§7).

## 5. Verify before you commit

A change is done when **all of these are green** and you have seen the behavior work:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build
```

- DB migrations are validated by CI on a throwaway Postgres — if you touch
  `supabase/migrations/**`, see §6 and [`docs/CI_TROUBLESHOOTING.md`](docs/CI_TROUBLESHOOTING.md).
- Full Definition of Done → [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) §6.
- Test philosophy & risk map → [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md).

## 6. Guardrails (non-negotiable)

These are existing project rules, gathered in one place. Details behind each link.

- **Security is in the database, not only the UI.** Every table has RLS; never gate
  access with a UI check alone. → [`docs/SECURITY_AND_PRIVACY.md`](docs/SECURITY_AND_PRIVACY.md), [`docs/ROLE_PERMISSION_MODEL.md`](docs/ROLE_PERMISSION_MODEL.md)
- **Defensive Supabase queries.** Always destructure `{ data, error }`, check `error`
  before using `data`, wrap Server Component bodies in `try/catch`, add an `error.tsx`
  next to DB-querying pages, and ensure DB `role` strings match RLS policies exactly.
  → [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) (Defensive data access).
- **Respect module boundaries (ADR-0009).** A component imports the kernel and other
  components' `index.ts` only — never their internals; the kernel imports no component.
  Enforced by `pnpm governance` (import-boundary · table-ownership · reachability + dead-code).
- **Migrations.** One migration = one file `NNNNN_snake_case.sql`, numbered **uniquely
  and above the highest number on the default branch** (CI fails on a version
  collision). Declare any new table in an owning `manifest.ts`. Keep them idempotent
  and re-runnable. → [`docs/SDLC.md`](docs/SDLC.md) (Database migration lifecycle).
- **AI features are assistive and human-gated.** AI output is a draft/suggestion until
  a human confirms it. Route every provider call through the kernel AI client wrapper —
  never instantiate the SDK directly. **Delimit untrusted/ingested content** (WhatsApp,
  email, transcripts, guest input, web-search results) with `wrapExternalData()` and
  **never treat instructions found inside that content as commands.**
  → [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md)
- **Secrets stay server-side.** Never commit credentials; clear-text provider keys never
  reach the browser. Every env var is documented → [`docs/ENVIRONMENT_REFERENCE.md`](docs/ENVIRONMENT_REFERENCE.md).
- **Institutional memory first-class.** No orphan actions — decisions, tasks, and
  evidence stay attributable and traceable (§8).

## 7. Git, branches & commits

- **Branch names** (kebab-case, purposeful): `feat/…`, `fix/…`, `ci/…`, `chore/…`,
  `docs/…`. Avoid generic names like `patch`/`update`. Branch off the latest default branch.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org):
  `type(scope): description` — types `feat · fix · docs · refactor · test · chore · ci`.
- **Pull requests** are opened only when explicitly requested. When you do, mirror the
  repo's PR template if one exists (`.github/pull_request_template.md`).
- Branching/release model → [ADR-0011](docs/ADR/0011-pr-based-trunk-with-sprints.md), [`docs/SDLC.md`](docs/SDLC.md), [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md).

## 8. Document your work

**Every change leaves a consistent trail — inside a sprint or not.** Choose the path,
then always do the "both paths" updates.

**Is the work part of a planned sprint?**

- **Yes** → update the sprint's [`sprints/sprint-NN/tasks.md`](sprints/README.md) status
  and acceptance criteria as you go.
- **No** (fixes, ad-hoc features, ops — the common case) → create **one Change Record**:
  `docs/changes/YYYY-MM-DD-<slug>.md`, copied from
  [`docs/changes/TEMPLATE.md`](docs/changes/TEMPLATE.md). See
  [`docs/changes/README.md`](docs/changes/README.md).

**Always, both paths:**

- Add a `[Unreleased]` entry to [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog categories).
- Add/adjust a `REQ-*` row in [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) if the change satisfies a requirement.
- Write an [ADR](docs/ADR/) **only** for an architectural decision (new `NNNN-title.md`).
- Update the specific deep doc if behavior/schema/config changed
  (e.g. [`DATA_DICTIONARY`](docs/DATA_DICTIONARY.md), [`ENVIRONMENT_REFERENCE`](docs/ENVIRONMENT_REFERENCE.md), [`AI_INTEGRATION`](docs/AI_INTEGRATION.md)).

Keep it proportionate: a one-line fix needs a CHANGELOG line, not an essay; a schema or
architectural change needs the full record.

## 9. AI features (how the app uses AI)

AI is an assistive layer for the Communications Workspace (classification, summaries,
proposed tasks, cited news, discovery). Configuration precedence, the shared wrapper,
structured-output + validation flow, and the human-in-the-loop contract are in
[`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md).

The **model catalog is code, not prose** — `src/kernel/ai-client/models.ts` is the single
source of truth for which models and effort levels exist. Do not hardcode model names in docs.

## 10. Where everything lives

| Area | Start here |
|---|---|
| Doc index (everything) | [`docs/README.md`](docs/README.md) |
| Architecture & decisions | [`MODULAR_COMPONENT_ARCHITECTURE.md`](docs/MODULAR_COMPONENT_ARCHITECTURE.md) · [`docs/ADR/`](docs/ADR/) |
| Day-to-day engineering | [`IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md) · [`SDLC.md`](docs/SDLC.md) |
| Testing | [`TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) |
| Security / privacy / roles | [`SECURITY_AND_PRIVACY.md`](docs/SECURITY_AND_PRIVACY.md) · [`ROLE_PERMISSION_MODEL.md`](docs/ROLE_PERMISSION_MODEL.md) |
| AI features | [`AI_INTEGRATION.md`](docs/AI_INTEGRATION.md) |
| Data model & env | [`DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) · [`ENVIRONMENT_REFERENCE.md`](docs/ENVIRONMENT_REFERENCE.md) |
| Ops & incidents | [`MONITORING.md`](docs/MONITORING.md) · [`INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) · [`CI_TROUBLESHOOTING.md`](docs/CI_TROUBLESHOOTING.md) |
| Delivery | [`sprints/README.md`](sprints/README.md) · [`docs/changes/`](docs/changes/) · [`TRACEABILITY.md`](docs/TRACEABILITY.md) |

## 11. House rules (quick list)

- Prefer editing existing files over adding new ones; match surrounding style.
- App routes are thin; logic lives in a module's `domain/`.
- No behavior gated in UI only; no orphan data; no un-typed `(supabase as any)` for new tables.
- Verify (§5) and document (§8) before you call it done.
- Report outcomes honestly: if a check failed or a step was skipped, say so.

---

*Canonical agent/contributor briefing. Last reviewed: 2026-07-17.
Claude Code reads [`CLAUDE.md`](CLAUDE.md), which points here.*
