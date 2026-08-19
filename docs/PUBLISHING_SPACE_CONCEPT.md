# Publishing Space — Concept

> **What it is:** a **Publishing** space in the Communications workspace where one screen turns
> *something worth telling* into a channel-ready post: pick a platform record **or** drop a
> screenshot and say what it is, and the platform drafts the copy for review.
> **First channel:** LinkedIn. Newsletter and website articles are the same machine with a different
> channel profile, visible from day one and deliberately not enabled yet.
> **Two source kinds, one pipeline:** a **linked source** (a record the platform already owns — the
> World Campus session first) and an **ad-hoc source** (an uploaded screenshot plus a one-line
> description). Both arrive at the drafter as the same shape.
> **UX principle:** guided by design, not by instructions. Little text, one decision at a time.
> **Owning module:** `src/modules/publishing` + a kernel source/channel contract.
> **Delivery:** [`sprints/sprint-21-publishing-space/`](../sprints/sprint-21-publishing-space/description.md)
> **Decision record:** [ADR-0014](ADR/0014-publishing-space.md).
> **Architecture it fits:** [`MODULAR_COMPONENT_ARCHITECTURE.md`](MODULAR_COMPONENT_ARCHITECTURE.md)
> (ADR-0009), [ADR-0010](ADR/0010-platform-settings-space.md), [ADR-0013](ADR/0013-opportunity-engine-components.md),
> [`AI_INTEGRATION.md`](AI_INTEGRATION.md).

---

## Table of contents

