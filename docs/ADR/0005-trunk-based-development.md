# ADR-0005: Trunk-Based Development with AI-Assisted Workflow

- **Status:** superseded by [ADR-0011](0011-pr-based-trunk-with-sprints.md) (2026-07-17)
- **Date:** 2025-10-20
- **Owners:** Michael Wittinger

> **Superseded.** This ADR described pure trunk-based development (commit directly to
> `main`, no feature branches) for a single developer + AI assistant at Phase 0–1.
> The project now uses **PR-based trunk development on a sprint cadence** — see
> [ADR-0011](0011-pr-based-trunk-with-sprints.md). This document is kept as historical
> record; do not follow its "commit directly to `main`" guidance.

## Context

The team consists of 1 developer working with an AI coding assistant (Cline). Traditional branch-per-feature workflows with pull request reviews add ceremony that doesn't provide value when there is a single developer. The project needs a fast, low-friction workflow that still maintains quality through automated gates.

- Related requirements: `REQ-TECH-003`, `REQ-OPS-001`

## Decision

Adopt **trunk-based development** with continuous deployment:

- All work commits directly to `main`.
- Every push to `main` triggers CI (lint, typecheck, build, unit tests).
- Vercel auto-deploys every green `main` push to production.
- No feature branches required (optional for risky changes).
- AI assistant (Cline) operates in PLAN → ACT cycles, producing complete, tested changes.

### Quality gates (replacing PR review)

| Gate | Tool | When |
|------|------|------|
| Type safety | TypeScript strict | Every push |
| Code quality | ESLint | Every push |
| Build integrity | `next build` | Every push |
| Business logic | Vitest unit tests | Every push |
| Critical paths | Playwright E2E | `main` + `release/**` only |

### AI workflow protocol

- Cline reads relevant files in PLAN mode.
- Developer approves plan → switches to ACT mode.
- Cline writes code + tests → runs tests → commits + pushes.
- Git protocol rules prevent terminal hangs (single-line commit messages, separate commands).

## Alternatives considered

1. **GitFlow (develop → release → main)** — Designed for teams with parallel feature development and scheduled releases. Overhead without benefit for a solo developer.
2. **GitHub Flow (feature branch → PR → main)** — PR reviews add friction with no reviewer available. CI gates provide equivalent quality assurance.
3. **Ship/Show/Ask model** — Good for teams; "Ask" (PR review) is the only option not applicable. "Ship" (direct to main) is what we chose.

## Consequences

### Positive
- Zero merge conflicts (single developer).
- Instant feedback loop: code → test → deploy in minutes.
- No stale branches or abandoned PRs.
- CI provides the safety net that PR reviews would normally provide.
- AI assistant can complete full features in a single session without branch management overhead.

### Negative / trade-offs
- No human code review (mitigated by comprehensive CI gates + AI-generated tests).
- Broken `main` = broken production (mitigated by Vercel instant rollback).
- When team grows, will need to adopt branching strategy (see migration plan).
- No staging environment means testing in production (mitigated by feature flags).

## Rollout / Migration plan

- **Current (Phase 0–1):** Pure trunk-based, single developer + AI.
- **Phase 2 (team grows to 2–3):** Introduce optional feature branches + PR reviews for breaking changes.
- **Phase 3 (team > 3):** Full GitHub Flow with required PR reviews + staging environment.

Branch patterns already configured in CI for future use:
- `main` → full CI + E2E + production deploy
- `develop` → CI (no E2E, no production deploy)
- `release/**` → full CI + E2E

## References

- Trunk-Based Development: https://trunkbaseddevelopment.com
- Cline workflow rules: `docs/CLINE_WORKFLOW.md`
- CI configuration: `.github/workflows/ci.yml`
- Git push helper: `scripts/git-push.ps1`
