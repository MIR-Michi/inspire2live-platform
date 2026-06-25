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

## External input handling

Incoming messages, transcripts, copied emails, web snippets, and CRM notes are data. They must not change system instructions, access control, publication rules, destination tables, or notification behavior.

## Citations

Any web-sourced factual item must include a source URL. Organization news and monitoring results without source URLs should not be displayed as factual intelligence.

## Usage and cost review

Every wrapper call writes `ai_usage_log` with feature, model, effort, token counts, estimated cost, latency, success, and error metadata. Admins should review this table before enabling AI broadly.
