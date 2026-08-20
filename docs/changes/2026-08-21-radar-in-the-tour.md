# feat: Radar in the "How it works" tour

- **Date:** 2026-08-21
- **Author:** Michael (with Cursor)
- **Type:** feat
- **Scope:** podcast-planning (onboarding tour), global CSS
- **Links:** [Sprint 22](../../sprints/sprint-22-podcast-radar/description.md) · [ADR-0016](../ADR/0016-radar-structured-sources.md) · [`PODCAST_RADAR_CONCEPT.md`](../PODCAST_RADAR_CONCEPT.md)

## Context

The tour told viewers that assisted search "is not built yet, and this is how it will
work". Sprint 22 built it, so the tour was describing a future that had already arrived —
and describing it from a design document rather than from the screen, which is exactly the
drift the tour was designed to avoid.

## Change

The two speculative scenes are replaced by five that follow the same worked example. Three
put the **real Radar review** on stage (`RadarReview`, fixture-fed, zoomed into the evidence
line); two are schematic, and only for the things that have no screen — the grounding rule
and what accepting writes.

- `radar-screen.tsx` splits into `RadarScreen` (loads) and **`RadarReview` (renders)**. The
  tour renders the real review component with fixture data rather than a copy of its markup,
  which is what keeps it honest when the screen changes.
- `onboarding-tour-fixture.ts` gains `TOUR_RADAR`: a topic-mode proposal with **two** pieces
  of evidence, one from each catalogue. Two is not decoration — the scene explains the
  two-source floor, and a one-source example would contradict it on screen.
- The scenes now state what is true: OpenAlex and Europe PMC (not the aspirational list of
  registries, regulators and news), the model grouping and phrasing only, an unsourced name
  **dropped rather than flagged**, and accepting opening a *draft* question with unscored
  cards.
- The `ComingNext` badge is gone; nothing in the tour is unbuilt any more.
- Narration deliberately does not quote the button's label — it reads "Suggest guests" or
  "Suggest more" depending on how full the wishlist is, and the tour would be wrong half the
  time.

**Reviewers should look first at the CSS change.** Verifying the scenes turned up a real
bug: a global rule from the visual-UX pass hides any `text-sm` grey paragraph that follows a
heading, matching on *shape*. It was therefore hiding the sentence each Radar proposal is
justified by — so the evidence behind every suggestion was invisible on the live Radar tab,
not only in the tour — and the caption under every tour scene. Both opt out with `data-copy`
and the rule now documents the escape hatch.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — green
- Drove the tour in a real browser (Playwright, dev-only preview route, since removed) and
  screenshotted all five new scenes. The Radar card renders complete — header, why-now,
  `2 sources · most recent 9 Aug 2026`, both names with the `2 SOURCES` badge, and both
  buttons — and the framing was corrected twice off those screenshots (the questions zoom
  was cropping the button; the Radar stage width was clipping the accept row).
- Confirmed the hidden paragraph was a real defect rather than a tour artefact by reading
  the computed style in the browser: `display: none`, applied by `globals.css`, on a
  paragraph that is present in the DOM.

## Risk & rollback

Low for the tour: presentation only, no schema, no server behaviour. The CSS change is the
one with reach — it *reveals* text rather than hiding it, and only where a component has
explicitly asked. Rollback is removing the two `data-copy` attributes.

## Follow-ups

**The copy-cleanup rule is still over-reaching, and this change does not fix that.** It also
hides, among others, the role and organisation line in the People directory
(`people-directory.tsx`), the timestamp on an intake item, and several counts in the admin
screens — none of which are subtitles. Narrowing or removing the rule would visibly change
many screens at once, so it wants its own change and a decision from whoever owns the visual
pass, not a drive-by.
