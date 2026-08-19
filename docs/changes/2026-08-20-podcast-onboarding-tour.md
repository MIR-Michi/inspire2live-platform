# feat: a watchable "How it works" tour in the Podcast space

- **Date:** 2026-08-20
- **Author:** Cursor agent (Claude), requested by Michael
- **Type:** feat
- **Scope:** podcast-planning UI (`/app/comms/podcast`)
- **Links:** follows `docs/changes/2026-08-20-podcast-planner-visual-ux.md`

## Context

Michael asked for a short explanation video for the podcast section, watchable on the platform as
onboarding and opened from a button in the space. Rather than an mp4 (which would go stale the
moment the UI changes and cannot be produced in-repo), the walkthrough is built as a self-playing
in-app tour that behaves like a video — and is assembled from the same icons and card shapes as the
real screens, so what it teaches is literally what the user sees afterwards.

## Change

- **`src/modules/podcast-planning/ui/onboarding-tour.tsx` (new):** `PodcastOnboardingTour` — a
  "How it works" button that opens a modal player. Seven scenes (~49 seconds): the two rooms ·
  start with a question (the five readiness checks turning green) · wishlist the people · the one
  next-move button · amber means waiting + the six-ask ceiling · the "Next up" strip · booked →
  recorded → calendar. Story-style per-scene progress bars (clickable to jump), play/pause,
  previous/next, Escape/backdrop close, "Watch again" at the end. Scene entrances reuse the
  existing `animate-fade-up` keyframes, which are already disabled under `prefers-reduced-motion`.
- **Wiring:** exported through the module's `index.ts`, declared in `manifest.ts` `provides.ui`,
  and mounted in the Podcast page header next to "+ New episode" — visible on both tabs. It never
  auto-plays; it only opens from the button.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — all green
  (695 tests; one pre-existing unrelated lint warning; `/app/comms/podcast` in the route table).
- One lint error (`react-hooks/set-state-in-effect`) surfaced during development and was fixed by
  moving playback transitions into the interval callback as a pure state updater.
- The player has not been watched in a live browser in this pass — scene timing and animation feel
  should be checked by eye.

## Risk & rollback

Low — one new client component plus three one-line wiring edits. No schema, action or domain
change. Revert the commit to remove the tour.

## Follow-ups

- Watch the tour in the browser and tune scene durations/stagger if any scene feels rushed.
- If more spaces want onboarding tours, the player shell (progress bars, controls, scene timing) is
  a candidate to graduate into `src/kernel/ui` with per-module scenes — deliberately not done for a
  single consumer.
