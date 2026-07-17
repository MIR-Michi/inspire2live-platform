# Software Development Lifecycle — Inspire2Live Platform

> **How to view this document:** Open it in VS Code and press `Ctrl+Shift+V` to see all Mermaid diagrams rendered.
> On GitHub the diagrams render automatically in the browser.
>
> For the short, everyday brief (commands, guardrails, workflow, how to document work),
> see [`../AGENTS.md`](../AGENTS.md). This document is the deeper lifecycle reference it
> points into; where the two overlap, AGENTS.md and the code are the source of truth.

---

## Overview

This document describes the Software Development Lifecycle (SDLC) as implemented in the
Inspire2Live Platform. The process is a **PR-based, sprint-cadenced, continuously-deployed**
model: work happens on short-lived branches, merges to `main` through pull requests that
must pass automated gates, and deploys to Vercel + Supabase on every green `main` merge.

The codebase is organised as a **kernel + independent components** (ADR-0009); the workflow
below applies uniformly across all of them. The direct-to-`main` "pure trunk-based" model
described in ADR-0005 has been **superseded by [ADR-0011](ADR/0011-pr-based-trunk-with-sprints.md)**.

---

## 1 · High-Level Lifecycle

The lifecycle is a continuous loop of six phases. Every line of production code can be
traced from a requirement through design, implementation, verification, deployment, and back
to planning.

```mermaid
flowchart LR
    A(["🎯 Plan"]):::phaseA --> B(["🏗️ Design"]):::phaseB
    B --> C(["💻 Develop"]):::phaseC
    C --> D(["✅ Verify"]):::phaseD
    D --> E(["🚀 Deploy"]):::phaseE
    E --> F(["📊 Monitor"]):::phaseF
    F -->|"next iteration"| A

    classDef phaseA  fill:#4f46e5,stroke:#3730a3,color:#fff,rx:20
    classDef phaseB  fill:#7c3aed,stroke:#6d28d9,color:#fff,rx:20
    classDef phaseC  fill:#2563eb,stroke:#1d4ed8,color:#fff,rx:20
    classDef phaseD  fill:#059669,stroke:#047857,color:#fff,rx:20
    classDef phaseE  fill:#d97706,stroke:#b45309,color:#fff,rx:20
    classDef phaseF  fill:#dc2626,stroke:#b91c1c,color:#fff,rx:20
```

| Phase | Owner | Key Artefacts |
|-------|-------|---------------|
| 🎯 Plan | PM / Stakeholder | `sprints/`, `MVP_SCOPE_AND_ROADMAP.md`, `PLATFORM_CONCEPT_UPDATE_v1.md` |
| 🏗️ Design | Architect | ADR, `TRACEABILITY.md`, component `manifest.ts`, migration spec |
| 💻 Develop | Contributor + AI assistant | Source in `src/modules/*` / `src/kernel/*`, unit tests, Supabase migration |
| ✅ Verify | GitHub Actions | CI — lint · typecheck · governance · build · unit · E2E · DB-migration validation |
| 🚀 Deploy | GitHub Actions + Vercel + Supabase | `supabase db push` (migrations) then Vercel production deploy |
| 📊 Monitor | Developer / PM | `MONITORING.md`, `INCIDENT_RESPONSE.md`, `CHANGELOG.md`, `docs/changes/` |

---

## 2 · Technology Stack

```mermaid
graph TD
    subgraph BROWSER["🌐  Browser"]
        UI["Next.js 16 · App Router\nTypeScript · Tailwind CSS v4\nReact Server Components"]
    end

    subgraph EDGE["⚡  Edge / Server"]
        MW["Middleware\n(route guard · role check)"]
        SA["Server Actions\n(mutations)"]
        API["Route Handlers\n(/api/*)"]
    end

    subgraph SUPABASE["🗄️  Supabase (BaaS)"]
        AUTH["Auth\nMagic Link · OAuth"]
        DB["PostgreSQL\nsequential migrations · RLS"]
        STORAGE["Storage\nprivate buckets (RLS)"]
    end

    subgraph CI["⚙️  CI / CD"]
        GHA["GitHub Actions\nci · db-migrations · deploy-vercel"]
        VERCEL["Vercel\nprod deploy on green main"]
    end

    BROWSER -->|"RSC fetch"| EDGE
    EDGE -->|"supabase-js"| SUPABASE
    BROWSER -->|"supabase-js client"| AUTH
    AUTH -->|"JWT"| DB
    DB -->|"RLS policies"| STORAGE
    GHA -->|"quality gate + db push"| VERCEL

    style BROWSER fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a
    style EDGE    fill:#f0fdf4,stroke:#16a34a,color:#14532d
    style SUPABASE fill:#faf5ff,stroke:#9333ea,color:#4c1d95
    style CI      fill:#fff7ed,stroke:#ea580c,color:#7c2d12
```

