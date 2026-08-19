# Sprint 21 — Publishing space (LinkedIn first)

> **Status:** Not started — see `tasks.md`.
> **Theme:** A **Publishing** space in the Communications workspace that turns either a platform
> record **or** a dropped screenshot plus one line of context into a channel-ready post, drafted by
> the platform's own AI layer and approved by a human. LinkedIn is the first channel; newsletter and
> website are visible and deliberately not enabled yet.
> **Depends on:** Sprint 16 modular foundation (ADR-0009), Sprint 17 Platform Settings (ADR-0010),
> Sprint 19 design system, the content calendar in `content`, and the campus session record in `events`.
> **Concept:** `docs/PUBLISHING_SPACE_CONCEPT.md`
> **Decision record:** `docs/ADR/0014-publishing-space.md`

## Non-negotiable architecture direction

This sprint builds a **toolbox component**, not a feature on a page. Every task holds to ADR-0014:

- **`publishing` is generic.** No campus vocabulary, no channel-specific branches in its domain. It
  imports the kernel and `content@^1` only, and must remain extractable.
- **A source is a curated payload, never a page read.** Each owning component exports a
  `SourceProvider` and declares it via the new `provides.sources` manifest field. Only
  publication-intended fields leave the owning component.
- **An uploaded screenshot is a source, not a second code path.** It goes through the same contract,
  the same readiness gate, the same groundedness contract and the same approval gate.
- **Composition lives in `src/modules/publishing-registry.ts`** — the `settings-registry.ts` pattern.
  `publishing` imports no source owner; `events` imports nothing from `publishing`.
- **A channel is data.** Channel profiles are keyed by the existing `CalendarChannel` vocabulary.
  There is no `linkedin` module and no second channel vocabulary. "Website" is `wordpress`.
- **Every tunable is manifest `config`** — variants per run, brand voice, banned phrases, hashtag
  policy, readiness threshold, upload ceiling, stale behaviour — rendered as a Platform Settings panel.
  **Except one:** human approval before handover is fixed in the domain layer, never a setting.
- **No second publishing path.** Approved copy becomes a `content_calendar` entry through `content`'s
  own action; provenance is written back by the provider's `onPublished` hook.
- **No table without a reader.** Two tables, both read in this sprint.

## Goal

Shipping this sprint produces:

1. **A Publishing space** at `/app/comms/publishing`, in the comms nav under *Content*, with three
   steps on one screen: **source → draft → approve**.
2. **Two ways in, equally weighted.** Pick a recent platform record (World Campus session first), or
   drop a screenshot and type one line of context. Both arrive at the drafter as the same payload.
3. **Copy drafted through the kernel AI client.** Two or three variants per run, each with its angle,
   a character budget against the channel profile, hashtags, and every factual claim mapped to the
   source field it came from. For a screenshot, the model's own reading of the image is shown so a
   misread is obvious before anyone approves it.
4. **A review that is a real review.** In-place editing, a visible divergence marker, an explicit
   approval that stamps who approved what, and an untouched copy of the original model output kept for
   calibration.
5. **A handover, not a dead end.** Approved copy becomes a `content_calendar` entry
   (`channels: ['linkedin']`, `body_draft`), the calendar entry id is recorded back on the source
   (`campus_sessions.published_outputs`) through the owning component, and the existing LinkedIn stub
   logs the delivery intent.
6. **A rights answer that has teeth.** An ad-hoc upload carries `internal_only` /
   `approved_for_publication` / `needs_clearance`; anything not cleared can be drafted from but cannot
   hand over.
7. **A UX guided by design, not by instructions.** One decision visible at a time, one- or two-word
   labels, affordances instead of sentences, and the degraded states designed rather than apologised
   for.
8. **A component in the catalog.** Manifest, registry entry, settings panel, ownership declarations,
   a new source-reconciliation governance check, and all governance gates green.

## Rationale

Two situations both end in "someone should post about this", and today neither reliably does. When the
platform already holds the material — a campus meeting with a summary, publication decisions and a
named presenter — somebody retypes it into LinkedIn. When it does not — a photo from a conference
stand, a screenshot of an abstract, an image a member sent — nothing happens at all unless one person
finds time to write a post from scratch.

A button on the campus page would serve the first case only, and would be rewritten for every
subsequent source and channel. The flexible-source requirement makes the abstraction unavoidable
anyway: a screenshot has no owning record, so the pipeline cannot assume its input is a row. Once
"source material" is defined abstractly, per-entity code paths stop being necessary — which is why the
cheap implementation is not even the simple one (ADR-0014).

Sequenced here because its prerequisites have landed: Sprint 17 gave manifest-driven settings (so brand
voice and every threshold are operator-tunable without a deploy), Sprint 19 gave the design system this
space composes, and Sprint 20 exercised the cross-component contract rules for real. The AI layer,
`content_calendar`, the LinkedIn integration stub and the campus publication fields all already exist —
this sprint mostly connects things the platform already has.

