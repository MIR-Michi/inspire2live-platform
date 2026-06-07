# Inspire2Live Platform — Implementation Guide (Execution Layer)

> **Purpose:** Fast, engineering-facing execution guide. Compressed policy and constraints derived from the full design document.  
> **Canonical benchmark:** `Inspire2Live_PLATFORM_DESIGN_DOCUMENT.md` (v2.0) — never edited casually; open only when needed (see §4 below).  
> **Working reference:** This document + `docs/TRACEABILITY.md` are the day-to-day tools.

---

## 1) Current Scope Snapshot

- **Primary benchmark:** `PLATFORM_DESIGN_DOCUMENT.md` (v2.0)
- **Website/platform positioning:** `www.inspire2live.com` remains the public website. The platform complements it as the authenticated collaboration and execution layer.
- **Current build stage:** Phase 0 complete → Phase 1 Week 1 in progress
- **Tech baseline:** Next.js 16, React 19, Tailwind CSS 4, TypeScript strict, Supabase

---

## 2) Active Phase

### Completed (Phase 0)
- Supabase schema + RLS + storage buckets + DB views + seed
- TypeScript DB types generated
- Supabase server/browser clients
- Platform entry page + login + onboarding scaffold
- Governance docs established

### In Progress (Phase 1, Week 1)
- Auth callback + middleware hardening
- Onboarding wizard: all 4 steps with profile persistence

### Next (Phase 1, Week 2)
- App shell (TopNav, SideNav, role-aware routing)
- Role-based dashboards: Coordinator (Sophie), Advocate (Maria), Board-lite (Peter)
- Profile page with contribution timeline

See `docs/MVP_SCOPE_AND_ROADMAP.md` for full week-by-week plan.

---

## 3) Non-Negotiable Constraints

These are distilled from §3 of the Design Document. **Any deviation requires an ADR.**

1. **Patient voice structurally equal** — no "patient-lite" access tier. PatientAdvocate has full workspace rights within their initiatives, same as clinicians/researchers.
2. **Role-based governance enforced in DB** via RLS — never only in UI checks.
3. **Institutional memory first-class** — traceable decisions/tasks/evidence. No orphan actions. Every contribution is attributable and searchable.
4. **Neutrality by architecture** — industry partner scope is enforced structurally (scoped DB access, audit trail, physical separation of partner content from editorial content).
5. **Global-first UX** — timezone-aware, localization-ready, low-bandwidth conscious. Not internalized later.
6. **Momentum over ceremony** — default views show what needs attention now, not achievement summaries. Empty states prompt action, not celebration.

---

## 4) Design Intent Awareness — Efficiency Model

### The Problem
Reading the full 12-section Design Document for every implementation step is inefficient and costly. But losing sight of design intent causes architectural drift that is expensive to correct.

### The Three-Layer Reference Model

```
Layer A (Canonical):      PLATFORM_DESIGN_DOCUMENT.md v2.0
                          ↓ read when: new domain, non-negotiable touched, ambiguity
Layer B (Execution):      docs/IMPLEMENTATION_GUIDE.md  ← this file
                          ↓ read every sprint
Layer C (Work Mapping):   docs/TRACEABILITY.md + REQ-* IDs in PRs
                          ↓ updated every PR
```

**Day-to-day workflow:** Engineers work from Layer B + relevant traceability rows only.

**Open the full Design Document (Layer A) when:**
1. Building a new domain for the first time (e.g., first congress feature, first hub feature, first partner feature)
2. Touching a non-negotiable constraint (see §3 above)
3. An apparent conflict or ambiguity arises between current code and expected behaviour
4. Beginning a new phase (Phase 1 → 2, Phase 2 → 3)

**Never open Layer A for:**
- Routine feature implementation within an established domain
- Bug fixes within existing patterns
- Styling/responsive/accessibility passes

### Per-Sprint Design Intent Packet

For each sprint or significant feature, generate a minimal design intent packet before coding:

```
Feature: [name]
Design Doc sections: [e.g., §5.2, §8.3]
REQ-* IDs in scope: [e.g., REQ-UX-002, REQ-SEC-001]
Non-negotiables touched: [list any from §3, or "none"]
UX flow reference: [e.g., §6 Flow 1 - Maria joins after congress]
Acceptance checks:
  - [ ] Patient voice equality preserved?
  - [ ] RLS enforced in DB (not UI-only)?
  - [ ] Action is attributable and traceable?
  - [ ] No color-only status indicators?
  - [ ] Timezone-aware timestamps?
```

