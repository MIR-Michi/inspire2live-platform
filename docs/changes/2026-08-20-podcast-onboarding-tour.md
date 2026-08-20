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

Shipped in three passes on the same day; the final shape is described here.

- **`src/modules/podcast-planning/ui/onboarding-tour.tsx` (new):** `PodcastOnboardingTour` — a
  "How it works" button that opens a modal player. Story-style per-scene progress bars (clickable
  to jump), play/pause, previous/next, a chapter rail, Escape/backdrop close, "Watch again" at the
  end, and keyboard control (space plays and pauses, ← → step scenes). Scene entrances reuse the
  existing `animate-fade-up` keyframes, which are already disabled under `prefers-reduced-motion`.
- **`src/modules/podcast-planning/ui/onboarding-tour-scenes.tsx` (new):** the script — **twenty
  scenes in six chapters, about four minutes**: *Why* (booking is the bottleneck; the work lives in
  one inbox) · *Questions* (the three nested levels; why the card is the person and the question the
  folder; the four things written down first; many names, one anchor) · *Stages* (six stages and two
  exits; research as the quality gate; one next move per card; the seven- and fourteen-day counts) ·
  *Limits* (waiting is not to-do; six open asks; why the asymmetry is deliberate) · *Judgement* (the
  score out of 100 with its breakdown; the score ranks but never decides; the two asks, map question
  before favour) · *Your day* ("Next up", the calendar handover, start with a question). It
  deliberately explains the **reasoning**, taken from `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`
  §1–§3, §7, §8 and §10 — that doc stays the source of truth, so a change in the thinking has to
  change both. Scene length is derived from the narration word count, so the progress bar tracks
  the voice instead of racing ahead of it.
- **Voice narration:** each scene carries a `narration` sentence spoken through the browser's
  built-in `speechSynthesis` — no audio assets, no TTS service, nothing to re-record when a scene
  changes. Deliberately unhurried: rate `0.86`, pitch `0.95`, a 450 ms beat before a scene speaks,
  and a preference for a calm British English voice where the platform offers one. A visually
  finished scene holds (bar full) until its sentence ends so the voice is never cut mid-word;
  pausing the tour pauses the voice mid-sentence and play resumes it; jumping scenes cancels and
  re-speaks. A speaker button in the controls mutes/unmutes (`aria-pressed`), and where
  `speechSynthesis` is unavailable the button is hidden and the tour plays silently. The utterance
  is held in a ref to dodge Chrome's garbage-collection-silences-`onend` bug, and an 8-second
  `resume()` keep-alive works around Chrome stopping long utterances.
- **Resizable:** three widths (compact · regular · large) from `−`/`+` buttons in the title bar,
  which also scale the stage content; the choice is remembered per browser in `localStorage`
  (`i2l.podcast-tour.size`).
- **Wiring:** exported through the module's `index.ts`, declared in `manifest.ts` `provides.ui`,
  and mounted in the Podcast page header next to "+ New episode" — visible on both tabs. It never
  auto-plays; it only opens from the button.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — all green
  (695 tests; one pre-existing unrelated lint warning; `/app/comms/podcast` in the route table).
- One lint error (`react-hooks/set-state-in-effect`) surfaced during development and was fixed by
  moving playback transitions into the interval callback as a pure state updater.
- The narration and the twenty-scene rewrite each re-ran the full gate — all green, except the
  known `conferences.test.ts` timezone failure, which is pre-existing, untouched here and passes
  under `TZ=UTC` as CI runs it.
- Estimated runtime is 4.0 minutes (528 narrated words at ~140 words a minute); actual length
  varies with the browser's speaking rate, since a scene waits for its sentence to finish.
- The player has not been watched in a live browser in any of these passes — scene timing,
  animation feel and voice quality (which depends on the platform's `en-GB` voices) should be
  checked by eye and ear.

## Risk & rollback

Low — two new client components plus three one-line wiring edits. No schema, action or domain
change. Revert the commits to remove the tour.

## Follow-ups

- Watch the tour in the browser and tune scene durations/stagger if any scene feels rushed.
- The script restates reasoning that lives in `PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`. That is a
  deliberate copy (a spoken script cannot link), but it is the one place in this feature that can
  drift — revisit it when the concept changes.
- If more spaces want onboarding tours, the player shell (progress bars, controls, scene timing) is
  a candidate to graduate into `src/kernel/ui` with per-module scenes — deliberately not done for a
  single consumer.