## Acceptance criteria

- [ ] ADR-0014 accepted; concept in `docs/`; both referenced from `docs/README.md`.
- [ ] `publishing` exists as a component with a valid manifest, is in `src/modules/registry.ts`, and
      owns every table it creates.
- [ ] One migration (≥ `00173`) creates `publishing_drafts` and `publishing_sources` with RLS on both,
      creates the private `publishing-uploads` bucket with comms-gated storage policies, and extends the
      `comms_integration_intents.entity_type` check constraint.
- [ ] `provides.sources` exists on `ComponentProvides`, `validateManifest` covers it, and the new
      source-reconciliation gate fails on a declared-but-unregistered source, an unregistered-but-declared
      provider, and a wrong `ownedBy`.
- [ ] `publishing` imports the kernel and `@/modules/content` only — no source-owner import, verified by
      the import-boundary gate. `events` imports nothing from `publishing`.
- [ ] `/app/comms/publishing` is reachable from the comms nav for `Comms`, `PlatformAdmin` and
      `Superadmin`, has an `error.tsx`, and renders nothing but an explanation when the AI flag is off.
- [ ] A World Campus session can be picked from the source list and produces variants grounded only in
      publication-intended fields — no transcript, WhatsApp digest, attendee list or internal comment is
      ever sent to the model.
- [ ] A screenshot can be dropped, described in one line, given a rights answer, and produces variants;
      the model's reading of the image is shown in the review.
- [ ] A source with too little material returns the readiness message instead of a draft, in the
      source's own terms.
- [ ] A variant citing a source field that was not sent is rejected by the validator; claims are shown
      beside their source field in the review UI.
- [ ] Editing, approving, dismissing and regenerating behave as specified: `ai_body` untouched,
      siblings dismissed on approval, previous run superseded on regenerate, at most one live pending run
      per source and channel.
- [ ] Handover is impossible without approval and impossible when rights are not cleared, enforced in
      the domain layer and unit-tested — not only in the UI.
- [ ] After handover: a `content_calendar` entry exists with the approved text, the entry id is on
      `campus_sessions.published_outputs` for a campus source, and an intent row is logged.
- [ ] `AiMessage.content` accepts content blocks; every existing caller still compiles; an image is
      encoded server-side and never round-trips through the browser.
- [ ] Newsletter and website appear as channels and are visibly unavailable — no half-working path.
- [ ] `publishing` config renders in Platform Settings; the settings governance gate is green.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` all green, and the
      space has been driven end to end against a real database (both source kinds).
- [ ] Doc trail complete: CHANGELOG, TRACEABILITY (`REQ-PUB-*` → `done`), DATA_DICTIONARY,
      AI_INTEGRATION (new workload + image input), MODULAR_COMPONENT_ARCHITECTURE §8 row, docs index,
      sprints README.

## Explicitly out of scope

- **The LinkedIn API connector.** Sprint 21 ends at approved copy plus copy-out and calendar handover.
  The connector is its own component behind the `ChannelConnector` port, with its own ADR (concept §10).
- **Newsletter and website generation.** The channels are visible because the space is built for them;
  enabling them is a later sprint and must need no `publishing` code change.
- **Any second linked source** (conference, initiative, podcast). One provider proves the contract; the
  second proves the seam, and that is Stage 2 deliberately.
- **Image generation, cropping, editing, or picking a hero image from the media library** for a linked
  source.
- **Scheduling and multi-language variants.**
- **Adding ad-hoc uploads to the media library** (concept §13 question 5 — deferred rather than
  resolved by coupling).
- **Autonomous posting of any kind.**

## Open decisions carried into the sprint

None are build blockers. Two are worth settling while building, because they are cheap now and
expensive later: **who is the publisher of record** when an approved draft turns out to be wrong (the
audit trail already names the approver — this is a policy statement, not code), and **which linked
source comes second**, since that choice decides how quickly Stage 2 proves the seam. The remaining
questions in concept §13 (media on the post, three variants or one, language, whether uploads join the
media library, whether `intake` becomes a source) are follow-ups by design.

## References

- Concept: `docs/PUBLISHING_SPACE_CONCEPT.md`
- Decision: `docs/ADR/0014-publishing-space.md`
- Toolbox: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`, ADR-0009
- Settings: `docs/PLATFORM_SETTINGS_CONCEPT.md`, ADR-0010
- Reuse seam precedent: ADR-0013, `sprints/sprint-20-podcast-opportunity-engine/`
- AI contract: `docs/AI_INTEGRATION.md`
- Design system: `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`, `docs/PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`
- Delivery process: `sprints/README.md`, ADR-0011

---

*Last reviewed: 2026-08-19.*
