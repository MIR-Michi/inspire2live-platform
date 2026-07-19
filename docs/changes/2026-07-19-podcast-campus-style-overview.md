# refactor: podcast overview redesigned to match the Campus overview

- **Date:** 2026-07-19
- **Author:** Claude (agent)
- **Type:** refactor
- **Scope:** comms / podcast
- **Links:** branch `claude/podcast-overview-redesign-d2a8rx`

## Context

The Podcast workspace landing page used the generic `EventsPipelineShell`
(stage-filtered pipeline), which looked nothing like the Campus overview. The
request was to make the Podcast overview look **exactly like the Campus overview
page** — the same header, tabs, dominant "last / next" tiles, and previous-item
grid.

## Change

Rewrote `src/app/app/comms/podcast/page.tsx` to mirror
`src/app/app/comms/campus/page.tsx` one-to-one, adapted to podcast/episode data
(`events` where `event_type = 'podcast'`):

- **Header** — "Podcast" title, "Saved" pill, and a "+ New episode" dropdown that
  creates a podcast event (title, recording date, responsible owner) via the
  existing `createEvent` action, then opens the new episode.
- **Tabs** — "Episodes" (default) and "Guests", replacing "Monthly meetings" /
  "Members".
- **Episodes tab** — dominant `BigEpisodeTile`s for the last (past) and next
  (upcoming) episode, plus a `SmallEpisodeTile` grid of previous episodes with a
  "Show all episodes" toggle. Reuses `PresenterAvatar` (episode cover / guest
  image, friendly fallback face). Open-task counts come from the podcast
  workflow checklist via `getPodcastWorkflowProgress` (open = total − completed).
  The "next" tile gets the same blue emphasis; badges are Ready / Published /
  Completed.
- **Guests tab** — unique guests aggregated from every episode's
  `podcast_guests`, listed Campus-members-style with an episode count and latest
  episode (guests have no standalone record, so rows are non-linking).

No data-model, schema, or shared-component changes — this is a page-level
presentation swap. The rich pipeline shell remains in use by the Events and
Conferences workspaces.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — green
  (the single lint warning is pre-existing in `conferences/actions.ts`; the build's
  `/app/admin/permissions` dynamic-usage log is likewise pre-existing).
- The `/app/comms/podcast` route compiles and is served dynamically; page logic
  mirrors the already-shipping Campus overview it was copied from.

## Risk & rollback

Low — single page component, no schema or shared surface touched. Revert the file
to restore the `EventsPipelineShell` version.

## Follow-ups

If podcast guests later warrant their own records/detail pages, the Guests tab
rows can become links (as Campus member rows are).
