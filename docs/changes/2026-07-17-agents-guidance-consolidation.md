# docs: consolidate AI/contributor guidance into a canonical AGENTS.md

- **Date:** 2026-07-17
- **Author:** Claude (AI agent) + Michael Wittinger
- **Type:** docs
- **Scope:** repo guidance / documentation
- **Links:** ADR-0011 · `AGENTS.md` · `docs/changes/`

## Context

Guidance for AI coding agents (and humans) was scattered across ~6 files and split
between two concerns, with the richest doc being tool-specific (Cline/Windows). `CLAUDE.md`
held only branch-naming; the operational rules lived in the session harness, invisible to
other tools; the docs index and ADR-0005 had drifted from current practice. There was no
standard way to document work done outside a sprint (the common case). This change
establishes one clear, benchmarked entry point and a consistent documentation standard.

## Change

- **Added `AGENTS.md`** (root) — the canonical, tool-agnostic briefing: what the project
  is, architecture in 60 seconds, the commands that matter, the verify-before-commit gate,
  guardrails, git/branch/commit conventions, a "document your work" standard, and a curated
  link index. Deliberately short; links out instead of duplicating. No model names (the
  catalog in code is the source of truth).
- **`CLAUDE.md` → pointer** to `AGENTS.md`; **`README.md`** gains a top-of-file pointer.
- **Work-documentation standard**: new `docs/changes/` with `TEMPLATE.md` + `README.md`,
  for standalone (non-sprint) work; sprints remain for planned work; both feed CHANGELOG /
  TRACEABILITY / ADRs.
- **ADR-0011** records PR-based trunk + sprint cadence and **supersedes ADR-0005** (which
  is marked superseded, kept as history).
- **Consolidation**: `docs/CLINE_WORKFLOW.md` reduced to a historical stub; its
  defensive-Supabase-query rules moved into `docs/IMPLEMENTATION_GUIDE.md` (Defensive data
  access). `docs/AI_INTEGRATION.md` de-duplicated: canonical `src/kernel/ai-client/*` paths
  noted and the hardcoded model table replaced with a pointer to `models.ts`.
- **`docs/README.md`** refreshed: ADR index extended to 0006–0011, AI docs + change records
  added, last-updated bumped.
- **`docs/SDLC.md` fully refreshed** to the current reality (verified against the repo):
  PR-based/sprint workflow (was direct-to-`main`/Cline), Next.js 16 (was 15), the three
  CI workflows incl. the **governance** gate and **db-migrations** validation and the
  **deploy-vercel `db push` → deploy** flow, migration numbering/table-ownership rules,
  the current role model, and an index that links to `AGENTS.md`/ADR-0011. Counts and
  version tables were softened to *link to the source of truth* rather than restate it,
  so the doc resists re-drift.
- **Doc-maintenance rule added to `AGENTS.md` §8** ("Keep the living docs current"): a
  change→docs trigger matrix, a `Last reviewed:` freshness convention, and a
  link-don't-restate rule — so obsolete content is fixed at authoring time instead of found
  by manual audit.

## Verification

- Docs-only change; no code touched. `git grep` confirms all intra-repo links in the new
  files resolve to existing paths.
- Markdown reviewed for structure/rendering; no build/test surface affected (CI lint,
  test, governance, and migration gates are unaffected by Markdown).

## Risk & rollback

Low — documentation only. Rollback is reverting the commit; no runtime or schema impact.

## Follow-ups

- Product-detail staleness inside `AI_INTEGRATION.md` (e.g. the conference `dedupe_key`
  description) is tracked with the conference work, not here.
