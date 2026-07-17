# <type>: <short title>

- **Date:** YYYY-MM-DD
- **Author:** <name / agent>
- **Type:** feat · fix · refactor · ops · docs · chore
- **Scope:** <area, e.g. conferences, intake, auth, ci>
- **Links:** PR #… · commit(s) … · ADR-… · REQ-…

> Delete this line and the guidance in each section below; keep the headings.
> Keep it proportionate — a small fix needs a few lines, not an essay.

## Context

Why this change was needed. The problem, the trigger, or the request. One short paragraph.

## Change

What was actually done, and the key files/areas touched. Bullet points are fine.
Call out anything reviewers should look at first.

## Verification

How you confirmed it works. Include the commands you ran and their result, plus any
behavioral evidence (a driven flow, a DB check, a screenshot). For example:

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — green
- <behavioral evidence>

## Risk & rollback

Blast radius, data/migration impact, and how to undo it if needed. "Low — docs only"
is a valid answer.

## Follow-ups

Anything deliberately left out of scope, or a link to where it is tracked. Optional.
