# ADR-0014: Publishing is a component with a source-provider extension point, not a per-channel feature

- **Status:** accepted
- **Date:** 2026-08-19
- **Owners:** @michaelwittinger-prog
- **Concept:** `docs/PUBLISHING_SPACE_CONCEPT.md`
- **Delivery:** `sprints/sprint-21-publishing-space/`

## Context

The request is a **Publishing space** that will eventually produce LinkedIn posts, newsletters and
website articles, starting with the LinkedIn post. Its source must be flexible: sometimes a record the
platform already owns (a World Campus session), sometimes just a screenshot plus a line of context.
The copy is generated through the platform's own AI layer, and a human approves it.

There are two obvious cheap implementations, and both are traps:

1. **A button on the campus page** that calls a model and writes a post. It serves exactly one entity
   and one channel, cannot serve the screenshot case at all, and will be rewritten for every
   subsequent source.
2. **A `linkedin` module.** It looks modular and is not: the next channel repeats the whole pipeline,
   and the reusable machinery — assemble source material, draft, review, approve, hand over — ends up
   duplicated per channel with slightly different behaviour each time.

Three forces pull on the decision:

- **ADR-0009 §9.** A component may import the kernel and other components' `index.ts` only, no
  cross-component FKs except into the identity spine, and every component must be feature-flaggable
  and — in the target state — extractable. A drafting engine that imports every entity owner satisfies
  none of that.
- **ADR-0013's precedent.** The Podcast Opportunity Engine was split along its reuse seam (`network`
  generic, `podcast-planning` editorial) rather than shipped as one module. The same seam exists here,
  one layer up: *turn a thing into channel-shaped copy* is generic advocacy infrastructure; *what the
  things are* is ours.
- **The flexible-source requirement makes the seam unavoidable.** A screenshot has no owning
  component, so the pipeline cannot assume its input is a database row it can join to. Something has
  to define "source material" abstractly. Once that abstraction exists, per-entity code paths stop
  being necessary — so the cheap implementation is not even the simple one.

## Decision

### 1. One generic component, `publishing`, plus a kernel contract

`src/modules/publishing` owns the space, the drafts, the ad-hoc sources, the channel profiles, the AI
workload and the review UI. `src/kernel/publishing` holds the `PublishableSource` / `SourceProvider` /
`ChannelConnector` types and pure reconciliation helpers — types owned by no component (ADR-0009 §7).

The component is named for the space and the product vocabulary. `content` keeps the editorial
calendar, the media library and the integration-intent log; its manifest summary is reworded so
"publishing" is no longer ambiguous between the two.

### 2. A source is a declared, curated payload — never a page read

Each component that can be a source exports a `SourceProvider` and declares it in its manifest through
a new optional `provides.sources: string[]` field on `ComponentProvides`. A provider returns a
`PublishableSource`: labelled fields classified as `copy` or `fact`, optional images, consented people
only, a review href, and a fingerprint.

This is a privacy and safety decision as much as an architectural one. The alternative — "read the
page" — would send meeting transcripts, WhatsApp digests, task assignments and internal comments to a
model because they happen to render on the same screen. The owning component is the only place that
knows which of its columns are publication-intended, so the curation lives there.

### 3. An uploaded screenshot is a source, not a second code path

`publishing` owns `publishing_sources` (description + images + rights answer) and serves it through
`adhocSourceProvider`, which implements the same contract as every other provider. The drafter has one
input shape. "Flexible sources" therefore costs one provider rather than a fork through the pipeline,
and the ad-hoc path gets the readiness gate, the groundedness contract and the approval gate for free.

### 4. Composition happens in a top-level registry file, so the drafter depends on no source owner

`src/modules/publishing-registry.ts` imports the kernel and every provider and resolves a `sourceType`
to a provider — the same role `src/modules/settings-registry.ts` already plays for settings panels.
`publishing` receives an already-resolved plain-data payload and imports no source owner; `events`
imports nothing from `publishing`. The app-layer server action does the wiring, as
`src/app/app/comms/intake/ai-actions.ts` already does for intake AI.

Consequence: `reconcileSources` becomes a governance check — declared `provides.sources` ↔ registered
providers ↔ `ownedBy` — in the spirit of ADR-0009 §10.

### 5. A channel is data plus an optional connector, never a module

A channel profile (character budget, hook convention, link handling, hashtag policy, markdown
allowance) is data in `publishing`'s domain, keyed by the **existing** channel vocabulary
(`CalendarChannel` in `src/lib/comms-workflow.ts`). "Website article" is the existing `wordpress`
channel; no second vocabulary is introduced. Delivery is a `ChannelConnector` port; the LinkedIn API
connector is deferred and, when built, is its own component so a generated platform without LinkedIn
simply registers no connector.

