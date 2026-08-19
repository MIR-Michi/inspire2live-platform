# docs: channel syndication concept (draft a LinkedIn post from an entity page)

- **Date:** 2026-08-19
- **Author:** Cursor cloud agent (for Michael Wittinger)
- **Type:** docs
- **Scope:** architecture / comms · campus · content
- **Links:** `docs/CHANNEL_SYNDICATION_CONCEPT.md` · REQ-SYN-001…004 (`planned`) · ADR-0014 (proposed, not written)

## Context

The request: a button that automatically creates a LinkedIn post from the content of a specific page
— for example a World Campus event page — designed to fit the modular kernel + component
architecture (ADR-0009) and the future component library rather than bolted onto one route. Concept
only; no implementation.

The material for such a post already exists on the campus record (`theme`, `summary`,
`decisions_for_publication`, `action_items_for_publication`, a presenter with a public LinkedIn URL,
and `meeting_summaries.publication_blurb`), and `content_calendar` already has `channels` including
`linkedin`, a `body_draft` field and a validated status lifecycle. The risk was building this as a
campus-specific button and then rewriting it for the next entity and the next channel.

## Change

Documentation only. No code, no migration, no schema change.

- **Added [`docs/CHANNEL_SYNDICATION_CONCEPT.md`](../CHANNEL_SYNDICATION_CONCEPT.md)** — the concept.
  Read §3 (the seam), §4 (architecture and why not just extend `content`), §5 (the extension point)
  and §8 (privacy) first; those carry the decisions. In short:
  - three separable concerns — the **source** (owned by the component that owns the record), the
    **drafting + human gate** (generic), the **delivery** (a channel adapter);
  - a new `syndication` component owns drafts, channel profiles and the AI workload and knows nothing
    about campus sessions; a kernel `PublishableSource`/`SourceProvider` contract plus a new optional
    `provides.sources` manifest field is the extension point, reconciled in CI in the spirit of
    ADR-0009 §10;
  - composition happens in one top-level `src/modules/syndication-registry.ts`, the same mechanism
    `settings-registry.ts` already uses, so `syndication` depends on no source owner and is liftable;
  - a channel is data (a profile) plus an optional connector — never a module, so there is no
    `modules/linkedin`;
  - one new table (`syndication_drafts`) with a soft, FK-free `source_id` (ADR-0013 §2 precedent);
    approved text hands over to `content_calendar` through `content`'s own action and provenance is
    written back to `campus_sessions.published_outputs` through the provider's `onPublished` hook;
  - the source payload is **curated, never scraped** — only publication-intended fields, consented
    names only, ingested text wrapped with `wrapExternalData()`; no transcript, WhatsApp digest,
    attendee list or internal comment reaches the model;
  - human approval is unconditional and deliberately not a setting; the LinkedIn API connector is
    deferred to its own component behind a `ChannelConnector` port.
- **`docs/README.md`** — index row for the new concept; freshness date bumped.
- **`docs/TRACEABILITY.md`** — new "Channel Syndication (proposed)" section with REQ-SYN-001…004 at
  status `planned` (no code location yet); freshness date bumped.
- **`CHANGELOG.md`** — `[Unreleased] → Documentation` entry.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — green: typecheck clean,
  lint 0 errors (1 pre-existing warning, `notifyConferenceContact` unused in
  `src/app/app/comms/conferences/actions.ts`, untouched by this change), 624 unit tests in 71 files
  passing, all 6 governance gates passing, production build succeeded. Run as the standing gate, not
  because Markdown can break it. `pnpm test:e2e` skipped — no runtime surface changed.
  (Dependencies were missing in the agent VM and installed with `pnpm install --frozen-lockfile` first.)
- No behavioral evidence to drive: nothing was implemented. The concept's factual claims about the
  current codebase were checked against the code rather than assumed — `content`'s manifest and
  `comms_integration_intents`/`logIntegrationIntent`, the `content_calendar` schema and transition
  table, the campus routes and their selected columns, `events`' and `content`'s `index.ts` (both
  still manifest-only scaffolds), `kernel/ai-client` (`runAiMessage`, `wrapExternalData`, workload
  policies), `kernel/manifest/types.ts`, `modules/settings-registry.ts`, the six `pnpm governance`
  test files, and the highest migration number on `main` (`00172`).

## Risk & rollback

Low — documentation only. Rollback is deleting the concept file and reverting four doc edits.
The concept itself carries the real risks it would introduce (§13), the largest being that a
"generic" design could still turn out campus-shaped; Stage 3 exists as the scheduled acid test.

## Follow-ups

- Decide the open questions in §13 (naming `syndication` vs `publishing`, media in the first slice,
  three variants vs one, language, publisher of record, whether `intake` becomes a source).
- Write `docs/ADR/0014-channel-syndication.md` from the §14 outline **if** the concept is accepted —
  an ADR records an accepted decision, so it is deliberately not created here.
- Stage 1 needs `events` to export a real public API function (`campusSessionSourceProvider`); its
  `index.ts` currently exports only the manifest, so the first slice also pays down a piece of the
  ADR-0009 Stage-1 modularisation debt.
