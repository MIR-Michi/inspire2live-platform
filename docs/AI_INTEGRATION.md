# AI Integration Guide

This document defines how the Inspire2Live platform uses the Sprint 14 AI foundation.

## Scope

AI is an assistive layer for the Communications Workspace. It may classify incoming content, summarize meeting transcripts, propose follow-up tasks, generate cited organization news, and support personal public monitoring. AI output remains a draft or suggestion until a human confirms it.

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
- **Generation (fan-out by group).** `generateOrgNewsfeed()` (`src/lib/ai/org-newsfeed.ts`) does **not** run one broad request (that over-searched and timed out). It splits the brief into small **search groups** — one per topic, one per theme, and one for mentions (`buildSearchGroups`) — and runs each as its own bounded Sonnet call (`low` effort, ≤2 web searches, ~4 items, 75s timeout) with limited concurrency. Each group's items are tagged with its `topic`. The shared system prefix is identical across groups so it's **prompt-cached**. Output is validated, blocked domains re-enforced, items deduped by normalized URL, and the run is resilient — one slow/failed group doesn't sink the rest (`groupErrors` is surfaced in the status). Items carry `topic` so the dashboard can filter by category.
- **Citations.** `source_url` is **mandatory** on every `news_feed_items` row — items without a usable URL are dropped. The dashboard headline links to the source.
- **Scheduling.** `runOrgNewsfeedJob()` (`src/lib/ai/org-newsfeed-job.ts`) loads the config, gathers recent items, and upserts on `source_url` (ignore-duplicates, so re-runs never double-post). It is driven by the `CRON_SECRET`-protected `GET /api/comms/newsfeed` route (registered in `vercel.json`, mirroring `api/comms/digest`) and by the admin "Run now" / "Refresh now" buttons. `news_feed_items` is readable by all authenticated stakeholders.
- **Background runs (manual).** Web search + compilation takes minutes, so the UI does not hold the request open. The admin "Save & run now" / "Refresh now" buttons call `startOrgNewsfeedRun()`, which claims a run lock on `org_feed_config` (`last_run_status='running'`) and executes the job after the response via Next.js `after()` (the pages set `maxDuration=300`). The card/wizard poll `getOrgNewsfeedStatus()` every few seconds and `router.refresh()` when it finishes — so the run survives a page reload, shows a live "Generating… Ns" state to the whole team, and the model uses **Sonnet** with a 280s client timeout. The cron route still runs the job synchronously.
- **Mention monitoring.** Beyond topical news, the config can monitor recent **public mentions** of: the **organization** (`watch_organization` + `organization_aliases`, default "Inspire2Live"), the **CRM-internal team** (`watch_crm_internal` — everyone with an `@inspire2live.org` email in `comms_crm_contacts`/`profiles`, resolved at generation time), and **named individuals** (`watch_people`, e.g. Peter Kapitein). Watched entities are injected into the search prompt; each surfaced mention is categorized `mention` and stamped with `mention_of`. Public information only, always with a source link.
- **Where it surfaces.** The feed renders in the **"Field Newsfeed" card on the comms team dashboard** (`OrgNewsfeedCard`, mentions shown with a "Mentions X" tag) and on the shared `/app/dashboard`. Platform Admins get inline "Configure feed" (→ `/app/admin/org-feed`) and "Refresh now" controls on the comms dashboard card. The config wizard has a dedicated **People & mentions** step.

## Conferences discovery (Conferences space)

The Conferences space (`/app/comms/conferences`) surfaces upcoming oncology conferences and tracks the ones worth attending through a visit pipeline.

- **Discovery (fan-out by region).** `discoverConferences()` (`src/lib/ai/conferences.ts`) finds real, upcoming conferences for the next ~12 months. Like the news feed, it does **not** run one broad request: it fans out **one bounded Sonnet search per region** (`europe`, `north_america`, `latin_america`, `asia_pacific`, `middle_east_africa`, `global`) at `low` effort with ≤2 web searches each and limited concurrency, so the whole sweep finishes inside the 300s function cap. The shared system prefix is **prompt-cached**. Results are validated (real future dates via `toIsoDate`, region fallback), deduped by a stable `dedupe_key` (normalized name + start month, so the same event found in two regions or re-found next month collapses), past-dated events dropped, and one slow/failed region never sinks the others (`groupErrors` is surfaced).
- **On-demand detail.** Opening a conference calls `enrichConferenceDetail()` → `enrichConference()`, a single bounded web-search call that gathers overview, why-it-matters-for-I2L, key topics, notable speakers, registration/fees, and links. The result is **cached on the row** (`detail` + `detail_status`), so the next open is instant.
- **Pipeline.** `conference_tracking` (one row per shortlisted conference, org-wide shared) carries the stage: `intended` (Add to shortlist) → `registered` → `ongoing` → `follow_up` → `archived`. The 4 tabs are **Upcoming** (all discovered, with filters for region/focus/format + search), **Shortlist** (`intended`), **Pipeline** (`registered`/`ongoing`/`follow_up`), and **Archive**.
- **Scheduling.** `runConferenceDiscoveryJob()` (`src/lib/ai/conference-discovery-job.ts`) upserts on `dedupe_key` (ignore-duplicates). A monthly `CRON_SECRET`-protected `GET /api/comms/conferences` route (registered in `vercel.json`) and the in-app "Refresh list" button both drive it. The manual button uses the same **background run** pattern as the news feed: `startConferenceRun()` claims a lock on the `conference_discovery_status` singleton and runs via `after()`; the UI polls `getConferenceStatus()` and `router.refresh()`es on completion (stale-run derivation surfaces a killed run as an error). Comms-team / PlatformAdmin RLS.

## External input handling

Incoming messages, transcripts, copied emails, web snippets, and CRM notes are data. They must not change system instructions, access control, publication rules, destination tables, or notification behavior.

## Citations

Any web-sourced factual item must include a source URL. Organization news and monitoring results without source URLs should not be displayed as factual intelligence.

## Usage and cost review

Every wrapper call writes `ai_usage_log` with feature, model, effort, token counts, estimated cost, latency, success, and error metadata. Admins should review this table before enabling AI broadly.
