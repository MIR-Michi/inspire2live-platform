# AI Integration Guide

This document defines how the Inspire2Live platform uses the Sprint 14 AI foundation.

## Scope

AI is an assistive layer for the Communications Workspace. It may classify incoming content, summarize meeting transcripts, propose follow-up tasks, generate cited organization news, draft channel-ready posts from curated source material, propose podcast questions and guests from open scholarly catalogues, and support personal public monitoring. AI output remains a draft or suggestion until a human confirms it.

## Configuration

AI configuration is resolved on the server in this order:

1. `public.ai_settings`, managed by Platform Admin users.
2. `ANTHROPIC_API_KEY`, used only as an environment fallback.

The admin-managed credential is encrypted before storage. The browser receives only whether a credential is set and the last four characters. Clear text values must stay server-side.

Related environment variables:

| Variable | Scope | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Server only | Fallback provider credential. |
| `AI_SETTINGS_ENCRYPTION_KEY` | Server only | Encryption material for stored provider credentials. |
| `NEXT_PUBLIC_FEATURE_AI` | Client and server | Feature flag for AI UI and server calls. |

## Dependency and lockfile caveat

Whenever `@anthropic-ai/sdk` or any other package is added or changed, update `pnpm-lock.yaml` in the same PR. Vercel and GitHub CI can fail with `ERR_PNPM_OUTDATED_LOCKFILE` when `package.json` and `pnpm-lock.yaml` do not match.

The proper fix is to run:

```bash
pnpm install --lockfile-only
```

Then commit both `package.json` and `pnpm-lock.yaml`. The current Sprint 14 branch uses `pnpm install --no-frozen-lockfile` in `vercel.json` as a temporary preview-build safety valve only. Before merging to `main`, restore frozen installs once the lockfile is regenerated.

## Canonical location

Since the modular restructure (ADR-0009) the AI client lives in the kernel at
`src/kernel/ai-client/*` (`client.ts`, `models.ts`, `crypto.ts`, `feature-flag.ts`).
The historical `src/lib/ai/*` paths referenced throughout this document are thin
**re-export shims** that point at the kernel module and remain valid import paths.

## Shared wrapper

All provider calls must go through the kernel AI client wrapper
(`src/kernel/ai-client/client.ts`; also importable as `@/lib/ai/client`). Product code
must not instantiate the SDK directly. The wrapper centralizes configuration, model and
effort validation, structured output setup, usage logging, and typed errors.

## Model and effort policy

**The model catalog is code, not this document.** `src/kernel/ai-client/models.ts` is the
single source of truth for the available models, their effort levels, and per-workload
defaults; workload overrides can also be configured at runtime (Platform Settings).
Consult that file rather than hardcoding model names here — doing so keeps this guide from
drifting as the catalog evolves.

Every workload maps to a default model + effort chosen for its job (e.g. long-context
models for meeting summaries, lighter models for simple backfills). The server validates
the selected effort against the selected model before each request.

## Structured output

Use schema constrained output for classification, extraction, summaries, news items, and mention results. Capability code should validate parsed output again before writing durable records.

Recommended flow:

1. Build deterministic context.
2. Delimit external data with `wrapExternalData()`.
3. Request structured output.
4. Validate the parsed result.
5. Store reviewable suggestions only.
6. Require human confirmation before committing.

## Image input

`AiMessage.content` accepts either a plain string (the original shape, unchanged) or an array of
`AiContentBlock`s — `{ type: 'text' }` and `{ type: 'image' }`. The wrapper forwards blocks to the
provider verbatim, so a workload that needs to read a screenshot composes the blocks itself. Two
rules bind every caller:

- **Encode server-side.** Images are downloaded from private storage and base64-encoded on the
  server. An image must never round-trip through the browser to reach the model.
- **Check the workload's model.** Not every catalog entry accepts image input. Confirm the resolved
  model for the workload does before sending blocks — `src/kernel/ai-client/models.ts` remains the
  source of truth.

Images are the expensive part of a request, so a workload should send as few as the job needs
(`channel_post_draft` sends one per run).