This packet is generated once per feature and attached to the PR. It prevents full-document re-reads while maintaining design accountability.

### Deviation Control (Low Overhead)

**If implementation must diverge from the design doc:**
1. Create an ADR in `docs/ADR/` (use `0001-template.md`)
2. Reference impacted `REQ-*` IDs in the ADR
3. Mark deviation row in `docs/TRACEABILITY.md` with status `deferred` or `deviated`
4. PR description must include "Design Intent Check" block (see PR template)

**No silent deviations.** A deviation that is documented and intentional is fine. An undocumented drift is a risk.

### Drift Detection Cadence

| Cadence | Activity | Time Cost |
|---|---|---|
| Every PR | "Design Intent Check" block in PR description | 5 min |
| Weekly | Review top 5 non-negotiables against shipped code | 15 min |
| Phase boundary | Full roadmap re-baseline against Design Doc benchmark | 1 session |

---

## 5) Requirement ID Convention

Use stable IDs in tickets, PRs, and commits. Format: `REQ-[DOMAIN]-[NNN]`

| Prefix | Domain |
|---|---|
| `REQ-IA-xxx` | Information architecture / routing |
| `REQ-UX-xxx` | UX flows and interactions |
| `REQ-DS-xxx` | Design system (tokens, components) |
| `REQ-TECH-xxx` | Technical architecture |
| `REQ-A11Y-xxx` | Accessibility |
| `REQ-PERF-xxx` | Performance / low-bandwidth |
| `REQ-SEC-xxx` | Security / RLS / permissions / compliance |
| `REQ-OPS-xxx` | Operational features (bureau, reporting) |
| `REQ-RES-xxx` | Resource library / institutional memory |
| `REQ-PARTNER-xxx` | Partner engagement portal |
| `REQ-CONGRESS-xxx` | Congress cycle features |
| `REQ-HUB-xxx` | Hub network features |

Example commit message: `feat(initiatives): implement kanban task board — implements REQ-UX-002, REQ-SEC-003`

---

## 6) Definition of Done (Feature Level)

A feature is done when:

- [ ] Requirement IDs mapped in PR description
- [ ] RLS/permissions verified if any data access involved (test with seed persona for each role)
- [ ] Design intent packet reviewed (§4 above)
- [ ] Keyboard navigation and semantic HTML labels present
- [ ] Status indicators use icon + text, not color alone
- [ ] Timestamps are timezone-aware
- [ ] Type-safe server/client data path (no `any`)
- [ ] Empty state exists for zero-data view (action-oriented copy)
- [ ] Loading skeleton exists for async-loaded content
- [ ] `docs/TRACEABILITY.md` row updated

---

## 7) Design System Quick Reference (from §7 of Design Doc)

### Primary Colors

> Sourced from `public/brand/inspire2live-logo.png` (Sprint 10 — Brand Identity
> Alignment): a dark-charcoal "inspire" / "live" wordmark with the "2" and the
> accent dot in brand red, paired with a multi-tone dotted mark. These replace
> the earlier orange/blue placeholder values.

| Token | Hex | Use |
|---|---|---|
| `--color-primary-500` | `#D74247` | CTAs, active states, primary buttons (brand red — from the "2" / accent dot) |
| `--color-primary-600` | `#B8282D` | Hover |
| `--color-secondary-500` | `#2A2C35` | Nav, secondary brand, text on light (brand charcoal — from the wordmark text) |
| `--color-accent-500` | `#2AAA8A` | Success, progress, positive indicators |

### Semantic Colors
| Token | Hex | Use |
|---|---|---|
| `--color-success` | `#2AAA8A` | Green RAG, completed |
| `--color-warning` | `#E8981E` | Amber RAG, approaching deadline |
| `--color-danger` | `#B3261E` | Red RAG, blocked, overdue — deliberately a deeper, cooler red than `--color-primary-500` so CTAs and "blocked / overdue" states stay visually distinct (REQ-A11Y-003 still requires icon + text, not colour alone) |

### RAG Logic (Bureau + Dashboards)
- **Green:** All milestones on track, no blocked tasks, activity within 7 days
- **Amber:** Milestone due within 7 days OR blocked task exists OR last activity 8–13 days ago
- **Red:** Milestone overdue OR 3+ blocked tasks OR no activity in 14+ days

### Typography
- **Font:** Inter (all weights). Code: JetBrains Mono.
- **Display:** 700 / 48px | **H1:** 700 / 36px | **H2:** 600 / 28px | **Body:** 400 / 16px

