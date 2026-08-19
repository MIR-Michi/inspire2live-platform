# feat: the podcast planner navigates visually, not by prose

- **Date:** 2026-08-20
- **Author:** Cursor agent (Claude), requested by Michael
- **Type:** feat
- **Scope:** podcast-planning UI (`/app/comms/podcast`)
- **Links:** concept `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` (presentation note added) · ADR-0013 unchanged

## Context

The podcast workflow was reported as not intuitive enough: too much text, easy to get lost. The
Planning & Strategy tab explained itself in sentences — nav blurbs, a scoring-philosophy footer,
seven prose blocks in the candidate drawer, readiness gates written as amber paragraphs, and a row
of five equally weighted stage buttons that made the user work out the next move themselves. The
domain layer already computes all of that (`canAdvance`, `questionReadiness`, `waitingState`,
`boardAgenda`); the UI just wasn't showing it as guidance.

## Change

Presentation only — no domain, schema, action or route change. All gates, stages and rules are
untouched and every existing control remains reachable.

- **`ui/icons.tsx` (new):** a small inline-SVG vocabulary — one glyph per stage, used consistently
  on the nav, the column headers, the drawer stepper and the next-move button — plus an
  `InitialsAvatar` that gives every person a stable colour everywhere in the planner.
- **Board (`opportunity-board.tsx`):** a **"Next up" strip** at the top surfaces every card the
  domain says needs a decision (nudge due · silence past cut-off · stalled · due to wake) as
  clickable chips, so nobody scans six columns to find their work. Columns get icons and counts
  (Ask keeps its `n/limit` ceiling); cards shrink to avatar + name + org + score-dot + at most one
  urgency pill; the philosophy footer became a one-line dot legend.
- **Drawer (`candidate-drawer.tsx`):** hierarchy instead of seven blocks — who (avatar + name) →
  where (a six-dot **stage stepper**) → **the one next move**. Score shows as number + band +
  mini-bars with the arithmetic folded under "Why this score"; Research, Route, Background and
  Invitations are collapsible folds, opened by default only when the stage makes them the next
  thing to do.
- **Stage controls (`candidate-stage-controls.tsx`):** the pipeline is linear, so there is exactly
  one forward move — now a single primary button, with the gate's reason as the only line of text
  when blocked. Back / Not now / Close / Anchor are quiet secondary buttons; sleep and close expand
  inline; the ranking override is folded away.
- **Questions (`questions-screen.tsx`):** the four-things readiness gate renders as five
  **check-chips** (Question · Why now · Action · Link · Format) instead of an amber paragraph; the
  intro card and coaching sentences are gone.
- **Composer (`question-composer.tsx`):** teaches by example — placeholders show what a good answer
  looks like; the per-field hint sentences are removed.
- **Shell + page tabs:** the planner nav is an icon pill row (Board · Questions · People ·
  Introductions); the greyed Radar/Results placeholders are gone; the top-level tab label
  "Planning & Strategy" is now "Planning", with icons on both tabs.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — all green
  (695 tests; lint carries one pre-existing unrelated warning; `/app/comms/podcast` in the route
  table).
- Not driven against a live database in this pass — the components render the same data through the
  same props and actions, but the redesigned screens have not been visually inspected in a browser.

## Risk & rollback

Low — presentation-only, confined to `src/modules/podcast-planning/ui/` plus the podcast page's tab
bar. No migration, no API change; component prop signatures are unchanged. Revert the commit to
restore the previous UI.

## Follow-ups

- Drive the planner against a live database and visually review the board, drawer and questions
  screens with real cards.
- The Episodes tab was already tile-based and was deliberately left alone apart from the tab bar.