## Meeting transcripts (Capability 2)

Transcript summarization lives in `src/lib/ai/transcript-extract.ts` (ingestion) and `src/lib/ai/meeting-summary.ts` (summarization), surfaced in the comms workspace at `/app/comms/transcripts`.

- **Upload + extraction.** Raw files upload to the private `meeting-transcripts` Storage bucket (comms-only RLS). `extractTranscriptText()` produces plain text: `txt` is decoded directly, `vtt`/`srt` have indices/timestamps/styling stripped while speaker labels are preserved, and `docx` is parsed from its `word/document.xml` body with a dependency-free ZIP reader. Extracted text is persisted in `meeting_transcripts`.
- **Sensitivity.** Transcripts may contain sensitive discussion, so both the bucket and the `meeting_transcripts` / `meeting_summaries` tables are restricted to `is_comms_team_or_admin()`. The raw upload can be deleted after a summary is produced (`deleteRawTranscript` clears `storage_path` and sets `raw_deleted_at`); the extracted text and summary are retained.
- **Summarization.** `summarizeMeeting()` requests a schema-constrained summary (TL;DR, decisions, action items with owner + due, publication blurb) on `claude-opus-4-8` with adaptive thinking. Speaker labels are detected and passed in so decisions and owners are attributed to named participants.
- **Long transcripts.** opus-4-8's 1M context covers normal meetings; transcripts over `MAX_SINGLE_PASS_CHARS` are map-reduced — each chunk is summarized to notes (`chunkTranscript()` splits on line boundaries), then the notes are reduced into the final structured summary.
- **Human-in-the-loop.** A generated summary is written as a `pending` `meeting_summaries` record. A human reviews it and saves it to a campus session, a weekly agenda item, or standalone; only then is it filed onto the session's publication fields.
- **In-meeting UX.** Transcripts are added from inside the meeting they belong to via a shared `MeetingTranscriptPanel` (`src/components/comms/meeting-transcript-panel.tsx`): each **bi-weekly meeting** (on `/app/comms/meetings` and the dashboard "Bi-weekly meeting" card, anchored by `meeting_date`) and each **campus session** (on the session detail page, anchored by `campus_session_id`) shows an "Add transcript → Summarize → review summary + follow-up tasks" flow in place. The standalone `/app/comms/transcripts` page remains as an all-transcripts library.

## Follow-up tasks (Capability 3)

The same transcript run that produces a summary also drafts follow-up tasks. `proposeFollowUpTasks()` (`src/lib/ai/follow-up-tasks.ts`) is a **deterministic** transform — it reuses the structured action items Claude already extracted (no second model call), matches each proposed owner against comms team members (full name, email local-part, then a unique first name), and parses an ISO due date where one was given. Natural-language due hints are preserved for the human to resolve.

- **Generation.** `generateFollowUpProposals()` (`src/lib/ai/follow-up-tasks-store.ts`) runs after the summary is stored (and via a "Re-propose" action), writing pending `meeting_followup_tasks` rows. It is idempotent — prior pending proposals for a summary are superseded first.
- **Human-in-the-loop.** Nothing is created automatically. In the workspace a human edits the title, owner, and due date, then accepts or rejects each proposal. **Committing** creates a real `comms_task` (ADR-0008 unified task system), inherits the transcript's session / agenda-item link, notifies the owner via `notifyUser({ event: 'task_assigned' })`, and marks the proposal `committed`.

## Organization news feed (Capability 4)

An admin-configured, web-search-driven org feed fills the dashboard "Field Newsfeed" card for all stakeholders.