### Motion
- Micro (button hover): `150ms ease-out`
- Component (panel, tab): `250ms ease-out`
- Page: `350ms ease-in-out`
- Always respect `prefers-reduced-motion: reduce`

---

## 8) Key Personas (for Seed Data and Role Testing)

| Persona | Role | Dashboard | Key Need |
|---|---|---|---|
| Maria | PatientAdvocate | Advocate dashboard | Tasks + initiative status in one place |
| Sophie | Coordinator (PlatformAdmin) | Bureau + Coordinator dashboard | RAG overview + blocker resolution |
| Dr. Kwame | Researcher | Advocate dashboard | Evidence library + structured tasks |
| Hiroshi | IndustryPartner | Scoped partner view | Governed scope + compliance docs |
| Amara | HubCoordinator | Hub dashboard (Phase 3) | Templates + local initiative tracking |
| Peter | BoardMember | Board dashboard | Top-line metrics + drill-down |
| Lina | Comms | Comms dashboard | Content calendar, campus updates, attention queue |

See §2.2 of Design Document for full persona detail (open Layer A only when onboarding new contributors or designing a new persona-specific flow).

---

## 9) Testing & CI/CD

### Overview

The platform uses a **risk-based, lean testing strategy** — quality comes from testing the right things deeply, not from blanket coverage.

### Test Stack

| Tool | Purpose |
|---|---|
| **Vitest** | Unit tests — fast, Vite-native, TypeScript-first |
| **@testing-library/react** | React component tests (when needed) |
| **Playwright** | E2E smoke tests — real browser, real routes |

### Running Tests Locally

```bash
# Run all unit tests
pnpm test

# Watch mode (dev loop)
pnpm test:watch

# Unit tests with coverage report
pnpm test:coverage

# Run E2E smoke tests (requires dev server running or starts automatically)
pnpm test:e2e

# Type check only (no emit)
pnpm typecheck
```

### Test Philosophy

**Unit tests** (`src/test/unit/`)
- Test **pure logic only**: RAG status derivation, routing decision functions, utility transformers
- Do NOT test presentational React components with snapshots
- Do NOT test Supabase I/O — use integration tests for that (Phase 2+)
- Target: 10–25 focused assertions per logic domain

**E2E smoke tests** (`src/test/e2e/`)
- Test **critical user paths only**: auth gate, route protection, login form behavior
- Authenticated flows require a saved browser state (`src/test/e2e/auth.json`, gitignored)
  - Generate via: `pnpm exec playwright codegen --save-storage=src/test/e2e/auth.json http://localhost:3000`
- Target: 4–8 smoke paths covering the highest-risk flows
- Chromium only during MVP phase (fast + reliable)

### Coverage Thresholds

- Lines: **60%** | Functions: **60%** (enforced by Vitest)
- Coverage is not the goal — **risk coverage** is. Test what breaks silently.

### CI/CD Pipeline (GitHub Actions)

The pipeline runs on every push and PR to `main`/`develop`. Three jobs:

```
push/PR
  └── quality         (lint → typecheck → build)    ~3 min
        ├── unit-tests (vitest --coverage)           ~1 min
        └── e2e        (playwright, main/release only) ~3 min
```

- **Quality gate** must pass before tests run
- **E2E** runs only on `main` and `release/**` branches (not on every feature branch)
- All secrets managed in GitHub repo settings: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Coverage report and Playwright failure reports uploaded as artifacts (7-day retention)

### Risk-Based Coverage Map

| Area | Test type | Priority |
|---|---|---|
| RAG status logic | Unit | High |
| Middleware route guards | Unit | High |
| Auth callback / login flow | E2E smoke | High |
| Role-based route behaviour | E2E smoke | High |
| RLS data isolation | Integration (Phase 2) | High |
| Presentational UI components | None (MVP phase) | Low |
| Static landing/marketing pages | None | Low |

---

## 10) Quick Links

| Document | Purpose | When to Open |
|---|---|---|
| `PLATFORM_DESIGN_DOCUMENT.md` | Layer A — full canonical benchmark | New domain, non-negotiable, ambiguity, phase boundary |
| `docs/MVP_SCOPE_AND_ROADMAP.md` | Scope gates + roadmap | Sprint planning, scope decisions |
| `docs/TRACEABILITY.md` | REQ-* status + code locations | Every PR |
| `docs/DESIGN_CHANGELOG.md` | History of design decisions | When understanding "why" |
| `docs/ADR/` | Architecture decision records | When deviating |
