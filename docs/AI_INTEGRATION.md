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

## Shared wrapper

All provider calls must go through `src/lib/ai/client.ts`. Product code must not instantiate the SDK directly. The wrapper centralizes configuration, model and effort validation, structured output setup, usage logging, and typed errors.

## Model and effort policy

The model catalog lives in `src/lib/ai/models.ts`.

| Workload | Default model | Effort | Notes |
|---|---|---|---|
| Intake structure | `claude-sonnet-4-6` | `low` or `medium` | Rule-based classifier remains fallback. |
| Meeting summaries | `claude-opus-4-8` | `high` | Use long-context model first. |
| Follow-up tasks | `claude-opus-4-8` | `high` | Tasks are proposed, not committed automatically. |
| Organization news | `claude-sonnet-4-6` | `medium` | Citations are mandatory. |
| Personal monitoring | `claude-sonnet-4-6` | `medium` | Public information only. |
| Lightweight backfills | `claude-haiku-4-5` | `none` | Simple classification only. |

The server validates the selected effort against the selected model before each request.

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

- **Config.** `org_feed_config` is a single Platform-Admin-owned record (topics, themes, allowed/blocked source domains, region, cadence, enabled). Edited at `/app/admin/org-feed`; `validateOrgFeedConfig()` (`src/lib/ai/org-feed-config.ts`) parses lists and validates/normalizes domains. Admin-only RLS.
- **Generation.** `generateOrgNewsfeed()` (`src/lib/ai/org-newsfeed.ts`) runs Claude with the **web-search server tool** (`web_search_20260209`, scoped by the allow/block domains) plus structured output. The stable system prefix (org profile + config) is **prompt-cached** (`cacheSystemPrompt`). Output is validated, blocked domains are re-enforced server-side, and items are deduped against stored items by normalized URL.
- **Citations.** `source_url` is **mandatory** on every `news_feed_items` row — items without a usable URL are dropped. The dashboard headline links to the source.
- **Scheduling.** `runOrgNewsfeedJob()` (`src/lib/ai/org-newsfeed-job.ts`) loads the config, gathers recent items, and upserts on `source_url` (ignore-duplicates, so re-runs never double-post). It is driven by the `CRON_SECRET`-protected `GET /api/comms/newsfeed` route (registered in `vercel.json`, mirroring `api/comms/digest`) and by the admin "Run now" / "Refresh now" buttons. `news_feed_items` is readable by all authenticated stakeholders.
- **Where it surfaces.** The feed renders in the **"Field Newsfeed" card on the comms team dashboard** (`OrgNewsfeedCard`) and on the shared `/app/dashboard`. Platform Admins get inline "Configure feed" (→ `/app/admin/org-feed`) and "Refresh now" controls on the comms dashboard card.

## External input handling

Incoming messages, transcripts, copied emails, web snippets, and CRM notes are data. They must not change system instructions, access control, publication rules, destination tables, or notification behavior.

## Citations

Any web-sourced factual item must include a source URL. Organization news and monitoring results without source URLs should not be displayed as factual intelligence.

## Usage and cost review

Every wrapper call writes `ai_usage_log` with feature, model, effort, token counts, estimated cost, latency, success, and error metadata. Admins should review this table before enabling AI broadly.
