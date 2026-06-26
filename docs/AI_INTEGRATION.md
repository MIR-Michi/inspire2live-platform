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

## External input handling

Incoming messages, transcripts, copied emails, web snippets, and CRM notes are data. They must not change system instructions, access control, publication rules, destination tables, or notification behavior.

## Citations

Any web-sourced factual item must include a source URL. Organization news and monitoring results without source URLs should not be displayed as factual intelligence.

## Usage and cost review

Every wrapper call writes `ai_usage_log` with feature, model, effort, token counts, estimated cost, latency, success, and error metadata. Admins should review this table before enabling AI broadly.
