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

## Capability 2 — Summarize meetings

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T09 | `summarizeMeeting()` — structured summary (TL;DR, decisions, action items w/ owner+due, publication blurb) from agenda items + `meeting_notes`; adaptive thinking, streaming | TBD | Not Started | Works for campus sessions and weekly comms |
| S14-T10 | "Summarize meeting" action on the campus month + weekly meeting pages; save to `campus_sessions.summary` (and a structured field); show in the workspace | TBD | Not Started | One click → reviewable summary |

## Capability 3 — Follow-up tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T11 | `proposeFollowUpTasks()` — map summary action items to draft `comms_tasks` (title, proposed owner, due date) linked to the session/agenda item | TBD | Not Started | Owner matched against comms team members |
| S14-T12 | Review-and-commit UI: edit/accept/reject proposed tasks; on commit, create `comms_tasks` (unified task system, ADR-0008) and notify owners | TBD | Not Started | Human-in-the-loop before any task is real |

## Capability 4 — World news feed for stakeholders

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T13 | `news_feed_items` migration (headline, summary, category, region, source_url, relevance, published_at) + RLS | TBD | Not Started | `source_url` mandatory — citations |
| S14-T14 | `generateStakeholderNewsfeed()` — web-search tool + structured output, tailored to I2L themes (oncology, advocacy, policy) and active initiatives; dedupe | TBD | Not Started | Prompt-cache the themes prefix |
| S14-T15 | `CRON_SECRET`-protected `/api/comms/newsfeed` route + `vercel.json` cron; render real items in the dashboard "Field Newsfeed" card | TBD | Not Started | Mirrors `api/comms/digest` auth pattern |

## Capability 5 — Member monitoring

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T16 | Per-contact monitoring opt-in flag on `comms_crm_contacts`; `member_mentions` migration (contact_id, summary, source_url, mention_date, sentiment, confidence) + RLS | TBD | Not Started | Opt-in only; public info only |
| S14-T17 | `findMemberMentions()` — web search per opted-in member (name + org), structured output with citations; dedupe against existing mentions | TBD | Not Started | Store confidence; low-confidence flagged |
| S14-T18 | `CRON_SECRET`-protected `/api/comms/member-monitor` route + `vercel.json` cron; write mentions to CRM activity feed + `task_assigned`-style notifications for review | TBD | Not Started | Human reviews before any outreach |

## Verification

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S14-T19 | Unit tests: AI client wrapper (mocked SDK), per-capability parsing + guardrails, cron auth; ensure `typecheck`/`lint`/`test`/`build` green | TBD | Not Started | Mock the SDK — no live API calls in CI |
| S14-T20 | Manual verification pass with the feature flag on in a preview env; cost review against `ai_usage_log` | TBD | Not Started | Confirm spend + quality before enabling in prod |