1. [Why a space and not a button](#1-why-a-space-and-not-a-button)
2. [Scope boundary](#2-scope-boundary)
3. [The seam: what is generic and what is ours](#3-the-seam-what-is-generic-and-what-is-ours)
4. [Architecture](#4-architecture)
5. [The source contract — the extension point](#5-the-source-contract--the-extension-point)
6. [Data model](#6-data-model)
7. [The AI workload](#7-the-ai-workload)
8. [Privacy, rights and access](#8-privacy-rights-and-access)
9. [The space: UX](#9-the-space-ux)
10. [Publishing: three options compared](#10-publishing-three-options-compared)
11. [Rollout](#11-rollout)
12. [Governance and verification impact](#12-governance-and-verification-impact)
13. [Risks and open questions](#13-risks-and-open-questions)
14. [What already exists that this builds on](#14-what-already-exists-that-this-builds-on)

---

## 1. Why a space and not a button

Two things happen at Inspire2Live that both end in "someone should post about this".

**The platform already knows.** Every month the World Campus meeting produces exactly the material a
LinkedIn post is made of: a theme, a summary, decisions marked *for publication*, action items marked
*for publication*, a named presenter with a public profile, and an AI meeting summary containing a
field literally called `publication_blurb`. It is written down, by the person who ran the meeting.
And then somebody retypes it into LinkedIn.

**The platform has no idea.** A photo from a conference stand. A screenshot of a journal abstract. A
picture a member sent to the WhatsApp group. Someone says "we should post this", and there is no
record to start from — just an image and a sentence of context. Today that never becomes a post
unless one person finds the time to write one.

A button on the campus page serves the first case and nothing else. A **space** serves both, because
both are the same job once you stop assuming the source is a database row: *here is something worth
telling, make it publishable, let a human approve it.*

| | Today | With the Publishing space |
|---|---|---|
| A campus meeting worth posting about | Re-read the record, rewrite it by hand in the LinkedIn composer | Open Publishing, the meeting is offered as a source, review the draft |
| A screenshot someone sends you | Usually nothing happens | Drop it in, one line of context, review the draft |
| Who can do it | Whoever writes well and knows the material | Anyone on the comms team — the draft is the starting point, not the skill |
| Consistency of voice | Depends on the author and the day | One channel profile and one brand voice, applied every time |
| The newsletter version | Rewrite from scratch | Same source, different channel profile, no new code |
| Provenance | None — the post and the record are unrelated artifacts | The draft records its source, the exact fields used, and who approved it |
| Whether it went out | Remembered, or a checkbox | The approved text becomes a `content_calendar` entry with the existing lifecycle |

The point is not that AI writes better copy than a human. It is that the distance between *something
happened* and *something publishable exists* collapses from a writing job to a review job — and that
the review stays a real review: an editable draft, visible provenance, and a human approval before
anything leaves the building.

---

## 2. Scope boundary

**In scope (Sprint 21)**

- A **Publishing space** at `/app/comms/publishing`, in the comms nav, gated like the rest of the
  workspace.
- **LinkedIn** as the first channel profile (length budget, hook-first, one link, hashtag policy, no
  markdown). Newsletter and website appear as channels and are visibly not yet available.
- **Two source kinds:** the World Campus session (linked) and screenshot + description (ad-hoc).
- Generation of two or three variants, a review-and-edit step, and an explicit human approval.
- Handover of approved copy into the existing `content_calendar`, with provenance written back to the
  source record where it has one.
- The extension mechanism that makes the next source and the next channel additive.

**Explicitly out of scope**

- **Publishing through LinkedIn's API.** Sprint 21 ends at an approved draft plus copy-out; the
  connector is §10 and is its own component when it happens.
- **Newsletter and website generation.** The channels are visible because the space is built for
  them; enabling them is a later sprint and, by design, should need no new module code.
- **Autonomous posting.** Nothing is published without a human approving the exact text.
- **Image generation, cropping or editing.** An uploaded screenshot is used as-is.
- **Multi-language variants** (§13).
- **Scraping the rendered page.** A linked source is a curated payload the owning component hands
  over — never the DOM, never "everything on the page" (§8).
- **A physical `tenant_id`** — same position as ADR-0013 §3.

---

## 3. The seam: what is generic and what is ours

Three concerns hide inside "make a LinkedIn post from this". Keeping them apart is the whole design.

| Concern | Question it answers | Who owns it |
|---|---|---|
| **The source** | What may be said publicly about this thing, and what material says it? | Whoever owns the thing. For a campus session that is `events`. For an uploaded screenshot there is no other owner, so `publishing` owns it. |
| **The drafting and the gate** | How does source material become channel-shaped copy, reviewed, edited and approved? | Generic — `publishing`. No entity vocabulary, no channel-specific branches. |
| **The delivery** | How does approved text reach LinkedIn, a newsletter, the website? | A channel adapter. Today a human copies it out; later a connector component. |

Three consequences, and they are the load-bearing decisions.

**An ad-hoc upload is not a special case — it is a source.** The temptation is two code paths: one
"from a record" and one "from an upload". Instead, the upload is stored as a row and served by a
provider that implements the *same* contract as the campus provider. The drafter has exactly one
input shape, and "flexible sources" costs one provider rather than a fork through the whole pipeline.

**A channel is data, not a module.** There is deliberately no `src/modules/linkedin`. LinkedIn is a
profile plus, eventually, an adapter. The channel vocabulary already exists in code as
`CalendarChannel = 'linkedin' | 'newsletter' | 'wordpress' | 'podcast' | 'youtube'`
(`src/lib/comms-workflow.ts`) — note that "website article" is the existing `wordpress` channel. We
consume that vocabulary; we do not invent a second one.

**A page is not a source.** The generic half must not know what a campus session is, and `events`
must not know that LinkedIn exists. They meet through a declared contract and one composition file
allowed to see both — the mechanism `src/modules/settings-registry.ts` already uses to bind kernel
settings to the live component catalog.

---

## 4. Architecture

### 4.1 The pieces

| Piece | Where | What it is |
|---|---|---|
| **Publishing contracts** | `src/kernel/publishing/` | The `PublishableSource` / `SourceProvider` / `ChannelConnector` types and pure composition + reconciliation helpers. Types only — no provider, no channel, no model call. Kernel because no component owns it (ADR-0009 §7). |
| **`publishing` component** | `src/modules/publishing/` | Owns the space, the drafts, the ad-hoc sources, the channel profiles, the AI workload, the review UI, and the handover to `content`. Knows nothing about campus sessions. |
| **Linked source providers** | inside each owning component, e.g. `src/modules/events/domain/publishing-sources.ts` | The curated publishable payload for one entity type, exported through that component's `index.ts`. |
| **The ad-hoc provider** | `src/modules/publishing/domain/adhoc-source.ts` | Screenshot + description, stored in `publishing`'s own table — the same contract, no privileged path. |
| **The registry** | `src/modules/publishing-registry.ts` | The one top-level file allowed to import both the kernel and every component, exactly like `registry.ts` and `settings-registry.ts`. Resolves a `sourceType` to its provider. |
| **The space** | `src/app/app/comms/publishing/` | A thin route rendering `publishing`'s shell, plus a nav entry. |

### 4.2 Dependency directions (why the boundary holds)

```
events ──provides──▶ campusSessionSourceProvider ─┐
(later: initiatives, conferences, podcast)        │
                                                  ▼
                            src/modules/publishing-registry.ts
                                (the only file that sees both)
                                                  │  resolved PublishableSource
                                                  ▼
      publishing ──draft──▶ publishing_drafts ──approved──▶ content (calendar)
          │   ▲                                                    │
          │   └── its own adhoc provider (screenshot + text)        └── existing LinkedIn stub
          └── kernel: publishing · ai-client · identity · rbac · data · settings · ui
```

- `publishing` **does not** depend on `events` or any future source owner. It receives an
  already-resolved, plain-data `PublishableSource`. That is what keeps it extractable, and why the
  registry — not the module — resolves.
- `events` **does not** depend on `publishing`. It exports a provider shaped by a kernel type. With
  `publishing` flagged off, `events` is unaffected and the provider is never called.
- `publishing` **does** declare `dependsOn.components: ['content@^1']`, one direction only, for the
  handover — the same shape as `podcast-planning`'s `handOverToContentCalendar`. An approved draft
  becomes a calendar item through the calendar owner's own action (ADR-0009 §9 rule 3), never a
  direct insert.
- Writing provenance back onto a source record (`campus_sessions.published_outputs`) happens in the
  provider's optional `onPublished` hook, so the write stays inside the owning component.

### 4.3 Illustrative manifest

```ts
// src/modules/publishing/manifest.ts (illustrative)
export const manifest = defineManifest({
  id: 'publishing',
  version: '1.0.0',
  title: 'Publishing',
  summary:
    'Turns a platform record or an uploaded screenshot into channel-ready copy, keeps it under human review, and hands the approved text to the content calendar.',
  surface: 'internal',
  data: {
    schema: 'publishing',
    tablePrefix: 'publishing_',
    tables: ['publishing_drafts', 'publishing_sources'],
    migrations: ['00173'], // ≥ 00173; verify against main at implementation time
  },
  provides: {
    api: [
      'CHANNEL_PROFILES', 'channelProfile', 'channelBudget',
      'createAdhocSource', 'adhocSourceProvider',
      'generateDrafts', 'loadDrafts', 'loadDraft',
      'editDraft', 'approveDraft', 'dismissDraft', 'handOverApprovedDraft',
      'sourceReadiness', 'resolvePublishingConfig',
    ],
    events: ['publishing.draft.approved'],
    ui: ['PublishingShell', 'SourcePicker', 'DraftCanvas'],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'ai-client', 'data', 'settings', 'ui', 'publishing'],
    components: ['content@^1'],
  },
  featureFlag: 'comms_team',
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  config: {/* §4.4 */},
  operations: ['draft-post'],
})
```

`content`'s manifest summary currently reads "outbound publishing/integration intents", which will
now be ambiguous. It should be reworded in the same sprint: `content` owns the calendar, the media
library and the integration intent log; `publishing` composes copy and gates its approval.

### 4.4 Operator-tunable config (ADR-0010)

Typed `config` renders as a Platform Settings panel with no bespoke form code, and is what a
blueprint would set per tenant.

| Key | Type | Why it is a setting and not a constant |
|---|---|---|
| `variantsPerRun` | number (default 3) | How much choice helps a reviewer is a guess; it should be tunable without a deploy. |
| `brandVoice` | text | The one place the organisation's voice is written down, rather than a string literal in a prompt. |
| `bannedPhrases` | text | House style as data ("breakthrough", "game-changer", any curative claim). |
| `hashtagPolicy` | enum `none · suggest · fixed` | Organisations have opposite conventions. |
| `fixedHashtags` | string | Used when the policy is `fixed`. |
| `includeSourceLink` | boolean | Some sources have no public URL. |
| `minimumSourceCharacters` | number | The readiness gate (§7.4): below this we refuse to draft rather than invent. |
| `maxUploadMegabytes` | number | Screenshot upload ceiling. |
| `staleDraftBehaviour` | enum `warn · block` | What happens when a linked source changed after the draft was generated. |

**Deliberately not a setting:** whether a human must approve before handover. That gate is
unconditional in the domain layer. A switch that turns it off is the one setting capable of
publishing an unreviewed model output in the organisation's name (AGENTS.md §6).

### 4.5 Why not extend `content`, or `ai-features`?

`content` already owns the calendar, the media library and the integration intents, and all of that
is reused unchanged — this concept adds **nothing** to the calendar model and creates no second
publishing path. What does not belong there is the *generic transformation*: a provider registry,
entity-agnostic source payloads, an upload-backed ad-hoc source, a groundedness contract, an AI
workload and a review gate. Folding those into `content` would weld the reusable half to the
Inspire2Live editorial calendar — the entanglement ADR-0009 exists to prevent, and the call ADR-0013
already made once. `content` is the *destination*, which is a clean one-directional dependency.

`ai-features` is the component for AI *data* (settings, usage log, org feed, meeting summaries). A
workload belongs to the component whose data it enriches (ADR-0009 §7); the AI *client* stays kernel.

---

## 5. The source contract — the extension point

This is what decides whether the second source type costs an afternoon or a rewrite.

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
`src/kernel/manifest/types.ts` — additive, so no existing manifest changes meaning. It makes "which
of this platform's records can be published from" structured data rather than a grep, which is
exactly what the L1 catalog and the L2 generator read.

### 5.2 The contracts

```ts
// src/kernel/publishing/types.ts (illustrative)

/** One piece of source material, classified by how the drafter may use it. */
export type PublishableField = {
  key: string                    // 'summary' | 'decisions_for_publication' | 'description'
  label: string                  // shown in review as provenance
  value: string
  /** 'copy' = prose it may paraphrase. 'fact' = a short value it may state, never embellish. */
  intent: 'copy' | 'fact'
}

/** An image the drafter may look at (and the post may carry). */
export type PublishableImage = {
  storagePath: string            // private bucket path; signed on read
  mediaType: string              // 'image/png' | 'image/jpeg' | 'image/webp'
  alt: string
}

/** Everything the drafter is allowed to know about one thing. Curated by its owner. */
export type PublishableSource = {
  sourceType: string             // 'campus_session' | 'adhoc'
  sourceId: string
  title: string
  occurredAt: string | null
  reviewHref: string             // where a human can verify it
  publicUrl?: string | null      // what the post may link to, when one exists
  fields: PublishableField[]
  images?: PublishableImage[]
  people?: Array<{ name: string; role?: string; consent: 'public' | 'granted' }>
  links?: Array<{ label: string; url: string }>
  fingerprint: string            // hash over the above — the staleness signal
}

export type SourceProvider = {
  sourceType: string
  label: string                  // 'World Campus session' · 'Screenshot & note'
  ownedBy: string                // component id — reconciled against the manifest
  /** Offer recent candidates for the picker; ad-hoc returns none. */
  listRecent?(ctx: SourceContext, limit: number): Promise<SourceCandidate[]>
  load(ctx: SourceContext, sourceId: string): Promise<PublishableSource | null>
  /** Optional: record provenance on the source record, through the owner's own write path. */
  onPublished?(ctx: SourceContext, sourceId: string, calendarEntryId: string): Promise<void>
}

/** The delivery port. Sprint 21 ships only the manual path; a connector implements the same port. */
export type ChannelConnector = {
  channel: string                // the content channel vocabulary
  deliver(text: string, meta: DeliveryMeta): Promise<DeliveryResult>
}
```

`listRecent` is what makes the picker in §9 possible without the space knowing what any source *is*:
each provider offers its own recent candidates with a label and a date, and the space renders them
uniformly.

### 5.3 The registry

```ts
// src/modules/publishing-registry.ts (illustrative)
import { campusSessionSourceProvider } from '@/modules/events'
import { adhocSourceProvider } from '@/modules/publishing'
import { componentManifests } from '@/modules/registry'
import { indexProviders, reconcileSources } from '@/kernel/publishing'

const PROVIDERS = [adhocSourceProvider, campusSessionSourceProvider]

export function allSourceProviders() { return indexProviders(PROVIDERS) }
export function sourceReconciliation() { return reconcileSources(componentManifests, PROVIDERS) }
export async function resolveSource(ctx: SourceContext, sourceType: string, sourceId: string) { … }
```

Three properties make this the right mechanism rather than a clever one:

1. **It already exists here.** `settings-registry.ts` composes kernel panels with every component's
   panel in one top-level file. Same shape, different contract — no plugin loader, no new runtime
   framework (ADR-0009 §13 rules those out).
2. **Adding a source touches three lines** — a provider, one manifest entry, one registry import —
   and no `publishing` code.
3. **It is checkable.** `reconcileSources` compares declared `provides.sources` against registered
   providers and their `ownedBy`, so a provider nobody declared, a declaration nobody implements and
   a provider claiming the wrong component all fail CI (§12).

### 5.4 Entry points into the space

The space is the home, but the source often has a page of its own. A single UI surface, mounted where
the material lives, deep-links into the space with the source pre-selected:

```tsx
// src/app/app/comms/campus-log/sessions/[id]/page.tsx (illustrative addition)
<PublishFromHere sourceType="campus_session" sourceId={session.id} />
```

No second implementation, no duplicated flow — the button is a link that skips step one.

---

## 6. Data model

**Two new tables and one new bucket.** Everything else reuses what exists.

```sql
-- supabase/migrations/000NN_publishing_component.sql (illustrative; ≥ 00173)

-- 1. Ad-hoc sources: what somebody dropped in, when there is no platform record.
create table if not exists public.publishing_sources (
  id uuid primary key default gen_random_uuid(),
  title text,                                  -- optional; derived from the description if absent
  description text not null,                   -- the one line of context the user typed
  images jsonb not null default '[]'::jsonb,    -- [{ storagePath, mediaType, alt, bytes }]
  occurred_at date,
  public_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 2. Drafts: one row per variant, for any source kind.
create table if not exists public.publishing_drafts (
  id uuid primary key default gen_random_uuid(),

  -- Soft reference to the source: no FK across component boundaries (ADR-0009 §9 rule 4).
  -- 'adhoc' points at publishing_sources.id; 'campus_session' at campus_sessions.id.
  source_type        text not null,
  source_id          uuid not null,
  source_fingerprint text not null,
  source_fields      jsonb not null default '[]'::jsonb,  -- exactly what was sent

  channel text not null,                       -- content channel vocabulary
  run_id  uuid not null,                        -- groups the variants of one generation
  angle   text,

  body     text not null,                      -- current text; human edits land here
  ai_body  text not null,                      -- untouched model output, for calibration
  hashtags text[] not null default '{}',
  claims   jsonb not null default '[]'::jsonb,   -- claim → source field key (§7.3)
  image_ref jsonb,                              -- the image chosen to accompany the post

  status text not null default 'pending' check (
    status in ('pending','approved','dismissed','superseded','published')
  ),

  workload text, model text, effort text, prompt_version text,
  raw_response jsonb,

  content_calendar_id uuid,                    -- soft link, set at handover
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.publishing_sources enable row level security;
alter table public.publishing_drafts  enable row level security;

drop policy if exists publishing_sources_comms on public.publishing_sources;
create policy publishing_sources_comms on public.publishing_sources
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists publishing_drafts_comms on public.publishing_drafts;
create policy publishing_drafts_comms on public.publishing_drafts
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());
```

**Storage.** A new **private** bucket `publishing-uploads`, image MIME allow-list, size ceiling from
`maxUploadMegabytes`, with storage policies gated on `is_comms_team_or_admin()` — the
`meeting-transcripts` bucket (migration `00078`) is the closest existing pattern, and reads use signed
URLs like `signInboundMediaUrl` does for WhatsApp media. Note that the media library's
`media_assets.storage_path` is unused today (assets are SharePoint links), so this is a new path
rather than a reuse.

**Design notes**

- **Variants are rows, not JSON.** A reviewer edits one and approves it; rows make the edit, approval
  and audit per-variant without rewriting a blob. `run_id` groups them.
- **`ai_body` is never overwritten.** The distance between it and the approved `body` is the only
  honest measure of whether the drafting is any good, and it is what §11 Stage 4 calibrates against —
  the same reasoning that made `podcast_candidate_scores` a snapshot.
- **Supersede on regenerate**, matching `intake_ai_suggestions`: a partial unique index keeps at most
  one live `pending` run per `(source_type, source_id, channel)`; regenerating supersedes rather than
  deletes.
- **`source_fingerprint`** detects a linked source edited after generation; behaviour is governed by
  `staleDraftBehaviour`. An ad-hoc source is immutable, so its fingerprint never drifts.
- **No FK on `source_id`.** Integrity is the owning component's job through its domain actions, as
  ADR-0013 §2 decided for `podcast_question_candidates.person_id`. FKs into the identity spine
  (`profiles`) stay normal FKs — rule 4 permits exactly that.
- **One `ALTER` on an existing table:** `comms_integration_intents.entity_type`'s check constraint
  gains `'publishing_drafts'` so a delivery intent can point at the draft it came from. The intents
  table stays `content`-owned.
- **Typed access without `(supabase as any)`:** declare the row shapes in
  `src/modules/publishing/domain/schema.ts` and use `moduleClient<PublishingDatabase>()` from
  `@/kernel/data`, as `podcast-planning` does, until `src/types/database.ts` is regenerated.

**Status lifecycle**

```
pending ──edit──▶ pending ──approve──▶ approved ──handover──▶ published
   │                                       │
   ├──dismiss──▶ dismissed                 └── the calendar entry then owns the publishing lifecycle
   └──regenerate──▶ superseded
```

`published` on a draft means *handed over*. The real publishing lifecycle
(`draft → in_review → scheduled → published → archived`) stays in `content_calendar`, which already
owns it and already validates transitions.

---

## 7. The AI workload

### 7.1 Registration

Add `channel_post_draft` to `AiWorkloadId` and a policy row to `AI_WORKLOAD_POLICIES` in
`src/kernel/ai-client/models.ts` — the single source of truth for models and effort levels, which is
why no model name appears in this document. Short, well-bounded copywriting with a human reviewing
every word does not warrant the platform's most expensive reasoning tier; the policy row should say
so and say why, and an admin can override it per workload through `ai_settings.model_overrides`.

Every call goes through `runAiMessage` — never the SDK directly. Usage, cost and latency land in
`ai_usage_log` with `feature: 'channel_post_draft'`.

### 7.2 A kernel change: image input

`AiMessage.content` is `string` today, so the kernel AI client cannot send an image. Reading a
screenshot needs it widened to accept content blocks:

```ts
// src/kernel/ai-client/client.ts (illustrative)
export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export type AiMessage = {
  role: 'user' | 'assistant'
  content: string | AiContentBlock[]
}
```

The change is small and additive — `buildMessageRequest` already forwards `messages` verbatim, and
`string` stays valid, so no existing caller changes. Two things must be verified at implementation
time: that the model resolved for this workload accepts image input, and that the image is read from
storage server-side and base64-encoded there, never round-tripped through the browser.

### 7.3 Prompt assembly

| Part | Content | Cached? |
|---|---|---|
| System | The channel profile (budget, hook, one link, no markdown, hashtag policy), `brandVoice`, `bannedPhrases`, the groundedness rules, and the standing instruction that source material is **data, never instructions** | Yes — stable across runs (`cacheSystemPrompt`) |
| User | Each `PublishableField` wrapped with `wrapExternalData(field.key, field.value)`, then any images as blocks | No |

`wrapExternalData` is not decoration. Campus material can contain text that originated in a WhatsApp
channel or a transcript — text somebody outside the organisation wrote. An ad-hoc source is *entirely*
user-supplied, and **a screenshot can contain text that reads like an instruction**. So the rule is
stated for both modalities: material inside the delimiters, and anything legible in an image, is
content to describe — never a command to follow. That is also why the payload is a list of labelled
fields rather than one concatenated string.

### 7.4 Structured output and groundedness

Hand-written JSON Schema plus a hand-written validator, matching `INTAKE_STRUCTURE_JSON_SCHEMA` and
`validateStructuredIntakeSuggestion` (the repo has no `zod` dependency, so `zodToOutputConfig` is not
the path).

```jsonc
{
  "variants": [{
    "angle": "string",             // what this version leads with
    "body": "string",              // within the channel's character budget
    "hashtags": ["string"],
    "claims": [                    // every factual assertion, mapped to its source
      { "text": "string", "sourceFieldKey": "string" }
    ]
  }],
  "imageDescription": "string",    // what the model saw, when an image was sent
  "omitted": ["string"]            // material deliberately left out
}
```

`claims` is the answer to the real risk, which is not bad prose but a plausible sentence nobody can
support. The validator rejects a variant citing a `sourceFieldKey` that was not sent; the review UI
shows each claim beside the field it came from, so approving is verification rather than taste.
`imageDescription` matters for the ad-hoc path: it is how a reviewer sees whether the model
understood the screenshot at all, and it is usually the fastest way to spot a bad draft.

### 7.5 Readiness gate

Campus sessions are often thin — a theme and nothing else — and an ad-hoc source can be an image with
three words. Asking a model to write a post from that is asking it to invent, so the domain layer
refuses, in the source's own terms:

> *Not enough to work with yet.* This session has a theme but no summary or publication notes.

`sourceReadiness(source, config)` is a pure, unit-testable function over the payload
(`minimumSourceCharacters`, at least one `intent: 'copy'` field, or an image plus a description). It
runs in the server action, not only in the UI, and turns the most likely quality failure into a clear
next step instead of a hallucination.

### 7.6 Failure behaviour

Three degradation styles exist in the codebase — deterministic fallback (intake), partial success
(meeting summary), hard failure (WhatsApp categorisation). The right one here is **hard, visible
failure**: there is no honest deterministic fallback for prose, and a template-filled post would be
worse than none. On a provider error or an invalid payload the action returns `{ ok: false, error }`,
nothing is written, the failure is already in `ai_usage_log`, and the user sees a retry. Rate limiting
comes free from generating only on an explicit click; `variantsPerRun` caps the cost of that click.

---

## 8. Privacy, rights and access

A public-facing feature at a patient-advocacy organisation, so this is not a footnote — it is why the
source contract looks the way it does.

**Linked sources: the button does not read the page.** It asks the owning component for a payload.
The difference is everything: a campus page aggregates a WhatsApp digest, a full meeting transcript,
task assignments and internal comments, and none of that is publishable. The campus provider returns
only fields whose *purpose* is publication:

| Included | Excluded, deliberately |
|---|---|
| `theme`, `summary` | The raw transcript (`comms_meeting_transcripts`) |
| `decisions_for_publication` | The WhatsApp digest and any `intake_items` content |
| `action_items_for_publication` | Task assignments, owners, internal comments |
| The AI summary's `publication_blurb` | The summary's internal decisions/action items |
| `session_date`, participating hub names | Attendee lists |
| Presenter name + public profile link (consent `public`) | Any other named individual |

**Named people need a basis.** `PublishableSource.people` admits only `'public'` (a role already
public, such as a presenter with a public profile link) or `'granted'` (recorded consent). Everyone
else is described by role or omitted; the drafter is instructed not to name anyone outside that list,
and the reviewer sees the list.

**Ad-hoc uploads carry two extra risks the UI must not hide.** A screenshot can contain identifiable
people who never consented, and it can be somebody else's copyrighted material. The upload step
therefore captures a rights answer before drafting — reusing the existing vocabulary from
`media_assets.rights_status` (`internal_only · approved_for_publication · needs_clearance`) — and a
source marked `internal_only` or `needs_clearance` can be drafted from but **cannot hand over** to the
calendar. That keeps one honest question in the flow without turning it into a form.

**Access.** Generating and approving require the comms workspace roles (`Comms`, `PlatformAdmin`,
`Superadmin` — `src/lib/comms-access.ts`), enforced in the server action and again by RLS
(`is_comms_team_or_admin()`), never in the UI alone. When a real connector arrives, *delivery* should
be restricted further to `PlatformAdmin`/`Superadmin`, following the precedent that the WordPress
publish stub is already admin-only: posting in the organisation's name is an administrative act.

**Uploads are private.** The bucket is not public; the space renders signed URLs. Nothing new reaches
the browser as a credential, and Sprint 21 adds no provider secret at all.

---

## 9. The space: UX

The brief is *intuitive, simple, little text, guided by design*. Concretely that means three rules:

1. **One decision visible at a time.** The screen shows the current step large and the rest small.
2. **Affordances instead of instructions.** A drop target that looks like a drop target needs no
   sentence explaining it; a channel row with one channel lit and two greyed communicates the roadmap
   with no copy at all.
3. **Text only where it is content.** Labels are one or two words. Explanations belong in tooltips
   and empty states, not on the working surface.

### 9.1 Three steps

```
┌─────────────── PUBLISHING ─────────────────────────────────────────┐
│  ① SOURCE            ② DRAFT               ③ APPROVE              │
│                                                                    │
│  ┌────────────────────────┐  ┌────────────────────────┐            │
│  │  ⌗  From the platform  │  │  ↥  Drop a screenshot  │            │
│  │  recent records ▸      │  │  or click to choose    │            │
│  └────────────────────────┘  └────────────────────────┘            │
│                                                                    │
│  in  [ ⬛ LinkedIn ]  [ ▢ Newsletter ]  [ ▢ Website ]  ← greyed     │
└────────────────────────────────────────────────────────────────────┘
```

**① Source.** Two tiles, equal weight, because neither path is the special one. The left tile expands
into a list of recent candidates from every registered provider — a label, a date, a source-kind
badge — so picking a campus meeting is one click and the space never had to know what a campus
meeting is. The right tile accepts a drag-and-drop anywhere on the canvas; after a drop, the image
appears as a thumbnail with one single-line field beside it (*what is this?*) and the rights choice as
three small chips. That is the whole ad-hoc form: an image, a line, a chip.

**② Draft.** The variants arrive as cards side by side. Each carries its angle as a two-word label, a
**character ring** that fills toward the channel budget and turns amber near it (no sentence needed to
explain a limit), the hashtags as chips, and the claims as small marks that reveal the source field
they came from on hover or tap. For an ad-hoc source the model's own `imageDescription` sits under the
thumbnail — the fastest way to see whether it understood the picture. Editing happens in place, in the
card; a subtle marker shows the text has diverged from the draft.

**③ Approve.** One primary button. After approving, exactly two next actions as icon buttons — copy,
and add to the calendar — with the second disabled and explained in a tooltip when the rights answer
says it must not go out yet. Then the space returns to step ① with a small strip of recent drafts
underneath, status carried by tone rather than words (the existing `StatusBadge`).

### 9.2 Design system and states

The space composes existing primitives — `ActionModal` for the source picker, `CollapsibleCard` for
anything advanced, `StatusBadge`, `Skeleton`/`PageSkeleton` while generating, and the Sprint 19
semantic tokens so it inherits the Campus visual language rather than inventing one. Two primitives do
not exist yet and belong in `src/kernel/ui` rather than in this module, because the next feature that
accepts a file will want them too: an **image drop zone** (drag, click, paste, thumbnail, remove) and
a **character ring**.

Everything advanced is behind progressive disclosure: hashtag policy, the full source-field list, the
raw model response, and the variant history. The default screen shows a source, a channel, and a
draft.

**States to design deliberately**, since these are where a "simple" UI usually degrades into an
apology: nothing selected yet (the two tiles *are* the empty state), not enough material (§7.5, phrased
in the source's own terms), generating, provider error with a retry, stale linked source, over budget
after an edit, rights not cleared, already approved, superseded run, AI flag off
(`NEXT_PUBLIC_FEATURE_AI` — the space explains itself rather than showing a dead button), and
`publishing` flagged off entirely (no nav entry, no route).

### 9.3 Where the space sits

A **Publishing** entry in the comms nav under *Content*, beside Library — one `NavItem` in both
`COMMS_NAV_SECTIONS` and `MASTER_NAV`, a new `NavIcon` key and its SVG in `side-nav.tsx`. Access is
already handled: everything under `/app/comms/*` goes through `canAccessCommsWorkspace`. An
`error.tsx` sits next to the page, as the podcast space does.

---

## 10. Publishing: three options compared

| | **A. Approve + copy out** | **B. Handover to the calendar** | **C. LinkedIn API connector** |
|---|---|---|---|
| What happens | Reviewer copies the approved text into LinkedIn | Approved text becomes a `content_calendar` entry; the existing LinkedIn stub logs the intent | The platform posts to the organisation page |
| New integration | None | None — both tables exist | An app with LinkedIn's Community Management product **approved**, three-legged OAuth with an organisation admin, server-side refresh-token custody, organisation URN config, delivery status and retries |
| Provenance | Draft record only | Full: source ↔ calendar entry ↔ intent | Full plus a delivered post id |
| Risk | None | Very low | Real: external approval dependency, credential custody, token expiry, API and policy drift, and the possibility of publishing something wrong automatically |
| Ships | Sprint 21 | Sprint 21 | Later, as its own component |

**Recommendation: A and B now, C as a separate decision.** Almost all the value — never retyping,
consistent voice, provenance, review — is in A and B, and neither needs a single external credential.
C removes one copy-paste and adds a credential-custody surface plus the one failure mode that
actually matters.

When C is built it must be its own component implementing the `ChannelConnector` port, so a platform
generated without LinkedIn simply has no connector registered. Two constraints hold regardless: the
connector delivers only text a human already approved, and it never re-drafts. LinkedIn's current API
product names, scopes and review requirements must be verified against their live documentation at
that point rather than taken from this document.

---

## 11. Rollout

| Stage | Ships | Where |
|---|---|---|
| **1 — the space, one channel, two source kinds** | Kernel contracts + AI image blocks; the `publishing` component; the campus provider in `events`; the ad-hoc source with upload; the space with the three steps; approve → copy → calendar handover | **Sprint 21** |
| **2 — prove it is generic** | A second linked source (conference report or initiative milestone) and the newsletter channel enabled | Should need **no** `publishing` code change — that is the acid test |
| **3 — the website channel** | `wordpress` channel profile (long form, headings, different budget) | Same machine, different profile |
| **4 — calibration** | Edit distance between `ai_body` and the approved `body` per channel and angle, surfaced to admins, feeding the channel profile and `brandVoice` | Without it, prompt tuning is superstition |
| **5 — connector** | A `channel-linkedin` component behind `ChannelConnector`, admin-gated delivery, token custody, scheduling | Its own ADR (§10) |

---

## 12. Governance and verification impact

| Gate | Impact |
|---|---|
| **Table ownership** | `publishing_drafts` and `publishing_sources` are declared in the new manifest. `comms_integration_intents` stays `content`-owned. |
| **Import boundaries** | The design exists to satisfy this: `publishing` imports the kernel and `@/modules/content` only; `events` imports no publishing internals; the registry is a top-level `src/modules/*` file, the permitted place to see both. |
| **Reachability** | `surface: 'internal'` with declared `provides.ui` **and** its own route and nav entry — this component is reachable in the ordinary way, which the button-only design would not have been. |
| **Settings** | Typed `config` requires `provides.settingsPanel: true`; the panel renders automatically. |
| **Dead code** | Every declared export must be reachable; the registry import is what keeps providers from looking dead. |
| **New check (proposed)** | Source reconciliation: declared `provides.sources` ↔ registered providers ↔ `ownedBy`, in the spirit of ADR-0009 §10. |
| **Manifest validation** | `validateManifest` extended for the new optional `provides.sources`. |
| **Kernel change** | Widening `AiMessage.content` is additive; existing callers keep compiling. Worth a focused unit test on `buildMessageRequest` with both shapes. |
| **Migrations** | One migration above the highest on `main` (≥ `00173`), idempotent, plus the storage bucket and the one check-constraint `ALTER`. |
| **Tests** | Pure units for `sourceReadiness`, channel budget, the claims validator, fingerprinting, `reconcileSources`, upload validation, and the rights gate; a domain test that handover is impossible without approval; an e2e smoke on the space. |
| **Docs when built** | `DATA_DICTIONARY.md`, `AI_INTEGRATION.md` (workload + image input), `MODULAR_COMPONENT_ARCHITECTURE.md` §8, `TRACEABILITY.md` (`REQ-PUB-*`), `CHANGELOG.md`, `ROLE_PERMISSION_MODEL.md` if the nav entry changes any matrix row. |

---

## 13. Risks and open questions

**Risks**

| Risk | Mitigation in this design |
|---|---|
| Thin sources produce invented content | The readiness gate refuses to draft (§7.5); claims must cite a sent field |
| A plausible but unsupported sentence gets approved | Claims shown beside their source field; `imageDescription` exposes a misread screenshot |
| Publishing something the organisation would not have said | Unconditional human approval, not a setting (§4.4); admin-only delivery once a connector exists |
| Naming a patient or member without a basis | Consented people only; everyone else is a role or omitted (§8) |
| Prompt injection through ingested text **or through text inside an image** | Curated field payload, `wrapExternalData`, and the instruction stated for both modalities (§7.3) |
| Uploading someone else's copyrighted image, or identifiable people | A rights answer captured at upload; `internal_only` / `needs_clearance` blocks handover (§8) |
| "Simple UI" becoming a UI that hides failure | The degraded states in §9.2 are a design deliverable, not an afterthought |
| "Generic" that is really campus-shaped | Stage 2 is a scheduled acid test, not an aspiration |
| A second channel vocabulary drifting from `content`'s | Reuse `CalendarChannel`; "website" **is** the existing `wordpress` channel |
| Cost creep | Explicit click only, `variantsPerRun` capped, cached system prompt, per-workload model override; images are the expensive part, so one image per run |

**Open questions**

1. **Which linked source comes second** — a conference report, an initiative milestone or a podcast
   episode? Whichever it is decides how quickly Stage 2 proves the seam.
2. **Media on the post.** An ad-hoc source arrives with its image. A campus session has
   `slides_media_id` and `recording_url` but no obvious hero image — is picking one from
   `media_assets` in Stage 1's review UI, or later?
3. **Variants: three or one?** Three angles help a reviewer choose but triple the reading. Starts as a
   setting; the calibration loop should answer it with data.
4. **Language.** Inspire2Live operates in more than 45 countries. One language first — but is a second
   language a channel profile, a variant dimension, or its own concern?
5. **Should ad-hoc uploads also land in the media library?** They are images the organisation now
   holds. Reusing `media_assets` would unify rights handling but couples `publishing` to `content`
   more tightly than the handover alone.
6. **Who is the publisher of record?** If a coordinator approves a draft that turns out to be wrong,
   the audit trail names them. Better decided than discovered.
7. **Does `intake` become a source?** A promoted intake item already produces a calendar draft via
   `buildCalendarDraftFromIntake`. That path should probably stay as it is — but it is the closest
   overlap in the codebase and deserves an explicit answer.

*Resolved since the first draft:* the component is named **`publishing`**, matching the space and the
product vocabulary, rather than `syndication`.

---

## 14. What already exists that this builds on

Nothing here starts from zero, and the fit with what is already there is the main argument for it.

| Existing | Role here |
|---|---|
| `content_calendar` — `channels[]` incl. `linkedin`, `body_draft`, `draft → in_review → scheduled → published → archived` with validated transitions | The destination. Unchanged. |
| `comms_integration_intents` + `logIntegrationIntent` + `triggerLinkedInScheduleStub` | The delivery audit log and the Sprint-21 "stub" delivery. One check-constraint value added. |
| `campus_sessions.decisions_for_publication` / `action_items_for_publication` / `published_outputs` | The publication-intended source fields, and the back-reference `onPublished` writes. |
| `meeting_summaries.publication_blurb` | Already an AI-written, publication-oriented sentence — a source field, not a competitor. |
| `intake_ai_suggestions` (pending/applied/dismissed/superseded, one live row, `applied_by`) | The draft-lifecycle pattern this copies. |
| `uploadTranscript` + the `meeting-transcripts` bucket (`00078`) · `signInboundMediaUrl` | The upload and signed-read patterns for the screenshot path. |
| `media_assets.rights_status` vocabulary | The rights question on an ad-hoc upload, reused rather than reinvented. |
| `podcast-planning` + `network` (ADR-0013) | Module anatomy, soft cross-component references, thresholds as manifest `config`, and `handOverToContentCalendar` as the handover precedent. |
| `kernel/settings` + `modules/settings-registry.ts` | The extension-point mechanism this reuses rather than invents. |
| `kernel/ai-client` — `runAiMessage`, `wrapExternalData`, workload policies, `ai_usage_log` | The only path to a model, including the injection defence. Extended once, additively, for images. |
| `kernel/data` `moduleClient` | Typed access to new tables without `(supabase as any)`. |
| Sprint 19 design system + `ActionModal`, `CollapsibleCard`, `StatusBadge`, `PageSkeleton` | The visual language and most of the primitives the space composes. |
| `is_comms_team_or_admin()` + `src/lib/comms-access.ts` + the comms layout/middleware | RLS, role gate and route protection, reused verbatim. |

---

## References

- [ADR-0014](ADR/0014-publishing-space.md) — the decision record for this concept
- [`MODULAR_COMPONENT_ARCHITECTURE.md`](MODULAR_COMPONENT_ARCHITECTURE.md) — §4 manifest, §6 data contracts, §7 kernel, §9 contract rules, §10 governance, §11 AI levels
- [ADR-0009](ADR/0009-modular-component-architecture.md) · [ADR-0010](ADR/0010-platform-settings-space.md) · [ADR-0013](ADR/0013-opportunity-engine-components.md)
- [`AI_INTEGRATION.md`](AI_INTEGRATION.md) — kernel AI client, structured output, human-in-the-loop; the model catalog lives in `src/kernel/ai-client/models.ts`
- [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md) · [`ROLE_PERMISSION_MODEL.md`](ROLE_PERMISSION_MODEL.md)
- [`ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md`](ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md) · [`PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md`](PLATFORM_SETTINGS_DESIGN_PANEL_CONCEPT.md) — the design system the space composes
- [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) — to be extended when the tables are created
- Delivery: [`sprints/sprint-21-publishing-space/`](../sprints/sprint-21-publishing-space/description.md)

---

*Concept for Sprint 21. Last reviewed: 2026-08-19.*