Full tooling table in [§9](#9--tooling-reference). Framework/library versions are pinned in
`package.json`; treat it as the source of truth rather than this diagram.

---

## 3 · Development Workflow (PR-based, sprint cadence)

Most implementation is done by **AI coding agents**, with a human reviewing and approving;
the workflow and the quality gates are identical regardless of who writes the code. Work is
scoped either to a **sprint** (`sprints/sprint-NN/`) or, for standalone work, tracked as a
**Change Record** (`docs/changes/`) — see [`../AGENTS.md`](../AGENTS.md) §8.

```mermaid
sequenceDiagram
    actor Dev as 👤 Developer / AI agent
    participant Br as 🌿 Feature branch
    participant CI as ⚙️ GitHub Actions
    participant PR as 🔀 Pull Request
    participant Main as 🚀 main

    Dev->>Br: branch off latest main (feat/ · fix/ · …)
    rect rgb(239,246,255)
        Note over Dev,Br: implement + verify locally
        Dev->>Br: edit source / tests / migration
        Dev->>Br: pnpm typecheck · lint · test · governance · build
        Dev->>Br: update docs trail (CHANGELOG · TRACEABILITY · sprint/change record)
    end
    Dev->>Br: commit (Conventional Commits) + push
    Br->>CI: CI runs on the branch / PR
    Dev->>PR: open PR (when ready)
    CI-->>PR: gates must be green
    PR->>Main: review → merge
    Main->>CI: deploy-vercel (db push → Vercel prod)
```

The historical Cline/PowerShell git protocol that this section used to describe is retained
only as a record in [`CLINE_WORKFLOW.md`](CLINE_WORKFLOW.md); it no longer governs the workflow.

---

## 4 · Continuous Integration & Deployment

Three GitHub Actions workflows run in `.github/workflows/`.

```mermaid
flowchart TD
    TRIGGER(["🔀 push (main · develop · release/**)\nor PR → (main · develop)"])

    TRIGGER --> QG
    subgraph QG ["🔒 ci.yml · Job 1 · Quality Gate"]
        direction TB
        Q1["Validate vercel.json"] --> Q2["pnpm install --frozen-lockfile"]
        Q2 --> Q3["pnpm lint"] --> Q4["pnpm typecheck"]
        Q4 --> Q5["pnpm governance"] --> Q6["pnpm build"]
        Q6 --> Q7[("upload .next artifact")]
    end

    QG --> UT
    QG --> E2E
    subgraph UT ["🧪 ci.yml · Job 2 · Unit Tests"]
        U1["pnpm test:coverage (Vitest)"] --> U2[("upload coverage")]
    end
    subgraph E2E ["🌐 ci.yml · Job 3 · E2E (main + release only)"]
        E1["download .next artifact"] --> E2["Playwright Chromium"]
        E2 --> E3["auth.spec.ts · dashboard.spec.ts"]
    end

    TRIGGER2(["🗄️ change under supabase/migrations/**\n(PR or push)"]) --> DBM
    subgraph DBM ["🧬 db-migrations.yml"]
        D1["supabase start (throwaway Postgres)"] --> D2["apply EVERY migration + seed.sql"]
        D2 --> D3["fail on any migration/seed error"]
    end

    UT --> GREEN(["✅ All green"])
    E2E --> GREEN
    DBM --> GREEN
    GREEN --> DEPLOY

    subgraph DEPLOY ["🚀 deploy-vercel.yml (push to main)"]
        P1["supabase db push --include-all (migrations first)"] --> P2["Vercel production deploy"]
    end

    style QG    fill:#eff6ff,stroke:#3b82f6
    style UT    fill:#f0fdf4,stroke:#16a34a
    style E2E   fill:#faf5ff,stroke:#9333ea
    style DBM   fill:#fef2f2,stroke:#dc2626
    style DEPLOY fill:#fff7ed,stroke:#ea580c
    style TRIGGER fill:#1e3a8a,color:#fff,stroke:#1e3a8a
    style GREEN fill:#059669,color:#fff,stroke:#047857
```

- **`ci.yml`** — Quality Gate (lint · typecheck · **governance** · build), Unit Tests
  (`pnpm test:coverage`), and E2E smoke (only on `main` / `release/**`). Runs on pushes to
  `main`/`develop`/`release/**` and on PRs to `main`/`develop`.
- **`db-migrations.yml`** — spins up a throwaway Supabase stack and applies **every**
  migration + `seed.sql`, so a broken or mis-numbered migration fails at PR time, not on
  the production `db push`. Runs when `supabase/migrations/**`, `seed.sql`, or `config.toml`
  change.
- **`deploy-vercel.yml`** — on push to `main`, runs `supabase db push` (applies new
  migrations to the remote DB) **then** deploys the app to Vercel production. Idempotent —
  only new migrations are applied.

### Environment matrix

| Environment | Trigger | DB | E2E |
|-------------|---------|----|-----|
| Local dev | `pnpm dev` | local or remote Supabase | manual |
| CI (PR) | PR to `main`/`develop` | throwaway Postgres for migration validation | ❌ |
| Vercel Preview | branch push | production Supabase | ❌ |
| Vercel Production | `main` merge | production Supabase (`db push` first) | ✅ |

---

## 5 · Database Migration Lifecycle

The PostgreSQL schema evolves through **sequential, numbered migrations** in
`supabase/migrations/` (the directory is the authoritative history — do not hardcode a count
here). Migrations are never edited after merge; schema changes always add a new file.

### Migration rules

- **Never modify** a committed migration — add a new one instead.
- **File name** `NNNNN_snake_case.sql`, numbered **uniquely and above the highest number on
  `main`**. A duplicate version fails the `db-migrations` gate (the CI checks out the PR
  *merge* ref, so a number that `main` also used collides). Rebase + renumber to fix.
- **Idempotent / re-runnable** — guard with `if not exists`, `on conflict`, `drop … if
  exists`, etc.
- **Declare new tables in an owning `manifest.ts`** (`src/modules/<c>/manifest.ts` or the
  kernel) so the table-ownership governance check accounts for them (ADR-0009).
- **After DDL**: regenerate `src/types/database.ts` (`supabase gen types`), rely on the
  migration's `notify pgrst, 'reload schema';`, and add an `error.tsx` next to any new
  DB-querying page (see `IMPLEMENTATION_GUIDE.md` → Defensive data access).
- **Seed data** lives in `supabase/seed.sql` (dev) and `supabase/seed-demo.sql` (demo).

Application to production is automated by `deploy-vercel.yml` (`supabase db push`) on merge
to `main`.

---

## 6 · Permission & Role Access Model

The platform resolves access from **role defaults + per-user, per-space database overrides**,
with the highest applicable level winning.

```mermaid
flowchart TD
    REQ(["🌐 Incoming Request"]) --> MW["⚙️ Middleware\nroute guard · redirect"]
    MW --> RESOLVE["🔍 Resolve role\nprofiles.role (normalizeRole)"]
    RESOLVE --> MATRIX["📋 ROLE_SPACE_DEFAULTS\n(src/kernel/rbac/role-access.ts)"]
    MATRIX --> DB{{"💾 DB override?\nuser_space_permissions"}}
    DB -- "none" --> DEFAULT["role default\n(invisible / view / edit / manage)"]
    DB -- "global" --> GLOBAL["global override"]
    DB -- "scoped" --> SCOPED["space-scoped override (highest wins)"]
    DEFAULT & GLOBAL & SCOPED --> LEVEL["🎯 Effective AccessLevel"]
    LEVEL --> NAV["🧭 Nav hides invisible spaces"]
    LEVEL --> PAGE["📄 Page renders or 403"]
    LEVEL --> ACTION["⚡ Server Action checks before write"]

    style REQ   fill:#1e3a8a,color:#fff,stroke:#1e3a8a
    style LEVEL fill:#059669,color:#fff,stroke:#047857
    style DB    fill:#7c3aed,color:#fff,stroke:#6d28d9
```

- **Roles** are defined in `src/kernel/rbac/platform-roles.ts` (canonical values include
  `PatientAdvocate`, `Researcher`, `Comms`, `HubCoordinator`, `IndustryPartner`,
  `BoardMember`, `PlatformAdmin`, `Superadmin`; legacy DB values are normalised). A
  `comms_team` capability gates the Communications Workspace.
- **Spaces + the default matrix** live in `role-access.ts` / `permissions.ts`. Because these
  evolve, treat the code and [`ROLE_PERMISSION_MODEL.md`](ROLE_PERMISSION_MODEL.md) as the
  authoritative source rather than a table here.
- **Enforcement is in the database (RLS)**, not only the UI — see ADR-0004 and
  [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md).

---

## 7 · Branching & Release Strategy

Short-lived branches → PR → `main`. See [ADR-0011](ADR/0011-pr-based-trunk-with-sprints.md).

| Branch pattern | Purpose | CI |
|----------------|---------|----|
| `feat/… · fix/… · ci/… · chore/… · docs/…` | all feature/fix/ops work | Quality + Unit (+ DB-migrations if migrations changed) |
| `main` | production · always deployable | Quality + Unit + E2E → `db push` + deploy |
| `develop` | optional integration branch | Quality + Unit |
| `release/**` | release prep / hotfix | Quality + Unit + E2E |

- Branch off the latest `main`; keep branches small and short-lived.
- Merge via PR once the gates are green (open a PR when the work is ready, not per commit).
- Release/versioning detail → [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md).

---

## 8 · Commit Convention & PR Process

### Commit messages — [Conventional Commits](https://www.conventionalcommits.org)

```
type(scope): short imperative description

Types:  feat · fix · docs · refactor · test · chore · ci
Scope:  the area touched, e.g. conferences · intake · auth · nav · ui · db
```

Examples:
```
feat(conferences): add attending-type-aware operating page
fix(auth): resolve magic-link redirect loop
docs(sdlc): refresh CI and workflow sections
```

### Pull requests

Open a PR only when the change is ready (not for every commit). Fill in the repository PR
template — [`.github/pull_request_template.md`](../.github/pull_request_template.md) — which
covers requirement mapping, ADR/deviation, validation (typecheck · tests · RLS ·
accessibility · traceability), and a **database-changes checklist** (migration added, types
regenerated, defensive `{ data, error }` queries, `error.tsx`, RLS role strings). Follow the
documentation standard in [`../AGENTS.md`](../AGENTS.md) §8.

---

## 9 · Tooling Reference

| Tool | Role | Config |
|------|------|--------|
| **Next.js 16** | Full-stack React (App Router, RSC) | `next.config.ts` |
| **TypeScript** | Type safety | `tsconfig.json` |
| **Tailwind CSS v4** | Styling | `postcss.config.mjs` |
| **Supabase** | Auth · Postgres · Storage | `supabase/config.toml` |
| **pnpm** | Package manager (Node 20, see `.nvmrc`) | `pnpm-workspace.yaml` |
| **Vitest** | Unit tests | `vitest.config.ts` |
| **Playwright** | E2E smoke | `playwright.config.ts` |
| **ESLint** | Static analysis | `eslint.config.mjs` |
| **Governance gates** | Module boundaries · table ownership · reachability | `pnpm governance` (`src/kernel/governance/*`) |
| **GitHub Actions** | CI/CD | `.github/workflows/{ci,db-migrations,deploy-vercel}.yml` |
| **Vercel** | Hosting · Edge CDN | `vercel.json` |

---

## 10 · Cross-Document Index

Start with [`../AGENTS.md`](../AGENTS.md) (quick brief) and [`README.md`](README.md) (full index).

| Document | Content |
|----------|---------|
| [`../AGENTS.md`](../AGENTS.md) | **Canonical brief** — commands, guardrails, workflow, documentation standard |
| [`README.md`](README.md) | Documentation index |
| [`MODULAR_COMPONENT_ARCHITECTURE.md`](MODULAR_COMPONENT_ARCHITECTURE.md) | Kernel + components, manifests, governance (ADR-0009) |
| [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) | Coding patterns, Definition of Done, defensive data access |
| [`TEST_STRATEGY.md`](TEST_STRATEGY.md) | Test philosophy, coverage, risk map |
| [`AI_INTEGRATION.md`](AI_INTEGRATION.md) | How the app uses AI (model catalog lives in code) |
| [`ROLE_PERMISSION_MODEL.md`](ROLE_PERMISSION_MODEL.md) | Authoritative role × space matrix |
| [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md) | GDPR, data handling, security controls |
| [`TRACEABILITY.md`](TRACEABILITY.md) | Requirement → ADR → code → test mapping |
| [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md) · [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) · [`MONITORING.md`](MONITORING.md) | Release, incident, observability |
| [`ADR/`](ADR/) | Architecture Decision Records |
| [`sprints/`](../sprints/README.md) · [`changes/`](changes/) | Delivery records (planned + standalone) |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release history (semver) |

---

*Last reviewed: 2026-07-17 · Maintainer: Michael Wittinger · Defers to `AGENTS.md` for the quick brief.*
