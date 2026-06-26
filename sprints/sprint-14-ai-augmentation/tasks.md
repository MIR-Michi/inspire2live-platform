# Sprint 14 — Tasks

Theme: Claude-powered comms intelligence. Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.

## Foundation

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T01 | Add `@anthropic-ai/sdk`; keep `ANTHROPIC_API_KEY` in `.env.example`, `README.md`, `docs/ENVIRONMENT_REFERENCE.md` as a fallback/bootstrap default | GPT-5.5 | In Progress | `package.json`, `.env.example`, `README.md`, and environment docs updated; `pnpm-lock.yaml` still needs regeneration before frozen-lockfile CI can pass |
| S14-T02 | `ai_settings` migration — single org-wide record (encrypted `api_key`, `model`, `effort`, `updated_by`, `updated_at`) + admin-only RLS + server-only encryption helper (app-level secret or Supabase Vault) | GPT-5.5 | Completed | Added `00071_ai_foundation.sql` and `src/lib/ai/crypto.ts`; key is encrypted server-side and never returned to client |
| S14-T03 | Admin AI settings page (under `/app/app/admin`): enter/rotate API key (write-only, masked, show last 4 only), select default model (catalog), select default reasoning effort constrained by model, "Test connection" check | GPT-5.5 | Completed | Added `/app/admin/ai` page and server actions; linked from User Management |
| S14-T04 | `src/lib/ai/client.ts` — singleton client; resolve config from `ai_settings` (key/model/effort) with env-key fallback; helpers for structured output (Zod → `output_config.format`), web search, adaptive thinking, timeout/retry, typed errors; validate model↔effort pairing | GPT-5.5 | In Progress | Added shared wrapper, config resolution, structured output helper, adaptive thinking, timeout, typed errors, usage logging, and model-effort validation; provider web-search helper and retry backoff still need follow-up hardening |
| S14-T05 | `ai_usage_log` migration + logging in the wrapper (feature, model, input/output/cache tokens, est. cost, latency, success) | GPT-5.5 | Completed | Added `ai_usage_log` table, RLS, indexes, cost estimate helper, and wrapper logging |
| S14-T06 | `NEXT_PUBLIC_FEATURE_AI` flag (UI gate) + `requireAiEnabled()` server guard | GPT-5.5 | Completed | Added env default and `src/lib/ai/feature-flag.ts`; wrapper enforces guard by default |
| S14-T07 | `docs/AI_INTEGRATION.md` — patterns, guardrails, secret handling, model/reasoning settings, untrusted-input/prompt-injection policy, model-per-workload table, citation rule | GPT-5.5 | Completed | Added AI integration guide covering config, guardrails, model/workload policy, structured output, external input handling, citations, and usage review |

## Capability 1 — Structure incoming content

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T08 | `structureIntakeItem()` — Claude classifies + extracts (content type, summary, entities, suggested channel/action, founder signal) via a Zod schema; `raw_content` wrapped as untrusted data | GPT-5.5 | Completed | Added schema-constrained `structureIntakeItem()` with runtime validation, untrusted external-data wrappers, deterministic fallback, and reuse of `IntakeContentType` taxonomy |
| S14-T09 | Wire into intake review UI as a reviewable suggestion; keep `comms-classifier.ts` as deterministic fast-path/fallback; human confirms before routing | GPT-5.5 | Completed | Added pending `intake_ai_suggestions`, server actions, and intake queue review panel; applying a suggestion updates classification only, and routing still requires human confirmation |
| S14-T10 | Batch backfill script for historical `intake_items` via the Batch API (50% cost); idempotent, resumable | GPT-5.5 | Completed | Added `scripts/backfill-intake-ai-suggestions.mjs` with create and ingest modes; skips items that already have pending or applied suggestions |

