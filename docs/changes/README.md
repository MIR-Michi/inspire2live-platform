# Change Records

Standardised documentation for work done **outside a sprint** — fixes, ad-hoc
features, ops changes, and one-off improvements. Planned, scoped work is documented
in [`sprints/`](../../sprints/README.md) instead; everything else lives here.

This exists so that *every* change leaves a consistent, findable trail, not just the
ones that happen to fall inside a sprint. See [`AGENTS.md`](../../AGENTS.md) §8.

## How to add one

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to `docs/changes/YYYY-MM-DD-<slug>.md`
   (e.g. `2026-07-17-conference-dedupe.md`). Use the date the work landed and a short,
   descriptive kebab-case slug.
2. Fill in **Context · Change · Verification · Risk & rollback** (and Follow-ups if any).
3. Do the "always" updates from `AGENTS.md` §8:
   - a `[Unreleased]` entry in [`../../CHANGELOG.md`](../../CHANGELOG.md),
   - a `REQ-*` row in [`../TRACEABILITY.md`](../TRACEABILITY.md) if it satisfies a requirement,
   - an [ADR](../ADR/) only for an architectural decision,
   - and the relevant deep doc if behavior/schema/config changed.

## Conventions

- **One record per change** (a PR, or a coherent standalone commit set).
- **Filename** `YYYY-MM-DD-<slug>.md` — chronological and greppable.
- **Proportionate detail** — a one-line fix is a short record; a schema or architectural
  change is a full one (and probably also an ADR).
- Records are an **append-only history**; don't rewrite old ones. Correct course in a
  new record and link back.

## Relationship to other records

| Record type | When | Where |
|---|---|---|
| Change Record | standalone / non-sprint work | `docs/changes/` (here) |
| Sprint task/description | planned, scoped work | `sprints/sprint-NN/` |
| ADR | an architectural decision | `docs/ADR/NNNN-*.md` |
| CHANGELOG entry | every user-facing or notable change | `CHANGELOG.md` |
| Traceability row | requirement satisfied/created | `docs/TRACEABILITY.md` |
