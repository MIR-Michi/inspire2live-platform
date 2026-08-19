# Sprint 21 — Tasks

> Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.
> See `sprints/README.md` for the workflow. Completed tasks remain in the sprint record.
> Concept: `docs/PUBLISHING_SPACE_CONCEPT.md` · Decision: `docs/ADR/0014-publishing-space.md`.
> **Sprint-wide guardrail:** `publishing` stays free of campus and channel-specific vocabulary and
> imports the kernel + `content@^1` only. A source is a curated payload, never a page read. Every
> tunable is manifest `config` — except human approval, which is fixed in the domain layer.

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S21-T01 | **Concept, decision record and sprint brief.** Publishing space concept in `docs/`, ADR-0014 recording the component + extension point + naming + the eight decisions, sprint brief and task list. | TBD | Completed | `docs/PUBLISHING_SPACE_CONCEPT.md`, `docs/ADR/0014-publishing-space.md`, this folder. |
| S21-T02 | **Kernel `publishing` contracts.** `PublishableSource`, `PublishableField`, `PublishableImage`, `SourceProvider`, `SourceCandidate`, `ChannelConnector`, `SourceContext`; pure `indexProviders` + `reconcileSources`; barrel export. No provider, no channel, no model call. | TBD | Completed | `src/kernel/publishing/`. Types + pure functions only — the kernel owns no component. |
| S21-T03 | **Manifest field `provides.sources`.** Add the optional `string[]` to `ComponentProvides`, extend `validateManifest`, and document it in `MODULAR_COMPONENT_ARCHITECTURE.md` §4. | TBD | Completed | Additive — no existing manifest changes meaning. |
| S21-T04 | **Kernel AI client: image input.** Widen `AiMessage.content` to `string \| AiContentBlock[]`, keep `buildMessageRequest` forwarding verbatim, add unit tests for both shapes, and confirm the workload's resolved model accepts images. | TBD | Completed | Additive; every existing caller must still compile. Encode server-side only. |
| S21-T05 | **AI workload registration.** Add `channel_post_draft` to `AiWorkloadId` + a policy row to `AI_WORKLOAD_POLICIES` with its recommendation and reasoning. | TBD | Completed | No model name in docs — the catalog in `models.ts` is the source of truth. |
| S21-T06 | **Migration — tables, RLS, bucket, constraint.** `publishing_drafts` + `publishing_sources` with RLS on both, the partial unique index for one live pending run per `(source_type, source_id, channel)`, the private `publishing-uploads` bucket with comms-gated storage policies and an image MIME allow-list, and the `comms_integration_intents.entity_type` check-constraint extension. | TBD | Completed | ≥ `00173`, verify against `main`. Bucket pattern: `00078_meeting_transcripts.sql`. |
| S21-T07 | **`publishing` domain — channels and gates.** Channel profiles keyed by `CalendarChannel` (LinkedIn enabled; newsletter/`wordpress` declared-not-enabled), `channelBudget`, `sourceReadiness`, the claims validator, source fingerprinting, and the rights gate that blocks handover. All pure and unit-tested. | TBD | Completed | `domain/channels.ts`, `readiness.ts`, `claims.ts`, `fingerprint.ts`. |
| S21-T08 | **`publishing` domain — drafting.** Prompt assembly (cached system prompt from channel profile + brand voice + banned phrases; fields wrapped with `wrapExternalData`; images as blocks), the JSON schema + validator, `generateDrafts` writing one row per variant, supersede-on-regenerate, and hard visible failure. | TBD | Completed | Injection rule stated for text **and** for text inside images. |
| S21-T09 | **`publishing` domain — lifecycle and handover.** `editDraft`, `approveDraft` (stamps approver, dismisses siblings), `dismissDraft`, `handOverApprovedDraft` calling `content`'s calendar action then the provider's `onPublished`, plus the integration-intent row. Approval gate enforced here, not in the UI. | TBD | Completed | `ai_body` never overwritten. |
| S21-T10 | **Ad-hoc source: upload + provider.** `createAdhocSource` (server action; image validation on size/MIME, storage write, `publishing_sources` row with the rights answer) and `adhocSourceProvider` implementing the same contract, with signed-URL reads. | TBD | Completed | Upload pattern: `uploadTranscript` + `signInboundMediaUrl`. |
| S21-T11 | **Campus session source provider.** `campusSessionSourceProvider` in `events` (publication-intended fields only, presenter as a `public` person, `listRecent`, `onPublished` writing `published_outputs`), exported from `events`' `index.ts` with `provides.sources` declared. | TBD | Completed | `events`' `index.ts` is manifest-only today — this is also Stage-1 modularisation debt paid down. |
| S21-T12 | **Registry + governance gate.** `src/modules/publishing-registry.ts` (providers, `resolveSource`, reconciliation) and a `governance-publishing-sources.test.ts` gate wired into `pnpm governance`. | TBD | Completed | Top-level `modules/*` file — the only place allowed to see both sides. |
| S21-T13 | **Kernel UI primitives.** An image drop zone (drag · click · paste · thumbnail · remove · keyboard-accessible) and a character ring, in `src/kernel/ui` with the Sprint 19 semantic tokens. | TBD | Completed | Built in the kernel, not the module: the next file-accepting feature needs them too. |
| S21-T14 | **The space UI — source step.** `PublishingShell` with the three-step canvas, two equally weighted entry tiles, the recent-candidate list composed from every provider's `listRecent`, the one-line ad-hoc form (image + description + rights chips), and the channel row with LinkedIn lit and the others visibly unavailable. | TBD | Completed | One decision visible at a time; one- or two-word labels. |
| S21-T15 | **The space UI — draft and approve steps.** Variant cards with angle, character ring, hashtag chips, claim marks revealing their source field, the image reading for ad-hoc sources, in-place editing with a divergence marker, approve, then copy / add-to-calendar with the rights tooltip. | TBD | Completed | Composes `ActionModal`, `CollapsibleCard`, `StatusBadge`, `PageSkeleton`. |
| S21-T16 | **Degraded states.** Nothing selected, not enough material, generating, provider error + retry, stale linked source, over budget after editing, rights not cleared, already approved, superseded run, AI flag off, component flagged off. | TBD | Completed | A design deliverable, not an afterthought — this is where "simple" usually breaks. |
| S21-T17 | **Route, nav and access.** `/app/comms/publishing` thin route + `error.tsx` + loading, `NavItem` in `COMMS_NAV_SECTIONS` **and** `MASTER_NAV`, new `NavIcon` key + SVG in `side-nav.tsx`. | TBD | Completed | Access already covered by the comms layout + middleware. |
| S21-T18 | **`PublishFromHere` entry point.** One UI surface mounted on the campus session page (and the campus month workspace) that deep-links into the space with the source pre-selected. | TBD | Completed | A link that skips step one — not a second implementation of the flow. |
| S21-T19 | **Manifest, config and settings panel.** `publishing` manifest with typed `config` (variants, brand voice, banned phrases, hashtag policy, source link, readiness threshold, upload ceiling, stale behaviour), `settingsPanel: true`, registry entry, `resolvePublishingConfig`, README; reword `content`'s manifest summary so "publishing" is unambiguous. | TBD | Completed | No setting may disable the approval gate. |
| S21-T20 | **Unit tests.** Readiness, channel budget, claims validation (including a fabricated `sourceFieldKey`), fingerprint staleness, source reconciliation (three failure modes), upload validation, the rights gate, approval-before-handover, supersede-on-regenerate, and `buildMessageRequest` with both content shapes. | TBD | Completed | `src/test/unit/publishing-*.test.ts`. |
| S21-T21 | **Doc trail.** CHANGELOG, `REQ-PUB-*` traceability rows to `done`, DATA_DICTIONARY (two tables + bucket), AI_INTEGRATION (workload + image input), MODULAR_COMPONENT_ARCHITECTURE §8 decomposition row, docs index, sprints README. | TBD | Completed | Same PR as the behaviour it documents (AGENTS.md §8). DATA_DICTIONARY §7/§8/§13, AI_INTEGRATION (image input + the drafting capability) and MODULAR_COMPONENT_ARCHITECTURE §4.1/§8 were written after the implementation commits, before the PR to `main`. |
| S21-T22 | **Verification.** `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build`, plus driving both source kinds end to end against a real database: campus session → draft → edit → approve → calendar entry → `published_outputs`; screenshot → draft → approve → copy. | TBD | In Progress | Static gates green. The space now runs against a live local database up to the drafting call: RLS, the source registry, the field-exposure limit and the readiness gate are **observed**, not just tested (see below). Everything downstream of the model call is still unexercised. |
| S21-T23 | **Saved posts (added scope, [ADR-0015](../../docs/ADR/0015-saved-posts.md)).** Migration `00174` `publishing_posts`; the `draft · ready to publish · published` status machine and its pure guards; save-from-variant, edit, picture attach/replace/remove, owner reassignment; the tile board on the space landing and the `/app/comms/publishing/posts/[id]` editor; handover moved from the draft to the post so the calendar receives post-approval edits. | TBD | Completed | Raised from use after T22's live run: the wizard could not be left half-finished, nothing stayed visible afterwards, approved copy could not be changed or pictured, and no one owned it. `publishing_drafts` stays the frozen calibration record — ADR-0015 §1. Static gates green; not yet driven against a live database, so it inherits T22's gap. |