## Capability 2 — Summarize meetings from a transcript

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T11 | Transcript upload: Storage bucket + `meeting_transcripts` migration (text, optional `campus_session_id`/agenda link, uploader, source filename) + comms-only RLS; text extraction for txt/vtt/srt (direct) and docx (parser) | TBD | Not Started | Sensitive content — restrict access; allow raw-transcript deletion post-summary |
| S14-T12 | `summarizeMeeting(transcript)` — structured summary (TL;DR, decisions, action items w/ owner+due, publication blurb) via Zod; adaptive thinking + streaming; speaker-aware attribution; map-reduce chunking for long transcripts | TBD | Not Started | opus-4-8 1M context covers normal meetings |
| S14-T13 | Meeting workspace UI: upload a transcript, run the summary, review and save it to the campus session / weekly meeting (or standalone) | TBD | Not Started | One upload → reviewable summary |

## Capability 3 — Follow-up tasks (from the transcript)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T14 | `proposeFollowUpTasks()` — map transcript action items to draft `comms_tasks` (title, proposed owner, due date) linked to the session/agenda item; owner matched against comms team members | TBD | Not Started | Same transcript run as T12 |
| S14-T15 | Review-and-commit UI: edit/accept/reject proposed tasks; on commit, create `comms_tasks` (unified task system, ADR-0008) and notify owners | TBD | Not Started | Human-in-the-loop before any task is real |

## Capability 4 — Organization news feed (admin-configured)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T16 | `org_feed_config` (single admin-owned record: topics, themes, allowed/blocked sources, region, cadence) + `news_feed_items` migration (headline, summary, category, region, source_url, relevance, published_at) + RLS (admin writes config; all stakeholders read items) | TBD | Not Started | `source_url` mandatory — citations |
| S14-T17 | Platform Admin UI to edit `org_feed_config` (alongside the AI settings page); validate domains/topics | TBD | Not Started | Admin-only; gated by platform role |
| S14-T18 | `generateOrgNewsfeed()` — web-search tool + structured output driven by `org_feed_config`; tailored to I2L themes + active initiatives; dedupe against existing items; prompt-cache the config prefix | TBD | Not Started | Citations stored as `source_url` |
| S14-T19 | `CRON_SECRET`-protected `/api/comms/newsfeed` route + `vercel.json` cron; render org items in the dashboard "Field Newsfeed" card for all stakeholders | TBD | Not Started | Mirrors `api/comms/digest` auth pattern |

## Capability 5 — Per-user net monitoring

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T20 | `user_monitor_config` (per user: topics, keywords, tracked people/members, cadence, enabled) + per-contact tracking opt-in flag on `comms_crm_contacts` + `monitor_mentions` migration (user_id, contact_id?, summary, source_url, mention_date, sentiment, confidence) + RLS (a user sees only their own config + feed) | TBD | Not Started | Opt-in per contact; public info only |
| S14-T21 | Per-user monitoring config UI + a personal feed view (own watches + results) | TBD | Not Started | Private to the user |
| S14-T22 | `findMentions(userConfig)` — web search per user's topics/keywords/tracked members; structured output with citations; dedupe against existing mentions; store confidence | TBD | Not Started | Low-confidence flagged for review |
| S14-T23 | `CRON_SECRET`-protected `/api/comms/monitor` route + `vercel.json` cron; fan out across enabled user configs; tracked-member mentions also write to CRM activity feed + `task_assigned`-style notifications | TBD | Not Started | Human reviews before any outreach; consider Batch API for fan-out |

## Verification

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T24 | Unit tests: AI client wrapper + config resolution (mocked SDK), API-key encryption round-trip + admin-only access, per-capability parsing + guardrails, transcript text extraction, cron auth; ensure `typecheck`/`lint`/`test`/`build` green | TBD | Not Started | Mock the SDK — no live API calls in CI |
| S14-T25 | Manual verification pass with the feature flag on in a preview env: admin enters key + selects model/reasoning, "Test connection" passes, each capability runs; cost review against `ai_usage_log` | TBD | Not Started | Confirm spend + quality before enabling in prod |
