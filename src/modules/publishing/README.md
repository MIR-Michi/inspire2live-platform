# publishing

The Publishing space (ADR-0014): turns either a platform record **or** a dropped
screenshot plus one line of context into channel-ready copy, drafted through the
kernel AI client and approved by a human before anything leaves the building.

## What it owns

- `publishing_drafts` — one row per generated variant (`ai_body` is never
  overwritten; `body` carries human edits; supersede-on-regenerate).
- `publishing_sources` — ad-hoc sources (screenshot + description + rights
  answer) plus the private `publishing-uploads` storage bucket.
- Channel profiles as **data** (`domain/channels.ts`), keyed by the existing
  `CalendarChannel` vocabulary. LinkedIn is enabled; newsletter and website
  (`wordpress`) are declared and visibly unavailable.
- The gates: readiness (`domain/readiness.ts`), groundedness
  (`domain/claims.ts`), rights + lifecycle (`domain/rights.ts`). Human approval
  before handover is fixed in the domain layer and is deliberately **not** a
  setting.

## What it does not own

- **Sources.** A linked source is a curated payload its owning component
  exports as a `SourceProvider` (kernel contract, `@/kernel/publishing`).
  Composition happens in `src/modules/publishing-registry.ts` — this module
  imports no source owner. Its own `adhocSourceProvider` implements the same
  contract with no privileged path.
- **The calendar.** Approved copy becomes a `content_calendar` entry through
  `content`'s own `createCalendarEntry`; provenance is written back by the
  provider's `onPublished` hook inside the owning component.
- **Delivery.** Sprint 21 ends at copy-out + calendar handover; a real
  connector implements the kernel `ChannelConnector` port as its own component.

## Extending

Adding a source: export a `SourceProvider` from the owning component's
`index.ts`, declare it in that manifest's `provides.sources`, and import it in
`publishing-registry.ts`. The `governance-publishing-sources` gate fails when
the three drift. Enabling a channel: flip its profile to `enabled` in
`domain/channels.ts` — no new pipeline code.