- **Config.** `org_feed_config` is a single Platform-Admin-owned record (topics, themes, allowed/blocked source domains, region, cadence, enabled). Edited at `/app/admin/org-feed` via a guided, checkbox-driven **wizard** (`OrgFeedWizard`) with a curated cancer/advocacy taxonomy (`src/lib/ai/org-feed-catalog.ts`): themes → topic categories/subtopics → trusted/blocked sources → region & cadence → review. The wizard round-trips an existing config back into checkboxes + custom chips (`splitKnownAndCustom`) so the same flow serves first-time setup and later editing. `validateOrgFeedConfig()` parses lists and validates/normalizes domains server-side. Admin-only RLS.
- **Generation (fan-out by group).** `generateOrgNewsfeed()` (`src/modules/ai-features/domain/org-newsfeed.ts`) does **not** run one broad request (that over-searched and timed out). It splits the brief into small **search groups** — one per topic, one per theme, and one for mentions (`buildSearchGroups`) — and runs each as its own bounded Sonnet call (≤2 web searches, 4 items — 8 for mention groups — and a 60s timeout) at a concurrency of 4. Each group's items are tagged with its `topic`. The shared system prefix is identical across groups so it's **prompt-cached**. Output is validated, blocked domains re-enforced, items deduped by normalized URL, and the run is resilient — one slow/failed group doesn't sink the rest (`groupErrors` is surfaced in the status). Items carry `topic` so the dashboard can filter by category.
- **Citations.** `source_url` is **mandatory** on every `news_feed_items` row — items without a usable URL are dropped. The dashboard headline links to the source.
- **Scheduling.** `runOrgNewsfeedJob()` (`src/lib/ai/org-newsfeed-job.ts`) loads the config, gathers recent items, and upserts on `source_url` (ignore-duplicates, so re-runs never double-post). It is driven by the `CRON_SECRET`-protected `GET /api/comms/newsfeed` route (registered in `vercel.json`, mirroring `api/comms/digest`) and by the admin "Run now" / "Refresh now" buttons. `news_feed_items` is readable by all authenticated stakeholders.
- **Background runs (manual).** Web search + compilation takes minutes, so the UI does not hold the request open. The admin "Save & run now" / "Refresh now" buttons call `startOrgNewsfeedRun()`, which claims a run lock on `org_feed_config` (`last_run_status='running'`) and executes the job after the response via Next.js `after()` (the pages set `maxDuration=300`). The card/wizard poll `getOrgNewsfeedStatus()` every few seconds and `router.refresh()` when it finishes — so the run survives a page reload, shows a live "Generating… Ns" state to the whole team, and the model uses **Sonnet** with a 280s client timeout. The cron route still runs the job synchronously.
- **Mention monitoring.** Beyond topical news, the config can monitor recent **public mentions** of: the **organization** (`watch_organization` + `organization_aliases`, default "Inspire2Live"), the **CRM-internal team** (`watch_crm_internal` — everyone with an `@inspire2live.org` email in `comms_crm_contacts`/`profiles`, resolved at generation time), and **named individuals** (`watch_people`, e.g. Peter Kapitein). Watched entities are injected into the search prompt; each surfaced mention is categorized `mention` and stamped with `mention_of`. Public information only, always with a source link.
- **Where it surfaces.** The feed renders in the **"Field Newsfeed" card on the comms team dashboard** (`OrgNewsfeedCard`, mentions shown with a "Mentions X" tag) and on the shared `/app/dashboard`. Platform Admins get inline "Configure feed" (→ `/app/admin/org-feed`) and "Refresh now" controls on the comms dashboard card. The config wizard has a dedicated **People & mentions** step.

## Conferences discovery (Conferences space)

The Conferences space (`/app/comms/conferences`) surfaces upcoming oncology conferences and tracks the ones worth attending through a visit pipeline.