## Sprint outcome

Every task above is implemented. The static verification gates are green, and the space has now been
driven against a live local database up to — but not including — the drafting call. The sprint should
not be called closed until a real model call and the handover write-back have been watched happening.

That live run also produced the sprint's one piece of added scope, T23: a wizard with no saved artifact
behind it cannot be left half-finished, and approved copy that cannot be edited, pictured or owned is
not what the work actually needs. `publishing_posts` (ADR-0015) answers that without touching what makes
`publishing_drafts` an honest calibration record. Its verification is static only — see the gap below,
which it shares.

### Verification table

| Gate | Result | Note |
|---|---|---|
| `pnpm typecheck` | Pass | A stale `.next/types/validator.ts` from an earlier build reports phantom errors for deleted routes — clear `.next` before trusting a local run. |
| `pnpm lint` | Pass | One pre-existing warning in `comms/conferences/actions.ts` (`notifyConferenceContact` unused), unrelated to this sprint. |
| `pnpm test` | Pass — 695 tests after T23 (679 at T22) | The Windows-only `governance-dead-code.test.ts` failure recorded at T22 — the scan built `'@/' + relative(...)`, which yields backslash paths that match no import and flagged every file under `lib`/`components` as an orphan — was **fixed** in T23 by normalising to POSIX separators, so the gate now runs on Windows too. The `conferences.test.ts > toIsoDate` failure also recorded at T22 no longer reproduces on the same machine (`Date.parse('September 2026')` resolves as UTC in V8, so there is nothing timezone-dependent left to slip); the whole suite is green locally on Windows/UTC+2. |
| `pnpm governance` | Pass | Includes the new `governance-publishing-sources` reconciliation gate. |
| `pnpm build` | Pass | `/app/comms/publishing` present in the route table. |
| Coverage thresholds | Pass — 64.06% lines, 63.8% functions against a 60% floor | `publishing`'s own domain sits at 61.32% statements / 55% functions and is what consumes most of the headroom. Its Supabase query and config layers were **not** added to the coverage exclusions the way Sprint 20's equivalents were — worth revisiting rather than letting the global number drift toward the floor. |
| Migration `00173` | Applies cleanly per CI | Validated by the `db-migrations` workflow against a throwaway Postgres. No numbering conflict: `main` ends at `00172`. |

