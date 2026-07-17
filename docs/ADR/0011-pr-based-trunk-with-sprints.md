# ADR-0011: PR-Based Trunk Development with Sprint Cadence

- **Status:** accepted
- **Date:** 2026-07-17
- **Owners:** Michael Wittinger
- **Supersedes:** [ADR-0005](0005-trunk-based-development.md)

## Context

ADR-0005 (2025-10-20) chose **pure trunk-based development** — all work committed
directly to `main`, no feature branches, CI standing in for code review — appropriate
for a single developer + AI assistant at Phase 0–1.

Practice has since moved on. Work is now organised into [sprints](../../sprints/README.md),
changes land through **feature branches and pull requests** (e.g. #173, #177), CI has
grown to gate migrations and module-boundary governance in addition to lint/typecheck/
build/test, and multiple AI agents and contributors operate on the repo. The "commit
directly to `main`, no branches" rule in ADR-0005 no longer describes reality and
actively misleads new contributors and agents.

This ADR records the workflow as actually practised and makes it the documented standard.

## Decision

Adopt **PR-based trunk development on a sprint cadence**:

- `main` is the single long-lived trunk and the deploy source; it is never committed to
  directly for feature work.
- Work happens on short-lived branches named `feat/… · fix/… · ci/… · chore/… · docs/…`
  (kebab-case), branched off the latest `main`.
- Changes merge to `main` via **pull request**. A PR is opened when the author (or the
  requester) decides the change is ready — not automatically for every commit.
- Every PR must pass the CI gates before merge (see below). Vercel deploys green `main`.
- Planned work is tracked in `sprints/`; standalone work is recorded per
  [`docs/changes/`](../changes/README.md). Both follow the documentation standard in
  [`AGENTS.md`](../../AGENTS.md) §8.

### Quality gates (CI, on every PR)

| Gate | Tool |
|------|------|
| Type safety | `pnpm typecheck` (TypeScript strict) |
| Code quality | `pnpm lint` (ESLint) |
| Business logic | `pnpm test` (Vitest) |
| Module boundaries | `pnpm governance` (import-boundary · table-ownership · reachability + dead-code) |
| Build integrity | `pnpm build` |
| Migrations apply | DB Migrations workflow (throwaway Postgres) |
| Critical paths | Playwright E2E where a runtime surface changed |

## Consequences

- **Positive:** history stays reviewable per change; `main` stays releasable; migration
  and boundary regressions are caught before merge, not in production; multiple agents/
  contributors can work in parallel without stepping on `main`.
- **Trade-offs:** slightly more ceremony than direct-to-`main`; requires migration
  numbers to be unique above `main`'s highest (a version collision fails the DB
  Migrations gate — see `AGENTS.md` §6).

## References

- Supersedes: [ADR-0005](0005-trunk-based-development.md)
- Canonical workflow brief: [`AGENTS.md`](../../AGENTS.md)
- Lifecycle detail: [`docs/SDLC.md`](../SDLC.md)
- CI configuration: [`.github/workflows/`](../../.github/workflows/)
