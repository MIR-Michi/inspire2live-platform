# Inspire2Live Platform — Documentation Index

> **Navigation hub for all project documentation.**  
> Documents are organized by category for quick access. All paths are relative to `docs/`.
>
> 🧭 **New here (human or AI agent)? Start with [`../AGENTS.md`](../AGENTS.md)** — the
> canonical one-page briefing (architecture, commands, guardrails, workflow, and how to
> document your work). This index is the deep-dive map it points into.

---

## 📐 Architecture & Design

| Document | Purpose |
|----------|---------|
| [ADR/](ADR/) | Architecture Decision Records (numbered, immutable) |
| [MODULAR_COMPONENT_ARCHITECTURE.md](MODULAR_COMPONENT_ARCHITECTURE.md) | Kernel + component toolbox model, manifests, governance, AI levels (ADR-0009) |
| [PLATFORM_SETTINGS_CONCEPT.md](PLATFORM_SETTINGS_CONCEPT.md) | Platform Settings space as the manifest-driven blueprint editor (ADR-0010) |
| [ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md](ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md) | Sprint 19 concept for Campus-inspired two-zone dashboards, personal widget layouts, accessible drag/resize, persisted preferences, and purposeful motion |
| [ROLE_PERMISSION_MODEL.md](ROLE_PERMISSION_MODEL.md) | Full role × space permission matrix, override logic |
| [DATA_DICTIONARY.md](DATA_DICTIONARY.md) | Database schema reference, table descriptions, key relationships |
| [DESIGN_CHANGELOG.md](DESIGN_CHANGELOG.md) | History of UI/UX design decisions and deviations |

## 🛠️ Engineering

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Day-to-day coding guide, conventions, Definition of Done |
| [SDLC.md](SDLC.md) | Full software development lifecycle (CI/CD, branching, commit conventions) |
| [TEST_STRATEGY.md](TEST_STRATEGY.md) | Test philosophy, coverage goals, risk-based test map |
| [RELEASE_PROCESS.md](RELEASE_PROCESS.md) | Versioning, staging → production, hotfix, rollback |
| [AI_INTEGRATION.md](AI_INTEGRATION.md) | How the app uses AI: config, shared wrapper, model policy (catalog in code), structured output, human-in-the-loop |
| [changes/](changes/) | Change Records — standardised documentation for work done **outside a sprint** |
| [CLINE_WORKFLOW.md](CLINE_WORKFLOW.md) | *(historical)* Cline git protocol — consolidated into `../AGENTS.md` + `IMPLEMENTATION_GUIDE.md` |
| [TRACEABILITY.md](TRACEABILITY.md) | Requirement → ADR → code → test mapping |

## 📦 Product & Planning

| Document | Purpose |
|----------|---------|
| [PLATFORM_CONCEPT_UPDATE_v1.md](PLATFORM_CONCEPT_UPDATE_v1.md) | **May 2026 pivot** — Communications-first MVP; extends `PLATFORM_DESIGN_DOCUMENT.md` v2.0 |
| [MVP_SCOPE_AND_ROADMAP.md](MVP_SCOPE_AND_ROADMAP.md) | MVP scope, capability layers, phase gates (revised for Comms MVP) |
| [WP_STATUS.md](WP_STATUS.md) | Pre-pivot Work Package status (WP-0 through WP-5) — historical record |
| [../sprints/README.md](../sprints/README.md) | **Active delivery** — sprint definitions and tasks for the Communications MVP |
| [CONGRESS_PRODUCTION_READINESS.md](CONGRESS_PRODUCTION_READINESS.md) | Congress feature production checklist (Phase 2 surface) |
| [PLATFORM_AUDIT_REPORT.md](PLATFORM_AUDIT_REPORT.md) | Full platform audit against design document |

## ⚙️ Operations & Runbooks

| Document | Purpose |
|----------|---------|
| [VERCEL_SETUP.md](VERCEL_SETUP.md) | Vercel hosting configuration and deployment |
| [SUPABASE_SMTP_SETUP.md](SUPABASE_SMTP_SETUP.md) | Supabase email/SMTP configuration |
| [ENVIRONMENT_REFERENCE.md](ENVIRONMENT_REFERENCE.md) | Every env variable explained with impact analysis |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | Severity levels, escalation, rollback procedures |
| [MONITORING.md](MONITORING.md) | Observability, alerting, log access, health checks |

## 🔒 Security & Compliance

| Document | Purpose |
|----------|---------|
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | GDPR compliance, data handling, PII policy, security controls |

---

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](ADR/0001-template.md) | ADR Template | — | — |
| [0002](ADR/0002-supabase-baas.md) | Supabase as Backend-as-a-Service | accepted | 2025-10-15 |
| [0003](ADR/0003-nextjs-app-router.md) | Next.js App Router with RSC | accepted | 2025-10-15 |
| [0004](ADR/0004-role-model-design.md) | Multi-Tier Role & Permission Model | accepted | 2025-11-20 |
| [0005](ADR/0005-trunk-based-development.md) | Trunk-Based Development with AI Assist | superseded by 0011 | 2025-10-20 |
| [0006](ADR/0006-communications-workspace.md) | Communications Workspace | accepted | — |
| [0007](ADR/0007-unified-contact-identity.md) | Unified Contact Identity | accepted | — |
| [0008](ADR/0008-unified-task-domain-layer.md) | Unified Task Domain Layer | accepted | — |
| [0009](ADR/0009-modular-component-architecture.md) | Modular Component Architecture (kernel + components) | accepted | — |
| [0010](ADR/0010-platform-settings-space.md) | Platform Settings Space | accepted | — |
| [0011](ADR/0011-pr-based-trunk-with-sprints.md) | PR-Based Trunk Development with Sprint Cadence | accepted | 2026-07-17 |

---

## Root-Level Files

| File | Purpose |
|------|---------|
| [../AGENTS.md](../AGENTS.md) | **Canonical briefing** for humans & AI agents — start here |
| [../CLAUDE.md](../CLAUDE.md) | Claude Code entry point (points to `AGENTS.md`) |
| [../CHANGELOG.md](../CHANGELOG.md) | Release history (semver) |
| [../README.md](../README.md) | Project overview and quick start |
| [../.env.example](../.env.example) | Environment variable template |

---

*Last updated: 2026-07-17 · Maintainer: Michael Wittinger*
