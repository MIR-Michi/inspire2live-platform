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
in-app tour that behaves like a video.

Four passes on the same day, each a follow-up request: the player, then voice, then the rationale
rewrite, and finally — the shape described here — **a walkthrough of the actual product**, following
one worked example, zooming into what is being talked about, and covering how discovery will work
and how the Inspire2Live network is used before reaching outward.

## Change

- **`ui/onboarding-tour.tsx` (client):** `TourLauncher` — a "How it works" button that opens a modal
  player. Story-style per-scene progress bars (clickable to jump), play/pause, previous/next, a
  chapter rail, Escape/backdrop close, "Watch again" at the end, keyboard control (space plays and
  pauses, ← → step scenes), and three widths remembered in `localStorage` (`i2l.podcast-tour.size`).
- **The camera (`ScreenStage`).** A scene may name a real screen and a focus point. The screen is
  laid out at its natural width (`SCREEN_WIDTH`), scaled to fit the frame, then panned and zoomed to
  `focus`, clamped to the screen's edges so a rough coordinate never reveals empty space. Moving
  between two focus points on the same screen glides (700 ms), which is what gives the tour its
  camera; changing screen cuts. The stage is `inert` — these are live components wired to real
  server actions, and a click on a demo card must not move anything.
- **`ui/onboarding-tour-screens.tsx` (new, server):** renders the **real** `QuestionsScreen`,
  `OpportunityBoard`, `CandidateDrawer`, `RouteExplorer` and `PeopleDirectory` and passes them to
  the client player as nodes. This is a boundary requirement, not a preference: `CandidateDrawer`
  and `RouteExplorer` reach `network`'s public API, which pulls server-only modules, so importing
  them from a `'use client'` file would break the build. `PodcastOnboardingTour` (the module's
  exported name) now lives here; the client half is `TourLauncher`.
- **`ui/onboarding-tour-fixture.ts` (new):** the worked example — one question ("why is a proven
  molecular diagnostic still unreimbursed…") with nine invented people spread across the stages, a
  second deliberately unfinished question, two routes and an invitation. Every derived number
  (waiting days, readiness chips, the score and its breakdown, "Next up") comes from the **real**
  pure functions `scoreCandidate`, `waitingState` and `summariseQuestions`, so the example cannot
  show something the product would not. Dates are relative to now, so "waiting 9 days" stays true.
- **`ui/onboarding-tour-scenes.tsx`:** the script — **24 scenes in 7 chapters, about six minutes**:
  *Why* · *The question* · *Finding people* · *The board* · *One card* · *Getting a yes* · *The
  loop*. Twelve scenes are the real screens under the camera; twelve are schematic, and only where
  there is nothing to point at (why a question outlives a no, the shape of the network, the search
  that does not exist yet, the six-ask ceiling, the override, the calendar handover).
- **Two new subjects, per the request.** *Finding people* explains the order — past guests, then
  members and hubs, then who they know, and only then outward — and then **assisted search**: what
  it watches (open sources only), the three filters, the citation, and the human gate. Those scenes
  are labelled **“Coming next”** in the visual and say so in the narration: Radar is Phase B and is
  not built (see `src/modules/podcast-planning/README.md`). The tour also states plainly that the
  ranking is arithmetic and never a model, which is true today and must stay true.
- **Voice narration** (unchanged from the previous pass): each scene's `narration` is spoken through
  the browser's `speechSynthesis` at rate `0.86`, pitch `0.95`, after a 450 ms beat, preferring a
  calm British English voice. A finished scene holds until its sentence ends; pausing pauses the
  voice; a speaker button mutes. The utterance is held in a ref (Chrome garbage-collects it and
  silences `onend`) and an 8-second `resume()` keep-alive works around Chrome's long-utterance stop.

## Verification

- `pnpm typecheck` · `pnpm lint` · `pnpm governance` · `pnpm build` — green (`/app/comms/podcast` in
  the route table; one pre-existing unrelated lint warning in `comms/conferences/actions.ts`).
- `pnpm test` — green apart from the known `conferences.test.ts` timezone failure, which is
  pre-existing, untouched here and passes under `TZ=UTC` as CI runs it.
- The build is the meaningful check for this change: it is what proves the server-rendered screens
  do not drag server-only modules into the client bundle.
- Runtime is estimated at 5:54 (785 narrated words at ~140 words a minute); the actual length varies
  with the browser's speaking rate, since each scene waits for its sentence to finish. The first
  draft of this script ran to eight minutes and was cut back.
- **Not yet watched in a live browser.** Scene timing, the zoom coordinates (they are percentages of
  each screen and were chosen by reading the layout, not by eye) and voice quality should be checked
  by eye and ear.

## Risk & rollback

Low, but higher than the earlier passes: the tour now mounts real components with fixture data, so
a screen that starts requiring a browser-only or request-scoped API would surface here first. It
renders on every Podcast page load (pure functions, no queries) and adds its RSC payload to that
page whether or not the tour is opened. No schema, action or domain change. Revert the commits to
remove the tour.

## Follow-ups

- Watch it in the browser: check the zoom framing on the board (the six-column layout needs a
  viewport ≥ 1280 px; below that Tailwind's `md:grid-cols-3` applies and the coordinates point at
  different columns), and tune `focus` values.
- When Radar ships, the two "Coming next" scenes should become real screens like the rest.
- The script restates reasoning that lives in `PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md`. That is a
  deliberate copy (a spoken script cannot link), and it is the one place in this feature that can
  drift — revisit it when the concept changes.
- If more spaces want onboarding tours, the player shell (camera, progress bars, controls, narration)
  is a candidate to graduate into `src/kernel/ui` with per-module scenes — deliberately not done for
  a single consumer.