### 6. Approved copy hands over to `content_calendar`; provenance is written back by the owner

`handOverApprovedDraft` calls `content`'s own action to create the calendar entry (ADR-0009 §9 rule 3)
and then calls the provider's optional `onPublished` hook, so writing
`campus_sessions.published_outputs` happens inside `events`. There is no second publishing path and no
cross-module write.

### 7. `source_id` carries no foreign key

`publishing_drafts.source_id` is a `uuid` with no FK, because it points at whichever component owns the
source (ADR-0009 §9 rule 4, and the same call ADR-0013 §2 made for
`podcast_question_candidates.person_id`). Integrity is enforced by the owning component's domain
actions and a repairable read path. FKs into the identity spine (`profiles`) stay normal FKs.

### 8. Human approval is unconditional and not configurable

Every tunable in this feature is manifest `config` — variants per run, brand voice, banned phrases,
hashtag policy, the readiness threshold, the upload ceiling — with one deliberate exception: whether a
human must approve before handover. That is fixed in the domain layer. A setting that turned it off
would be the one setting capable of publishing an unreviewed model output in the organisation's name
(AGENTS.md §6).

### 9. The kernel AI client is widened for image input, additively

`AiMessage.content` becomes `string | AiContentBlock[]` so a screenshot can be sent. `string` stays
valid and `buildMessageRequest` already forwards `messages` verbatim, so no existing caller changes.
The image is read from private storage and encoded server-side. Prompt-injection defence is stated for
both modalities: delimited text **and** text legible inside an image are content to describe, never
commands to follow.

## Consequences

**Positive**

- The second source type and the second channel are additive: a provider plus three lines of wiring,
  or a channel profile — no drafting code.
- The screenshot case is served by the same pipeline as the record case, including its safety gates.
- `publishing` is extractable: it depends on the kernel and `content@^1` only.
- What can be published from becomes structured, machine-readable data (`provides.sources`) — a catalog
  fact for the L1 wizard and the L2 generator rather than tribal knowledge.
- No second publishing path: the approved text lands in the calendar that already owns the lifecycle.

**Negative / accepted costs**

- A kernel type change and a new manifest field, both additive but both touching shared surface.
- `publishing_drafts.source_id` has no database-level referential integrity.
- One more component, one more settings panel, one more registry file for a single product surface —
  accepted, because the split is along the seam the flexible-source requirement forces anyway.
- Two new UI primitives (image drop zone, character ring) must be built in the kernel rather than
  borrowed; the design system has no file-input or drawer primitive today.
- An ad-hoc upload duplicates part of what the media library is for; deliberately deferred (concept
  §13 question 5) rather than resolved by coupling now.

**Neutral**

- Gated by the existing `comms_team` flag, so absence is a clean state.
- Stage 2 of ADR-0009 (physical schema move) applies exactly as to every other component; the manifest
  already declares `publishing` as its target schema.

## Alternatives considered

- **A button on the campus page.** Rejected: serves one entity and one channel, cannot serve the
  screenshot case, and guarantees the pipeline is written again for the next source.
- **A `linkedin` module (and later a `newsletter` module).** Rejected: duplicates the machinery per
  channel and welds it to a vendor. A channel is data.
- **Extend `content`.** Rejected: it would weld the reusable transformation to the Inspire2Live
  editorial calendar. `content` is the destination — a clean one-directional dependency (concept §4.5).
- **Put the drafting in `ai-features`.** Rejected: `ai-features` owns AI *data*; a workload belongs to
  the component whose data it enriches (ADR-0009 §7).
- **Read the rendered page / accept a free-text blob from the client.** Rejected on privacy and safety:
  the page aggregates material that must never be sent to a model, and a client-supplied payload would
  make the RLS-protected curation bypassable.
- **Two code paths, one for records and one for uploads.** Rejected: the ad-hoc path would drift out of
  the readiness, groundedness and approval gates precisely because it is the quick one.
- **Store variants as a JSON blob on one draft row.** Rejected: per-variant editing, approval and audit
  are the point; rows make that trivial and a blob makes it a rewrite.

## References

- `docs/PUBLISHING_SPACE_CONCEPT.md` — the concept, with the data model, UX and rollout
- ADR-0009 — modular component architecture (§6 data contracts, §7 kernel, §9 contract rules, §10 governance)
- ADR-0010 — Platform Settings space (manifest `config` → settings panel)
- ADR-0013 — splitting along the reuse seam; soft cross-component references
- ADR-0006 — Communications Workspace (the space this sits in)
- `docs/AI_INTEGRATION.md` — the kernel AI client contract and the human-in-the-loop rule
- `sprints/sprint-21-publishing-space/` — delivery
