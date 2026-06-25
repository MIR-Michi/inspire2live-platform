# Sprint 14 — Tasks

Theme: Claude-powered comms intelligence. Status values: `Not Started` · `In Progress` · `Completed` · `Blocked`.

## Foundation

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T01 | Add `@anthropic-ai/sdk`; add `ANTHROPIC_API_KEY` to `.env.example`, `README.md`, `docs/ENVIRONMENT_REFERENCE.md`, and Vercel env docs | TBD | Not Started | Server-side only; key never exposed to the browser |
| S14-T02 | Build `src/lib/ai/client.ts` — singleton Anthropic client, default `claude-opus-4-8`, helpers for structured output (Zod → `output_config.format`), web search, adaptive thinking, timeout/retry, and typed error handling | TBD | Not Started | One wrapper all features call; no direct SDK use elsewhere |
| S14-T03 | `ai_usage_log` migration + logging in the wrapper (feature, model, input/output/cache tokens, est. cost, latency, success) | TBD | Not Started | Makes spend visible from day one |
| S14-T04 | `NEXT_PUBLIC_FEATURE_AI` flag (UI gate) + `requireAiEnabled()` server guard; wire into `next.config`/feature-flag helper | TBD | Not Started | Ship dark; enable per environment |
| S14-T05 | `docs/AI_INTEGRATION.md` — patterns, guardrails, untrusted-input/prompt-injection policy, model-per-workload table, citation rule | TBD | Not Started | The "how we use Claude" reference |

## Capability 1 — Structure incoming content

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T06 | `structureIntakeItem()` — Claude classifies + extracts (content type, summary, entities, suggested channel/action, founder signal) via a Zod schema; `raw_content` wrapped as untrusted data | TBD | Not Started | Reuses `IntakeContentType` from `comms-workflow` |
| S14-T07 | Wire into intake review UI as a reviewable suggestion; keep `comms-classifier.ts` as deterministic fast-path/fallback; human confirms before routing | TBD | Not Started | Augment, don't replace, the rule engine |
| S14-T08 | Batch backfill script for historical `intake_items` via the Batch API (50% cost); idempotent, resumable | TBD | Not Started | Non-latency-sensitive — batch, not live |

## Capability 2 — Summarize meetings from a transcript

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T09 | Transcript upload: Storage bucket + `meeting_transcripts` migration (text, optional `campus_session_id`/agenda link, uploader, source filename) + comms-only RLS; text extraction for txt/vtt/srt (direct) and docx (parser) | TBD | Not Started | Sensitive content — restrict access; allow raw-transcript deletion post-summary |
| S14-T10 | `summarizeMeeting(transcript)` — structured summary (TL;DR, decisions, action items w/ owner+due, publication blurb) via Zod; adaptive thinking + streaming; speaker-aware attribution; map-reduce chunking for long transcripts | TBD | Not Started | opus-4-8 1M context covers normal meetings |
| S14-T11 | Meeting workspace UI: upload a transcript, run the summary, review and save it to the campus session / weekly meeting (or standalone) | TBD | Not Started | One upload → reviewable summary |

## Capability 3 — Follow-up tasks (from the transcript)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T12 | `proposeFollowUpTasks()` — map transcript action items to draft `comms_tasks` (title, proposed owner, due date) linked to the session/agenda item; owner matched against comms team members | TBD | Not Started | Same transcript run as T10 |
| S14-T13 | Review-and-commit UI: edit/accept/reject proposed tasks; on commit, create `comms_tasks` (unified task system, ADR-0008) and notify owners | TBD | Not Started | Human-in-the-loop before any task is real |

## Capability 4 — Organization news feed (admin-configured)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T14 | `org_feed_config` (single admin-owned record: topics, themes, allowed/blocked sources, region, cadence) + `news_feed_items` migration (headline, summary, category, region, source_url, relevance, published_at) + RLS (admin writes config; all stakeholders read items) | TBD | Not Started | `source_url` mandatory — citations |
| S14-T15 | Platform Admin UI to edit `org_feed_config` (under `/app/app/admin`); validate domains/topics | TBD | Not Started | Admin-only; gated by platform role |
| S14-T16 | `generateOrgNewsfeed()` — web-search tool + structured output driven by `org_feed_config`; tailored to I2L themes + active initiatives; dedupe against existing items; prompt-cache the config prefix | TBD | Not Started | Citations stored as `source_url` |
| S14-T17 | `CRON_SECRET`-protected `/api/comms/newsfeed` route + `vercel.json` cron; render org items in the dashboard "Field Newsfeed" card for all stakeholders | TBD | Not Started | Mirrors `api/comms/digest` auth pattern |

## Capability 5 — Per-user net monitoring

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T18 | `user_monitor_config` (per user: topics, keywords, tracked people/members, cadence, enabled) + per-contact tracking opt-in flag on `comms_crm_contacts` + `monitor_mentions` migration (user_id, contact_id?, summary, source_url, mention_date, sentiment, confidence) + RLS (a user sees only their own config + feed) | TBD | Not Started | Opt-in per contact; public info only |
| S14-T19 | Per-user monitoring config UI + a personal feed view (own watches + results) | TBD | Not Started | Private to the user |
| S14-T20 | `findMentions(userConfig)` — web search per user's topics/keywords/tracked members; structured output with citations; dedupe against existing mentions; store confidence | TBD | Not Started | Low-confidence flagged for review |
| S14-T21 | `CRON_SECRET`-protected `/api/comms/monitor` route + `vercel.json` cron; fan out across enabled user configs; tracked-member mentions also write to CRM activity feed + `task_assigned`-style notifications | TBD | Not Started | Human reviews before any outreach; consider Batch API for fan-out |

## Verification

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T22 | Unit tests: AI client wrapper (mocked SDK), per-capability parsing + guardrails, transcript text extraction, cron auth; ensure `typecheck`/`lint`/`test`/`build` green | TBD | Not Started | Mock the SDK — no live API calls in CI |
| S14-T23 | Manual verification pass with the feature flag on in a preview env; cost review against `ai_usage_log` | TBD | Not Started | Confirm spend + quality before enabling in prod |