- **Discovery (fan-out by region × lens).** `discoverConferences()` (`src/modules/ai-features/domain/conferences.ts`) finds real, upcoming conferences for the next ~12 months. Like the news feed, it does **not** run one broad request: it crosses the six regions (`europe`, `north_america`, `latin_america`, `asia_pacific`, `middle_east_africa`, `global`) with six **discovery lenses** (flagship meetings, tumour-specific, research/precision, advocacy & survivorship, society calendars, listing directories), giving ~36 bounded lanes run at a concurrency of 8 with a 50s timeout each, so the whole sweep finishes inside the 300s function cap. The shared system prefix — including the capped, stably sorted "already have these" list — is **prompt-cached**, so it is billed once per run rather than on each of the ~36 lanes. Results are validated (real future dates via `toIsoDate`, region fallback), deduped by a stable `dedupe_key` (normalized name + start month, so the same event found in two regions or re-found next month collapses), past-dated events dropped, and one slow/failed region never sinks the others (`groupErrors` is surfaced).
- **On-demand detail.** Opening a conference calls `enrichConferenceDetail()` → `enrichConference()`, a single bounded web-search call that gathers overview, why-it-matters-for-I2L, key topics, notable speakers, registration/fees, and links. The result is **cached on the row** (`detail` + `detail_status`), so the next open is instant.
- **Pipeline.** `conference_tracking` (one row per shortlisted conference, org-wide shared) carries the stage: `intended` (Add to shortlist) → `registered` → `ongoing` → `follow_up` → `archived`. The 4 tabs are **Upcoming** (all discovered, with filters for region/focus/format + search), **Shortlist** (`intended`), **Pipeline** (`registered`/`ongoing`/`follow_up`), and **Archive**.
- **Scheduling.** `runConferenceDiscoveryJob()` (`src/lib/ai/conference-discovery-job.ts`) upserts on `dedupe_key` (ignore-duplicates). A monthly `CRON_SECRET`-protected `GET /api/comms/conferences` route (registered in `vercel.json`) and the in-app "Refresh list" button both drive it. The manual button uses the same **background run** pattern as the news feed: `startConferenceRun()` claims a lock on the `conference_discovery_status` singleton and runs via `after()`; the UI polls `getConferenceStatus()` and `router.refresh()`es on completion (stale-run derivation surfaces a killed run as an error). Comms-team / PlatformAdmin RLS.

## Channel post drafting (Publishing space)

The Publishing space (`/app/comms/publishing`) drafts channel-ready copy from either a platform
record or an uploaded screenshot, on the `channel_post_draft` workload. Decision: ADR-0014. Concept:
`docs/PUBLISHING_SPACE_CONCEPT.md`.

- **One payload, two source kinds.** The drafter never reads a page or a row. Each owning component
  exports a `SourceProvider` that hands over a curated `PublishableSource` — publication-intended
  fields only — and an uploaded screenshot arrives through the same contract. A campus session's
  transcript, WhatsApp digest, attendee list and internal comments are therefore never sent.
- **Prompt assembly.** `buildSystemPrompt()` (`src/modules/publishing/domain/drafting.ts`) is stable
  across runs and sent with `cacheSystemPrompt`; it carries the channel profile's conventions and
  character budget, the operator-configured brand voice, banned phrases and hashtag policy. Every
  source field goes in individually wrapped with `wrapExternalData()`, keyed so the model can cite it.
- **Groundedness is validated, not trusted.** Output is schema-constrained, and every variant must
  map each factual assertion to the source field it came from via `claims[].sourceFieldKey`. A
  citation naming a field that was not sent fails validation and **nothing is written** — there is no
  deterministic fallback for prose, so the failure is hard and visible with a retry.
- **Screenshots are read back to the reviewer.** When an image is attached the model must describe
  what it actually sees in `imageDescription`, which the review UI shows, so a misread is obvious
  before anyone approves it.
- **Human approval is not a setting.** Variants land as `pending` rows; a human edits in place
  (`ai_body` keeps the untouched model output for calibration) and approves explicitly, which stamps
  the approver and dismisses the siblings. Only then can the copy hand over to a `content_calendar`
  entry through `content`'s own action. Regenerating supersedes the previous run.
- **Every other tunable is manifest `config`** — variants per run, brand voice, banned phrases,
  hashtag policy, readiness threshold, upload ceiling, stale behaviour — editable in Platform
  Settings without a deploy.

## Podcast Radar (Podcast planner, Phase B)

The podcast planner's assisted discovery, on the `podcast_radar_names` and `podcast_radar_topics`
workloads. Decision: [ADR-0016](ADR/0016-radar-structured-sources.md). Concept:
`docs/PODCAST_RADAR_CONCEPT.md`. Delivery: `sprints/sprint-22-podcast-radar/`.

