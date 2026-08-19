# Channel Syndication — Concept

> **What it is:** one button on an entity page — *"Draft a LinkedIn post"* — that turns a record the
> platform already holds (first: a World Campus session) into a reviewable, human-approved post, and
> hands the approved text to the existing content calendar.
> **Status:** concept only. Nothing is implemented; no migration, no table, no module exists yet.
> **First adopter:** the World Campus session (`/app/comms/campus-log/sessions/[id]`, and the month
> workspace `/app/comms/campus/[year]/[month]`).
> **Proposed owning module:** a new `src/modules/syndication` + one new kernel contract, with
> per-component **source providers** as the extension point.
> **Decision record:** ADR-0014 (outlined in §14, to be written if this is accepted).
> **Architecture it must fit:** [`MODULAR_COMPONENT_ARCHITECTURE.md`](MODULAR_COMPONENT_ARCHITECTURE.md)
> (ADR-0009), [ADR-0010](ADR/0010-platform-settings-space.md), [ADR-0013](ADR/0013-opportunity-engine-components.md),
> [`AI_INTEGRATION.md`](AI_INTEGRATION.md).

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [Scope boundary](#2-scope-boundary)
3. [The seam: what is generic and what is ours](#3-the-seam-what-is-generic-and-what-is-ours)
4. [Architecture](#4-architecture)
5. [The extension point in detail](#5-the-extension-point-in-detail)
6. [Data model](#6-data-model)
7. [The AI workload](#7-the-ai-workload)
8. [Privacy, consent and access](#8-privacy-consent-and-access)
9. [The user flow](#9-the-user-flow)
10. [Publishing: three options compared](#10-publishing-three-options-compared)
11. [Rollout](#11-rollout)
12. [Governance and verification impact](#12-governance-and-verification-impact)
13. [Risks and open questions](#13-risks-and-open-questions)
14. [Proposed ADR-0014 (outline)](#14-proposed-adr-0014-outline)
15. [What already exists that this builds on](#15-what-already-exists-that-this-builds-on)

---

## 1. Why this exists

Every month the World Campus meeting produces exactly the material a LinkedIn post is made of: a
theme, a summary, decisions marked *for publication*, action items marked *for publication*, a named
presenter with a public LinkedIn profile, and an AI meeting summary that already contains a field
called `publication_blurb`. That material is written down, in the platform, by the person who ran the
meeting.

And then somebody retypes it into LinkedIn.

| | Today | With this |
|---|---|---|
| Getting from meeting to post | Re-read the session record, rewrite it by hand in the LinkedIn composer | One button on the session page produces a draft in the platform's voice |
| Who can do it | Whoever writes well and knows the meeting | Anyone on the comms team; the draft is the starting point, not the skill |
| Provenance | None — the post and the record are unrelated artifacts | The draft records which fields it came from and which record it belongs to |
| Consistency | Depends on the author and the day | One channel profile (length, hook, hashtags, tone) applied every time |
| Reuse for the newsletter | Rewrite again | Same source, second channel, no new code |
| Whether it went out | Remembered, or a checkbox | The approved text becomes a `content_calendar` entry with the existing status lifecycle |

The point of the button is **not** that AI writes better copy than a human. It is that the distance
between "the platform knows what happened" and "something publishable exists" collapses from a
retyping job to a review job — and that the review stays a review, with an editable draft and a
human approval before anything leaves the building.

There is a second, architectural reason to build it deliberately rather than as a button. "Turn a
record into channel-shaped copy, have a human approve it, hand it to a channel" is generic advocacy
infrastructure — it is the same shape for a campus session, a conference report, an initiative
milestone, a podcast episode, and the same shape for LinkedIn, a newsletter and the website. Built
once as a component with a declared extension point, the second entity and the second channel cost
configuration instead of code. Built as a button on the campus page, we will write it five times.
ADR-0013 made exactly this call for the Podcast Opportunity Engine; this concept applies the same
reasoning one layer up.

---

## 2. Scope boundary

**In scope**

- A generic capability: *entity record → channel-shaped draft → human review → approval → handover*.
- One source provider: the World Campus session (`campus_sessions`), including the "which fields may
  be published" question.
- One channel profile: LinkedIn (length, single-link convention, hashtag policy, no markdown, hook
  first line).
- Storage of drafts with full provenance, a supersede-on-regenerate rule, and an audit trail of who
  approved what.
- Handover into the existing `content_calendar` (channel `linkedin`, `body_draft`) and the existing
  `campus_sessions.published_outputs` back-reference.
- The extension mechanism that makes a second entity type and a second channel additive.

**Explicitly out of scope**

- **Publishing to LinkedIn through their API.** Phase 1 ends at an approved draft plus copy-out; the
  connector is §10 / §11 Stage 4 and is its own component when it happens.
- **Scraping the rendered page.** The draft is built from a curated, declared payload the owning
  component hands over — never from the DOM, never from "everything on the page" (§8).
- **Autonomous posting.** Nothing is published without a human approving the exact text.
- **Image generation and media selection beyond linking an existing `media_assets` row.**
- **Multi-language variants.** Noted as a risk (§13); the first slice is one language.
- **A new nav entry or workspace.** This capability mounts inside pages that already exist.
- **A physical `tenant_id`.** Same reasoning as ADR-0013 §3: deferred to ADR-0009 Stage 4.

---

## 3. The seam: what is generic and what is ours

Three concerns hide inside "a LinkedIn button on the campus page". Keeping them apart is the whole
design; collapsing them is the failure mode.

| Concern | Question it answers | Who must own it |
|---|---|---|
| **The source** | What may be said publicly about this record, and which fields say it? | The component that owns the record — `events` for a campus session. Only it knows which columns are publication-intended and which are internal. |
| **The drafting and the gate** | How does a source become channel-shaped copy, get reviewed, edited and approved? | Generic. No entity vocabulary, no channel vocabulary — the new `syndication` component. |
| **The delivery** | How does approved text reach LinkedIn (or a newsletter, or the website)? | A channel adapter. Today: the human copies it out and the existing stub logs the intent. Later: its own connector component. |

Two consequences follow, and they are the load-bearing decisions of this concept.

**A channel is data, not a module.** There must never be a `src/modules/linkedin`. LinkedIn is a
*profile* (max length, hashtag convention, one-link-in-post, hook-first) plus, eventually, an
*adapter*. The channel vocabulary already exists in code as
`CalendarChannel = 'linkedin' | 'newsletter' | 'wordpress' | 'podcast' | 'youtube'`
(`src/lib/comms-workflow.ts`) and as `IntegrationTarget` in
`src/modules/content/domain/comms-integrations.ts`. We consume that vocabulary; we do not invent a
second one.

**An entity page is not a source.** The generic half must not know what a campus session is, and the
`events` component must not know that LinkedIn exists. They meet through a declared contract and a
composition file that is allowed to see both — the mechanism §5 describes, which is the same one
`src/modules/settings-registry.ts` already uses to bind kernel settings to the live component
catalog.

---

## 4. Architecture

### 4.1 The pieces

| Piece | Where | What it is |
|---|---|---|
| **Syndication contracts** | `src/kernel/syndication/` | The `PublishableSource` / `SourceProvider` / `ChannelConnector` types and the pure composition helpers. Types and reconciliation only — no provider, no channel, no model call. Kernel because it is owned by no component (ADR-0009 §7). |
| **`syndication` component** | `src/modules/syndication/` | Owns drafts and their lifecycle, the channel profiles, the AI drafting workload, the review UI, and the handover to `content`. Knows nothing about campus sessions. |
| **Source providers** | inside each owning component, e.g. `src/modules/events/domain/syndication-sources.ts` | The curated publishable payload for one entity type, exported through that component's `index.ts`. |
| **The registry** | `src/modules/syndication-registry.ts` | The single top-level composition file allowed to import both the kernel and every component — exactly like `registry.ts` and `settings-registry.ts`. Resolves a `sourceType` to its provider. |
| **The mount** | existing routes, e.g. `src/app/app/comms/campus-log/sessions/[id]/page.tsx` | Renders `syndication`'s UI surface with `sourceType` + `sourceId`, and posts to a thin app-level server action. |

### 4.2 Dependency directions (why the boundary holds)

```
events ──provides──▶ campusSessionSourceProvider ─┐
initiatives ─────────▶ (later providers)          │
                                                  ▼
                            src/modules/syndication-registry.ts
                                (the only file that sees both)
                                                  │  resolved PublishableSource
                                                  ▼
        syndication ──generates draft──▶ syndication_drafts ──approved──▶ content (calendar)
             │                                                                │
             └── kernel: ai-client · identity · rbac · data · settings         └── existing LinkedIn
                                                                                 stub / future connector
```

- `syndication` **does not** depend on `events`, `initiatives` or any future source owner. It receives
  an already-resolved, plain-data `PublishableSource`. This is what makes it liftable into a second
  platform, and it is why the registry — not the module — does the resolving.
- `events` **does not** depend on `syndication`. It exports a provider shaped by a kernel type. If
  `syndication` is flagged off, `events` is unaffected and the provider is simply never called.
- `syndication` **does** declare `dependsOn.components: ['content@^1']`, one direction only, for the
  handover. That mirrors `podcast-planning`'s `handOverToContentCalendar` — an approved thing becomes
  a calendar item through the calendar owner's own write path (ADR-0009 §9 rule 3), never a direct
  insert.
- Writing provenance back onto the source record (`campus_sessions.published_outputs`) goes through
  the provider's optional `onPublished` hook, so the write still happens inside the owning
  component. Rule 3 again, and it is why that hook exists rather than a cross-module update.

### 4.3 Illustrative manifest

Sketch, not final — the shape matters, the field values do not.

```ts
// src/modules/syndication/manifest.ts (illustrative)
export const manifest = defineManifest({
  id: 'syndication',
  version: '1.0.0',
  title: 'Channel Syndication',
  summary:
    'Turns a record the platform already holds into a channel-shaped draft post, keeps the draft under human review, and hands the approved text to the content calendar.',
  surface: 'internal',
  data: {
    schema: 'syndication',
    tablePrefix: 'syndication_',
    tables: ['syndication_drafts'],
    migrations: ['00173'], // ≥ 00173; verify against main at implementation time
  },
  provides: {
    api: [
      'CHANNEL_PROFILES', 'channelProfile',
      'generateDraft', 'loadDrafts', 'loadDraft',
      'editDraft', 'approveDraft', 'dismissDraft', 'handOverApprovedDraft',
      'sourceReadiness', 'resolveSyndicationConfig',
    ],
    events: ['syndication.draft.approved'],
    ui: ['DraftPostButton', 'DraftReviewDrawer'],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'ai-client', 'data', 'settings', 'syndication'],
    components: ['content@^1'],
  },
  featureFlag: 'comms_team',
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  config: {/* §4.4 */},
  operations: ['draft-post'],
})
```

### 4.4 Operator-tunable config (ADR-0010)

Typed `config` fields render as a Platform Settings panel with no bespoke form code, and are the
fields a blueprint would set per tenant. Candidates:

| Key | Type | Why it is a setting and not a constant |
|---|---|---|
| `variantsPerRun` | number (default 3) | Three angles is a guess about how much choice helps a reviewer; it should be tunable without a deploy. |
| `brandVoice` | text | The one place the organisation's voice is written down, instead of a string literal in a prompt. |
| `bannedPhrases` | text | House style enforced as data ("breakthrough", "game-changer", disease claims). |
| `hashtagPolicy` | enum `none · suggest · fixed` | Different organisations have opposite conventions. |
| `fixedHashtags` | string | Used when the policy is `fixed`. |
| `includeSourceLink` | boolean | Some records have no public URL to link to. |
| `minimumSourceCharacters` | number | The readiness gate in §7.4 — below this we refuse to draft rather than invent. |
| `staleDraftBehaviour` | enum `warn · block` | What happens when the source changed after the draft was generated. |

**Deliberately not a setting:** whether a human must approve before handover. That gate is
unconditional in the domain layer. A switch that turns it off would be the one setting capable of
publishing an unreviewed model output in the organisation's name (AGENTS.md §6: AI output is a draft
until a human confirms it).

### 4.5 Why not simply extend `content`?

`content`'s manifest summary already says "outbound publishing/integration intents", so this is a
fair question and the honest answer has two halves.

- **What belongs in `content`:** the calendar, the status lifecycle, the channels, `body_draft`, the
  integration intents. All of that is reused as-is. This concept adds **nothing** to the calendar
  model and creates no second publishing path.
- **What does not:** the *generic transformation* — a provider registry, entity-agnostic
  source payloads, a groundedness contract, an AI workload, and a review gate. Folding that into
  `content` would weld the reusable half to the Inspire2Live editorial calendar, which is the exact
  entanglement ADR-0009 exists to prevent and the exact call ADR-0013 already made once. `content`
  is the *destination* of this pipeline, and being a destination is a clean, one-directional
  dependency.

A second alternative — put the drafting in `ai-features` — is rejected because `ai-features` is the
component for AI *data* (settings, usage log, org feed, meeting summaries); a workload belongs to the
component whose data it enriches (ADR-0009 §7). The AI *client* stays kernel, as it is today.

---

## 5. The extension point in detail

This is the part that decides whether the second entity type costs a day or a rewrite.

### 5.1 The declaration

A component that can be a source says so in its manifest:

```ts
// src/modules/events/manifest.ts (addition, illustrative)
provides: {
  api: [/* … */, 'campusSessionSourceProvider'],
  sources: ['campus_session'],          // NEW optional field on ComponentProvides
}
```

`provides.sources` is a new optional `string[]` on `ComponentProvides` in
`src/kernel/manifest/types.ts`. It is additive — no existing manifest changes meaning — and it is
what makes the capability legible to the L1 catalog and the L2 generator: "which of this platform's
records can be syndicated" becomes structured data rather than a grep.

### 5.2 The contracts

```ts
// src/kernel/syndication/types.ts (illustrative)

/** A single piece of source material, classified by how the drafter may use it. */
export type PublishableField = {
  key: string                    // 'summary' | 'decisions_for_publication' | …
  label: string                  // shown in the review UI as provenance
  value: string
  /** 'copy' = prose the drafter may paraphrase. 'fact' = a short value it may state verbatim, never embellish. */
  intent: 'copy' | 'fact'
}

/** Everything the drafter is allowed to know about one record. Curated by the owner. */
export type PublishableSource = {
  sourceType: string             // 'campus_session'
  sourceId: string
  title: string
  occurredAt: string | null
  /** Internal href so a reviewer can verify the draft against the record. */
  reviewHref: string
  /** Public URL to link in the post, when one exists. */
  publicUrl?: string | null
  fields: PublishableField[]
  people?: Array<{ name: string; role?: string; consent: 'public' | 'granted' }>
  links?: Array<{ label: string; url: string }>
  media?: Array<{ mediaAssetId?: string; url?: string; alt: string }>
  /** Hash over the above — the staleness signal (§6). */
  fingerprint: string
}

export type SourceProvider = {
  sourceType: string
  label: string                  // 'World Campus session'
  ownedBy: string                // component id — reconciled against the manifest
  load(ctx: SourceContext, sourceId: string): Promise<PublishableSource | null>
  /** Optional: record provenance on the source record, through the owner's own write path. */
  onPublished?(ctx: SourceContext, sourceId: string, calendarEntryId: string): Promise<void>
}

/** The delivery port. Phase 1 ships only the manual one; a real connector implements the same port. */
export type ChannelConnector = {
  channel: string                // matches the content channel vocabulary
  deliver(text: string, meta: DeliveryMeta): Promise<DeliveryResult>
}
```

### 5.3 The registry

```ts
// src/modules/syndication-registry.ts (illustrative)
import { campusSessionSourceProvider } from '@/modules/events'
import { componentManifests } from '@/modules/registry'
import { indexProviders, reconcileSources } from '@/kernel/syndication'

const PROVIDERS = [campusSessionSourceProvider]

export function allSourceProviders() { return indexProviders(PROVIDERS) }
export function sourceReconciliation() { return reconcileSources(componentManifests, PROVIDERS) }
export async function resolveSource(ctx: SourceContext, sourceType: string, sourceId: string) { … }
```

Three properties make this the right mechanism rather than a clever one:

1. **It already exists in this codebase.** `settings-registry.ts` composes kernel panels with every
   component's panel in one top-level file; this is the same shape for a different contract. No new
   framework, no runtime plugin loader — ADR-0009 §13 explicitly rules those out.
2. **Adding a source touches three lines** — a provider function, one manifest entry, one registry
   import — and no `syndication` code at all.
3. **It is checkable.** `reconcileSources` compares declared `provides.sources` against registered
   providers and their `ownedBy`, so a provider nobody declared, a declaration nobody implements, and
   a provider claiming a component it does not belong to are all failures, not surprises (§12).

### 5.4 The host page

The host page stays thin and gains no knowledge of channels or AI:

```tsx
// src/app/app/comms/campus-log/sessions/[id]/page.tsx (illustrative addition)
<DraftPostButton sourceType="campus_session" sourceId={session.id} channel="linkedin" />
```

`DraftPostButton` is `syndication`'s UI surface. It posts to a thin app-level server action
(`src/app/app/comms/syndication/actions.ts`) that resolves the provider through the registry and
calls `syndication`'s public `generateDraft(source, channel)`. That split — composition in the app
layer, logic in the module — is how `src/app/app/comms/intake/ai-actions.ts` and
`integration-actions.ts` already work.

---

## 6. Data model

**One new table.** Everything else reuses what exists.

```sql
-- supabase/migrations/000NN_syndication_component.sql (illustrative; ≥ 00173)
create table if not exists public.syndication_drafts (
  id uuid primary key default gen_random_uuid(),

  -- Soft reference to the source record: no FK across component boundaries (ADR-0009 §9 rule 4).
  source_type        text not null,           -- registry source id, e.g. 'campus_session'
  source_id          uuid not null,
  source_fingerprint text not null,           -- staleness detection
  source_fields      jsonb not null default '[]'::jsonb,  -- exactly what was sent, for provenance

  channel  text not null,                     -- content channel vocabulary ('linkedin', …)
  run_id   uuid not null,                     -- groups the variants of one generation
  angle    text,                              -- 'the decision', 'the person', 'the invitation'

  body      text not null,                    -- current text (human edits land here)
  ai_body   text not null,                    -- untouched model output, for calibration (§11 Stage 5)
  hashtags  text[] not null default '{}',
  claims    jsonb not null default '[]'::jsonb, -- claim → source field key (§7.3)

  status text not null default 'pending' check (
    status in ('pending','approved','dismissed','superseded','published')
  ),

  -- AI provenance
  workload text, model text, effort text, prompt_version text,
  raw_response jsonb,

  -- handover + audit
  content_calendar_id uuid,                   -- soft link, set at handover
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.syndication_drafts enable row level security;

drop policy if exists syndication_drafts_comms on public.syndication_drafts;
create policy syndication_drafts_comms on public.syndication_drafts
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());
```

**Design notes**

- **Variants are rows, not JSON.** A reviewer edits one variant and approves it; rows make the edit,
  the approval and the audit trail per-variant without rewriting a blob. `run_id` groups them.
- **`ai_body` is never overwritten.** The distance between `ai_body` and the approved `body` is the
  only honest measure of whether the drafting is any good, and it is what Stage 5 calibrates against
  — the same reasoning that made `podcast_candidate_scores` a snapshot table.
- **Supersede on regenerate**, matching `intake_ai_suggestions`: a partial unique index keeps at most
  one live `pending` run per `(source_type, source_id, channel)`; regenerating marks the previous run
  `superseded` rather than deleting it.
- **`source_fingerprint`** is hashed over the resolved payload. If the session summary is edited after
  a draft was generated, the review UI says the draft is stale and offers a regenerate — behaviour
  governed by the `staleDraftBehaviour` setting.
- **No FK on `source_id`.** Referential integrity is the owning component's job through its domain
  actions, exactly as ADR-0013 §2 decided for `podcast_question_candidates.person_id`. FKs into the
  identity spine (`profiles`) stay normal FKs — rule 4 permits precisely that.
- **One `ALTER` on an existing table:** `comms_integration_intents.entity_type`'s check constraint
  gains `'syndication_drafts'` so a delivery intent can point at the draft it came from. The intents
  table stays `content`-owned; nothing is duplicated.
- **Typed access without `(supabase as any)`:** declare the row shape in
  `src/modules/syndication/domain/schema.ts` and use `moduleClient<SyndicationDatabase>()` from
  `@/kernel/data`, as `podcast-planning` does, until `src/types/database.ts` is regenerated.

**Status lifecycle**

```
pending ──edit──▶ pending ──approve──▶ approved ──handover──▶ published
   │                                       │
   ├──dismiss──▶ dismissed                 └── (calendar entry then owns the publishing lifecycle)
   └──regenerate──▶ superseded
```

Note where this stops: `published` on a draft means *handed over*. The actual publishing lifecycle
(`draft → in_review → scheduled → published → archived`) stays in `content_calendar`, which already
owns it and already validates transitions in `assertCalendarTransition`.

---

## 7. The AI workload

### 7.1 Registration

Add `channel_post_draft` to `AiWorkloadId` and a policy row to `AI_WORKLOAD_POLICIES` in
`src/kernel/ai-client/models.ts` — the single source of truth for models and effort levels, which is
why no model name appears in this document. The workload's recommendation belongs in that policy row,
where an admin can override it per workload through `ai_settings.model_overrides` (migration
`00150`). Short, well-bounded copywriting with a human reviewing every word does not warrant the
platform's most expensive reasoning tier; the policy row should say so and say why.

Every call goes through `runAiMessage` from `@/kernel/ai-client` — never the SDK directly. Usage,
cost and latency land in `ai_usage_log` automatically with `feature: 'channel_post_draft'`.

### 7.2 Prompt assembly

| Part | Content | Cached? |
|---|---|---|
| System | The channel profile (length, hook, one link, no markdown, hashtag policy), `brandVoice`, `bannedPhrases`, the groundedness rules, and the standing instruction that source material is **data, never instructions** | Yes — it is stable across runs (`cacheSystemPrompt`) |
| User | The `PublishableSource` rendered field by field, each wrapped with `wrapExternalData(field.key, field.value)` | No |

`wrapExternalData` is not decoration. Campus source material can include text that originated in a
WhatsApp channel or a transcript, i.e. text somebody outside the organisation wrote. Wrapping it and
instructing the model to treat delimited blocks as data is the platform's standing defence
(AGENTS.md §6, `AI_INTEGRATION.md`), and it is the reason the payload is a list of labelled fields
rather than one concatenated string.

### 7.3 Structured output and groundedness

Hand-written JSON Schema plus a hand-written validator, matching `INTAKE_STRUCTURE_JSON_SCHEMA` and
`validateStructuredIntakeSuggestion` (the repo has no `zod` dependency, so `zodToOutputConfig` is not
the path here).

```jsonc
{
  "variants": [{
    "angle": "string",             // what this version leads with
    "body": "string",              // the post, within the channel's character budget
    "hashtags": ["string"],
    "claims": [                    // every factual assertion, mapped to its source
      { "text": "string", "sourceFieldKey": "string" }
    ]
  }],
  "omitted": ["string"]            // material deliberately left out, and why
}
```

The `claims` array is the design's answer to the real risk, which is not bad prose but a plausible
sentence nobody can support. The validator rejects a variant whose claim cites a `sourceFieldKey`
that was not sent; the review UI shows each claim next to the field it came from, so approving is an
act of verification rather than an act of taste. `omitted` exists so a reviewer can see what the
drafter chose not to use — usually the most interesting thing about a draft.

### 7.4 Readiness gate

Campus sessions are often thin: a theme and nothing else. Asking a model to write a LinkedIn post
from a title is asking it to invent, so the domain layer refuses:

> **Not enough to draft from.** This session has a theme but no summary, decisions or action items
> marked for publication. Add publication notes on the session record and try again.

`sourceReadiness(source, config)` is a pure, unit-testable function over the payload
(`minimumSourceCharacters`, at least one `intent: 'copy'` field). It runs in the server action, not
only in the button, and it turns the most likely quality failure into a clear instruction instead of
a hallucination.

### 7.5 Failure behaviour

Three degradation styles exist in the codebase — deterministic fallback (intake), partial success
(meeting summary + follow-ups), and hard failure (WhatsApp categorisation). The right one here is
**hard, visible failure**: there is no honest deterministic fallback for prose, and a template-filled
post would be worse than none. On a provider error or an invalid payload the action returns
`{ ok: false, error }`, the record is untouched, the failure is already logged in `ai_usage_log`, and
the user sees a retry. Rate limiting comes free from generating only on an explicit click; the
`variantsPerRun` setting caps the cost of that click.

---

## 8. Privacy, consent and access

This is a public-facing feature at a patient-advocacy organisation, so the privacy design is not a
footnote — it is why the source contract looks the way it does.

**The button does not read the page.** It asks the owning component for a payload. The difference is
everything: a page aggregates a monthly WhatsApp digest, a full meeting transcript, task
assignments and internal comments, and none of that is publishable. The campus provider returns only
fields whose *purpose* is publication:

| Included | Excluded, deliberately |
|---|---|
| `theme`, `summary` | The raw transcript (`comms_meeting_transcripts`) |
| `decisions_for_publication` | The WhatsApp digest and any `intake_items` content |
| `action_items_for_publication` | Task assignments, owners and internal comments |
| The AI summary's `publication_blurb` | The summary's internal decisions/action items |
| `session_date`, participating hub names | Attendee lists |
| Presenter name + public LinkedIn URL (consent `public`) | Any other named individual |

**Named people need a basis.** `PublishableSource.people` carries a `consent` value and admits only
`'public'` (the person's role is already public — a presenter with a public profile link) or
`'granted'` (recorded consent). Anyone else is described by role or omitted. The drafter is
instructed not to name people who are not in that list, and the reviewer sees the list.

**Access.** Generating and approving require the comms workspace roles (`Comms`, `PlatformAdmin`,
`Superadmin` — `src/lib/comms-access.ts`), enforced in the server action and again by RLS
(`is_comms_team_or_admin()`), never in the UI alone. When a real connector arrives, *delivery* should
be restricted further to `PlatformAdmin`/`Superadmin`, following the precedent that the WordPress
publish stub is already admin-only while the LinkedIn schedule stub is not: posting in the
organisation's name on an owned channel is an administrative act.

**Secrets.** Nothing new in Phase 1. A connector would add server-side-only credentials, declared as
`type: 'secret'` config fields with a `secretRef` (never persisted as plaintext in
`platform_settings`, per ADR-0010) and documented in
[`ENVIRONMENT_REFERENCE.md`](ENVIRONMENT_REFERENCE.md) at that point.

---

## 9. The user flow

**Where the button lives.** Two campus surfaces, in priority order:

1. **`/app/comms/campus-log/sessions/[id]`** — primary. This is the canonical editorial record: the
   page where `summary`, `decisions_for_publication` and `action_items_for_publication` are written,
   where `published_outputs` already links sessions to calendar entries, and where an integration
   stub button (Teams) already sits. The material and the provenance are both here.
2. **`/app/comms/campus/[year]/[month]`** — secondary, next to `CampusDecisionsActions`. This is
   where the coordinator actually works after a meeting, and where the transcript's
   `publicationBlurb` is on screen.

**The flow**

| Step | What the user sees | What the system does |
|---|---|---|
| 1 | *"Draft a post"* with a channel picker (LinkedIn preselected) | Nothing until clicked — no background generation, no cost |
| 2 | Either three drafts, or the readiness message from §7.4 | Resolve provider → load payload → readiness gate → `runAiMessage` → validate → insert one `pending` row per variant |
| 3 | A drawer: variants side by side, each with its angle, character count against the channel budget, hashtags, and claims annotated with the field they came from | — |
| 4 | Editing the text directly; character count updates; a "changed from the draft" marker | `editDraft` writes `body`, leaves `ai_body` intact |
| 5 | **Approve** | `approveDraft` stamps `approved_by`/`approved_at`; siblings in the run become `dismissed` |
| 6 | *Copy to clipboard* — and *Add to content calendar* | `handOverApprovedDraft` calls `content`'s action to create a calendar entry (`channels: ['linkedin']`, `body_draft` = approved text, status `draft`), stores `content_calendar_id`, calls the provider's `onPublished` so `events` records the entry in `campus_sessions.published_outputs`, and logs a `comms_integration_intents` row |
| 7 | The session page shows "posted to LinkedIn calendar entry →" | Provenance closed in both directions |

**States to design for:** not-ready (§7.4), generating, provider error, stale source, no publishable
material, over-budget after editing, already-approved, superseded run, AI feature flag off
(`NEXT_PUBLIC_FEATURE_AI` — the button must be absent, not broken), and `syndication` flagged off
entirely (the host page renders exactly as it does today).

---

## 10. Publishing: three options compared

| | **A. Approve + copy out** | **B. Handover to the calendar** | **C. LinkedIn API connector** |
|---|---|---|---|
| What happens | Reviewer copies the approved text into LinkedIn | Approved text becomes a `content_calendar` entry; the existing LinkedIn stub logs the intent | The platform posts to the organisation page directly |
| New integration | None | None — both tables exist | An app with LinkedIn's Community Management product **approved**, three-legged OAuth with an organisation admin, server-side refresh-token custody, organisation URN config, delivery-status handling and retries |
| Provenance | Draft record only | Full: session ↔ calendar entry ↔ intent | Full plus a delivered post id |
| Risk | None | Very low | Real: review/approval dependency, credential custody, token expiry, API and policy drift, and the possibility of publishing something wrong automatically |
| Ships | Stage 1 | Stage 2 | Stage 4, as its own component |

**Recommendation: A, then B, and treat C as a separate decision.**

Almost all the value — never retyping, consistent voice, provenance, review — is in A and B, and
neither needs a single external credential. C removes one copy-paste and adds a credential-custody
surface, an external approval dependency, and the one failure mode that actually matters
(publishing in the organisation's name without a human in the loop).

When C is built, it must be its own component implementing the `ChannelConnector` port from §5.2 —
not code inside `syndication`, so that a platform generated without LinkedIn simply has no connector
registered. Two constraints hold regardless: the connector delivers only text a human already
approved, and it never re-drafts. The specifics of LinkedIn's current API product names, scopes and
review requirements must be verified against their live documentation at that point rather than
taken from this document.

---

## 11. Rollout

Each stage is independently shippable and independently useful.

| Stage | Ships | First-slice detail |
|---|---|---|
| **1 — the seam and one source** | Kernel contracts + `reconcileSources`; `syndication` module (one table, channel profile for LinkedIn, workload, review UI); `campus_session` provider in `events`; button on the session page; approve + copy out | This is the first slice. It requires `events` to export a real public API function — its `index.ts` currently exports only the manifest, and campus reads are inline in routes — so Stage 1 also pays down a piece of the Stage-1 modularisation debt in ADR-0009 terms |
| **2 — handover** | `handOverApprovedDraft` into `content_calendar`, `onPublished` writing `published_outputs`, the intent row, the `entity_type` check-constraint `ALTER` | Closes provenance both ways |
| **3 — prove it is generic** | A second source (conference report or initiative milestone) and a second channel profile (newsletter) | The acid test: if either needs `syndication` code changes, the extension point is wrong. Nothing in Stage 3 should touch the drafting module |
| **4 — connector** | A `channel-linkedin` component implementing `ChannelConnector`, admin-gated delivery, token custody, scheduled delivery | Its own ADR; see §10 |
| **5 — calibration** | Edit-distance between `ai_body` and approved `body` per channel and angle, surfaced to admins, feeding the channel profile and `brandVoice` | The same "measure whether it works" discipline as the podcast score calibration; without it, prompt tuning is superstition |

---

## 12. Governance and verification impact

| Gate | Impact |
|---|---|
| **Table ownership** | `syndication_drafts` is declared in the new manifest, so the gate stays green. `comms_integration_intents` stays `content`-owned. |
| **Import boundaries** | The design exists to satisfy this. `syndication` imports the kernel and `@/modules/content` only; `events` imports no syndication internals; the registry is a top-level `src/modules/*` file, which is the permitted place to see both — same as `registry.ts` and `settings-registry.ts`. |
| **Reachability** | `surface: 'internal'` with `provides.ui` declared satisfies today's checks. Worth verifying at implementation time: this component mounts inside other components' pages and owns no route of its own — a case the Stage-3 nav-composition work will need to represent, and a question worth answering in the ADR rather than at review. |
| **Settings** | Typed `config` requires `provides.settingsPanel: true`; the panel renders automatically. |
| **Dead code** | Every declared export must be reachable — the registry import is what keeps the provider from looking dead. |
| **New check (proposed)** | Source reconciliation: declared `provides.sources` ↔ registered providers ↔ `ownedBy`. Same spirit as ADR-0009 §10: a declaration nobody implements and a provider nobody declared both fail CI. |
| **Manifest validation** | `validateManifest` extended for the new optional `provides.sources` field. |
| **Migrations** | One new migration, numbered above the highest on `main` (≥ `00173` as of writing), idempotent, plus the one check-constraint `ALTER`. |
| **Tests** | Pure units for `sourceReadiness`, the channel profile budget, the claims validator, fingerprinting and `reconcileSources`; a domain test that handover is impossible without approval; an e2e smoke on the campus session page. |
| **Docs to update when built** | `DATA_DICTIONARY.md` (new table), `AI_INTEGRATION.md` (new workload), `MODULAR_COMPONENT_ARCHITECTURE.md` §8 (new component row), `TRACEABILITY.md` (REQ-SYN rows to `done`), `CHANGELOG.md`, and `ENVIRONMENT_REFERENCE.md` only if Stage 4 adds credentials. |

---

## 13. Risks and open questions

**Risks**

| Risk | Mitigation in this design |
|---|---|
| Thin sources produce invented content | The readiness gate refuses to draft (§7.4); claims must cite a sent field (§7.3) |
| A plausible but unsupported sentence gets approved | Claims shown next to their source field; approval is verification, not taste |
| Publishing something the organisation would not have said | Unconditional human approval, not a setting (§4.4); admin-only delivery when a connector exists |
| Naming a patient or member without a basis | Provider returns only `public`/`granted` people; everyone else is a role or omitted (§8) |
| Prompt injection through ingested text | Curated field payload + `wrapExternalData` + the standing "data, not instructions" rule |
| "Generic" that is really campus-shaped | Stage 3 is the acid test, and it is a scheduled stage rather than an aspiration |
| A second channel vocabulary drifting from `content`'s | Reuse `CalendarChannel`; propose promoting it to `content`'s published contract |
| Cost creep | Explicit click only, `variantsPerRun` capped, cached system prompt, per-workload model override |

**Open questions**

1. **Naming.** `syndication` avoids both entity and channel vocabulary but reads slightly technical.
   `publishing` is clearer to a newcomer and collides with `content`'s existing summary wording.
   Decide in the ADR.
2. **Where the provider lives for campus.** `campus_sessions` is owned by `events`, a component
   ADR-0009 §8 already flags as needing a split. If the campus/session slice is ever extracted, the
   provider moves with it — which is an argument that this design is fine either way, but the split
   question should not be settled by this feature.
3. **Media.** A LinkedIn post without an image underperforms. `campus_sessions` has
   `slides_media_id` and `recording_url`, and `media_assets` exists — is media selection in Stage 1's
   review UI, or Stage 3?
4. **Variants: three or one?** Three angles help a reviewer choose but triple the reading. Starts as
   a setting; the calibration loop should answer it with data.
5. **Language.** Inspire2Live operates in more than 45 countries. One language first, but is a
   second language a channel profile, a variant dimension, or its own concern?
6. **Who is the publisher of record?** If a coordinator approves a draft that turns out to be wrong,
   the audit trail names them. Worth stating in the ADR so it is a decision rather than a
   consequence.
7. **Does `intake` become a source?** A promoted intake item already produces a calendar draft via
   `buildCalendarDraftFromIntake`. That path should probably stay as it is and not be re-expressed as
   a provider — but it is the closest thing to overlap in the codebase and deserves an explicit
   answer.

---

## 14. Proposed ADR-0014 (outline)

Not written yet — an ADR records an accepted decision, and this concept is a proposal. When
accepted, `docs/ADR/0014-channel-syndication.md` should cover:

- **Title:** Entity-to-channel syndication is a generic component with per-component source providers.
- **Context:** the three-concern seam (§3); ADR-0009 §8/§9 (boundaries, no cross-component FKs) and
  §10 (governance); ADR-0013's precedent of splitting along the reuse seam; the pull to just add a
  button to the campus page.
- **Decision:** (1) a new `syndication` component owning drafts, channel profiles and the AI
  workload; (2) a kernel `SourceProvider`/`PublishableSource` contract plus a new optional
  `provides.sources` manifest field, reconciled in CI; (3) composition in a top-level registry file
  so `syndication` never depends on source owners; (4) a channel is data plus an optional connector,
  never a module; (5) approved drafts hand over to `content_calendar` through `content`'s own action,
  and provenance is written back through the provider's `onPublished` hook; (6) no cross-component FK
  on `source_id`; (7) human approval is unconditional and not configurable; (8) the LinkedIn API
  connector is deferred and, when built, is its own component behind the `ChannelConnector` port.
- **Consequences:** second source and second channel become additive; one new table and one new
  governance check; `source_id` has no database-level integrity; `events` must publish a real API
  function; a page-mounted component with no route of its own is a new case for Stage-3 nav
  composition.
- **Alternatives considered:** extend `content` (§4.5); put drafting in `ai-features` (§4.5); a
  `linkedin` module (§3); scrape the rendered page (§8); generate on page load rather than on click.

---

## 15. What already exists that this builds on

Nothing in this concept starts from zero, and the fit with what is already there is the main argument
for it.

| Existing | Role here |
|---|---|
| `content_calendar` — `channels[]` incl. `linkedin`, `body_draft`, `draft → in_review → scheduled → published → archived` with validated transitions | The destination. Unchanged. |
| `comms_integration_intents` + `logIntegrationIntent` + `triggerLinkedInScheduleStub` | The delivery audit log and the Phase-1 "stub" delivery. One check-constraint value added. |
| `campus_sessions.decisions_for_publication` / `action_items_for_publication` / `published_outputs` | The publication-intended source fields, and the back-reference the `onPublished` hook writes. |
| `meeting_summaries.publication_blurb` | Already an AI-written, publication-oriented sentence — a source field, not a competitor. |
| `intake_ai_suggestions` (pending/applied/dismissed/superseded, one live row, `applied_by`) | The draft-lifecycle pattern this copies. |
| `podcast-planning` + `network` (ADR-0013) | The module anatomy, the soft cross-component reference, thresholds as manifest `config`, and `handOverToContentCalendar` as the handover precedent. |
| `kernel/settings` + `modules/settings-registry.ts` | The extension-point mechanism this reuses rather than invents. |
| `kernel/ai-client` — `runAiMessage`, `wrapExternalData`, workload policies, `ai_usage_log` | The only path to a model, including the injection defence. |
| `kernel/data` `moduleClient` | Typed access to a new table without `(supabase as any)`. |
| `is_comms_team_or_admin()` + `src/lib/comms-access.ts` | The RLS and role gate, reused verbatim. |

---

## References

- [`MODULAR_COMPONENT_ARCHITECTURE.md`](MODULAR_COMPONENT_ARCHITECTURE.md) — §4 manifest, §6 data contracts, §7 kernel, §9 contract rules, §10 governance, §11 AI levels
- [ADR-0009](ADR/0009-modular-component-architecture.md) — modular component architecture
- [ADR-0010](ADR/0010-platform-settings-space.md) — manifest `config` → settings panel
- [ADR-0013](ADR/0013-opportunity-engine-components.md) — splitting along the reuse seam; soft cross-component references
- [`AI_INTEGRATION.md`](AI_INTEGRATION.md) — kernel AI client, structured output, human-in-the-loop; model catalog lives in `src/kernel/ai-client/models.ts`
- [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md) · [`ROLE_PERMISSION_MODEL.md`](ROLE_PERMISSION_MODEL.md)
- [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) — to be extended when the table is created
- [`PLATFORM_CONCEPT_UPDATE_v1.md`](PLATFORM_CONCEPT_UPDATE_v1.md) — the Communications-first MVP this serves

---

*Concept — proposal, not implemented. Last reviewed: 2026-08-19.*