### Observed against a live database

A local Supabase stack (all 173 migrations applied from scratch, seed included) was driven through the
space in a real browser, signed in as a `Comms` profile. What was **watched happening**, rather than
asserted in a unit test:

| Claim | How it was observed |
|---|---|
| Migration `00173` applies to a real database | `supabase db reset` from empty; both tables, the partial unique index and the private bucket present afterwards |
| RLS is the enforcement, not the UI | Impersonating `authenticated` with a `Comms` claim: insert and select succeed. Same statements with a `Clinician` claim: select returns zero rows, insert fails with `new row violates row-level security policy`. As `anon`: zero rows. All inside a transaction that was rolled back |
| The rights vocabulary is enforced in the database | An invented `rights_status` is refused by `publishing_sources_rights_status_check` |
| The source registry resolves a linked source | The picker lists the campus session with its provider label ("World Campus session") and date; selecting it routes to `?sourceType=campus_session&sourceId=…` |
| Only publication-intended fields reach the space | The source card lists exactly Theme, Session summary, Decisions for publication, Action items for publication, Participating hubs. No transcript, attendee list or WhatsApp digest appears anywhere in the rendered page |
| The readiness gate refuses rather than invents | A session carrying 37 characters shows "Not enough to work with yet … but only 37 characters of material (needs 120)" with an *Add material* link, and **no Draft button at all**. The 491-character session offers Draft |
| Channel availability is real | LinkedIn is lit and selectable; Newsletter and Website render disabled |

Watching the dev-server query log during that run caught something no unit test would have: the campus
provider reached the publication blurb through `loadCampusSessionTranscript`, whose select carries
`extracted_text`, so **the full raw transcript was being read into the publishing page's render** to
obtain one field it does not even come from. Nothing leaked — the raw text never entered the payload,
so it could not reach a model — but the curation only held at the payload, not at the query. Replaced
with a narrow `loadCampusSessionPublicationBlurb` that selects `id, created_at` from the transcript and
`publication_blurb` from the summary, mirroring the panel's choice of the latest pending-or-saved
summary. Confirmed in the query log: the publishing render now issues
`meeting_transcripts?select=id,created_at` and no `extracted_text` at all. The wider loader stays where
the full view is genuinely needed — the campus month and session detail pages.

### The honest gap

**Everything downstream of the drafting call is still unexercised**, because the model call has not been
made against a live key. That leaves untested by observation: draft generation itself, prompt quality,
the groundedness validator on real output, image reading for a real screenshot, the edit and approval
gates, the rights gate at handover, and the write-back into `content_calendar` / `published_outputs`.
The ad-hoc screenshot path has not been driven at all — no file has been through the private bucket.

Two local-environment notes for whoever picks this up. `supabase/config.toml` sets
`auth.email.enable_signup = false`, and the CLI maps that to `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`,
which disables **all** email logins locally — password *and* magic link — so signing in against a local
stack requires flipping it temporarily. On Windows the analytics container also needs the Docker daemon
on TCP 2375, or `supabase start` never reaches a healthy state.

### Note on delivery

The first PR for this branch ([#188](https://github.com/MIR-Michi/inspire2live-platform/pull/188))
was opened against the concept branch rather than `main`, so `ci.yml` — which only triggers for pull
requests based on `main` or `develop` — never ran on it. When the concept PR was closed and its
branch deleted, GitHub auto-closed #188. No review or failing check was involved. Stacking a sprint
PR on a concept PR costs the sprint its entire CI run; base sprint branches on `main`.