- **The model does not find anybody.** This is the one thing that separates Radar from every other AI
  feature here. Facts about real people — name, affiliation, what they published, when — come from
  open catalogue APIs in `src/kernel/sources` (**OpenAlex** and **Europe PMC**), never from a model
  and never from web search. The model is handed records that were already retrieved and asked only
  to *group* them and *phrase* the result as a question.
- **Grounding is enforced, not requested.** The model refers to people by reference (`p3`), never by
  name; `groundNames`/`groundTopics` (`domain/radar-grounding.ts`) resolve every reference back
  against the list supplied and **drop** anything that does not resolve, counting the drops. Names,
  organisations and countries are always taken from the source record, never from the reply — so a
  fabricated person cannot reach a reviewer even if the model invents one.
- **On the names workload the model ranks; it does not decide.** It used to inherit a shared rule
  saying "an empty answer is a useful answer", and acted on it: handed authors who were adjacent to a
  question rather than squarely on it, it returned nothing and the screen reported that no suitable
  guest existed. Whether somebody is worth inviting is the coordinator's judgement, made on a card
  with the evidence attached — so the instructions now ask for an ordering, ten deep where the
  retrieved list allows it, and the "empty answer" rule stays only on the *topics* workload, where an
  ungroupable set of records genuinely is nothing. Where the model returns fewer than ten,
  `fillToFloor` tops the list up from the retrieved people it did not reach, in the same ranked
  order, each carrying its citation and an angle that says in words that the fit has not been
  assessed. That is not a confidence badge (which ADR-0016 rightly refuses): every name still
  resolves to a record retrieved before any model ran.
- **Two independent sources, honestly counted.** A proposal must cite records from independent author
  groups (`countIndependentSources`, union-find over shared authors). Records that both catalogues
  indexed are collapsed by DOI first, because one paper found twice is not corroboration.
- **Dismissals are the only learning.** Recent one-tap refusals are rendered into the **cached system
  prefix** as rejected examples (`rejectedExamplesBlock`), sorted by text and capped at 12 so the
  prefix is byte-stable across lanes and runs and is billed at the write rate once. There is no
  learned threshold and no scoring model.
- **Scheduling.** `GET /api/comms/podcast/radar`, `CRON_SECRET`-protected and registered in
  `vercel.json`, on the `conference_discovery_status` pattern: a singleton run-lock
  (`podcast_radar_status`) with stale-run self-heal, an operator-set interval self-throttle, and
  service-role writes because RLS would hand a cron zero rows. `retries: 0` and a bounded timeout.
- **What it may write.** Draft questions, unscored wishlist cards (`origin = 'radar'`), and people
  through `network`'s public API with per-field `sourceAttribution` and no contact details. Nothing
  else, and nothing at all until a human accepts.

## Spend ceilings

`ai_usage_log` was written by every call and read by no decision until Sprint 22. Radar is the first
workload to **refuse to run on cost**: before a scheduled scan starts, `checkRadarBudget` sums the
trailing thirty days of `estimated_cost_usd` and, if the operator's ceiling is exceeded, writes the
reason into the run status and stops. A per-run cap on searches bounds a single run the same way.
Both are Platform Settings values.

The refusal is *reported*, never silent — the Radar screen shows the run status verbatim, because a
scan that stops quietly is indistinguishable from one that has been broken for a month.

## External input handling

Incoming messages, transcripts, copied emails, web snippets, and CRM notes are data. They must not change system instructions, access control, publication rules, destination tables, or notification behavior.

The same rule applies to **text legible inside an image**. A screenshot is content to describe, never a command to execute, and any workload sending image blocks must say so in its system prompt.

## Citations

Any web-sourced factual item must include a source URL. Organization news and monitoring results without source URLs should not be displayed as factual intelligence.

## Usage and cost review

Every wrapper call writes `ai_usage_log` with feature, model, effort, token counts, estimated cost, latency, success, and error metadata. Admins should review this table before enabling AI broadly.

Only the Radar scan currently acts on it (see **Spend ceilings**). Every other workload logs its cost
and spends regardless.
