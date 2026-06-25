# Sprint 14 — AI Augmentation (Claude-powered comms intelligence)

> **Status:** Planning
> **Theme:** Introduce a shared Claude (Anthropic API) integration layer and ship five AI capabilities into the Communications Workspace.
> **Depends on:** ADR-0008 (unified task domain layer) for the follow-up-tasks capability; the existing intake, campus/meeting, CRM, and dashboard surfaces.

## Goal

Give the communications team a set of AI assists that turn raw inputs into structured, actionable work — without taking humans out of the loop. Shipping this sprint produces:

1. **Structure incoming content** — Claude classifies and extracts structure from `intake_items` (WhatsApp / email / shared links), upgrading the current rule-based `comms-classifier.ts` into an AI-assisted pipeline with a deterministic fallback.
2. **Summarize meetings** — one-click structured summaries of campus monthly meetings and weekly comms meetings (TL;DR, decisions, action items, a publication-ready blurb) from agenda items + meeting notes.
3. **Generate follow-up tasks** — turn a meeting's action items into owned, dated `comms_tasks` (the unified task system, ADR-0008), proposed by Claude and confirmed by a human.
4. **World news feed for stakeholders** — a scheduled job that uses Claude's web-search tool to assemble a tailored newsfeed (oncology research, advocacy, policy) and fills the currently-empty "Field Newsfeed" card on the dashboard.
5. **Member monitoring** — a scheduled job that searches the web for recent mentions of opted-in I2L members, summarizes them with citations, and surfaces them in the CRM and as notifications.

Every capability follows one rule: **Claude proposes, a human disposes.** AI output is always a reviewable suggestion before it becomes a published artifact, a committed task, or outbound contact.

## Rationale

- The platform already ingests raw signal (`intake_items`), runs monthly/weekly meetings (`campus_sessions`, `comms_weekly_agenda_items` with `meeting_notes`), and tracks people (`comms_crm_contacts`, `member_onboarding`). Today these are processed by hand or by brittle keyword rules (`comms-classifier.ts`). This is exactly the shape of work LLMs do well: classify, summarize, extract, and draft.
- The dashboard ships a **"Field Newsfeed"** card that is currently hard-coded to an empty array (`src/app/app/dashboard/page.tsx`). Capability 4 gives it a real, automated source.
- Follow-up tasks have a natural home now that tasks are unifying behind one domain layer (ADR-0008) — AI-proposed action items land as `comms_tasks` and flow to owners' personal dashboards with no new task surface.
- Sequenced after the CRM/identity and task-unification work (Sprints 09–13 + ADR-0008) because those provide the structured destinations (contacts, tasks, meetings) that AI output writes into.

## Technical approach

**Stack.** Server-side only, via the official `@anthropic-ai/sdk` (TypeScript). All model calls run in Next.js server actions, route handlers, or cron endpoints — never in the browser, and the API key is never exposed client-side. Default model **`claude-opus-4-8`**; per-workload model choice (e.g. a faster/cheaper model for high-volume classification) is a tuning decision recorded per feature, not a blanket default.

**Key API features we lean on** (see `docs/AI_INTEGRATION.md`, produced in S14-T02):
- **Structured outputs** (`messages.parse()` + a Zod schema via `zodOutputFormat`) for classification, extraction, summaries, and news items — guarantees parseable, schema-valid JSON instead of free-text we have to parse.
- **Web search / web fetch server tools** (`web_search_20260209`, `web_fetch_20260209`) for the news feed and member monitoring — they run on Anthropic's infrastructure and return **citations**, which we persist as `source_url` so every AI claim is traceable.
- **Adaptive thinking** (`thinking: {type: "adaptive"}`) for summarization and the reasoning-heavy news/member jobs.
- **Prompt caching** for the stable shared prefix (org profile, classification taxonomy, stakeholder/initiative themes) reused across every call in a job.
- **Streaming** for long summaries (`max_tokens` headroom) and the **Batch API** (50% cost) for non-latency-sensitive backfills (e.g. re-classifying historical intake).

**Guardrails (cross-cutting, not optional):**
- **Untrusted input.** `intake_items.raw_content`, fetched web pages, and member-mention text are external data. Wrap them in clearly delimited blocks and treat them as data, never as instructions — and never let them silently redirect a job (prompt-injection hygiene).
- **Human-in-the-loop.** Suggestions are written as `suggested_*` / pending records that a human confirms; nothing is auto-published or auto-sent.
- **Citations required** for anything web-sourced; store the URL and a confidence signal.
- **Cost + rate controls.** A single AI client wrapper enforces model defaults, timeouts, retries, and per-job usage logging (tokens + estimated cost) into an `ai_usage_log` table so spend is visible.
- **Feature-flagged.** Everything sits behind `NEXT_PUBLIC_FEATURE_AI` (UI) + a server guard, so it can ship dark and be enabled per environment.
- **Privacy.** Member monitoring is **opt-in per contact** and limited to public information; no scraping of private accounts.

## Acceptance criteria

- [ ] `@anthropic-ai/sdk` added; `ANTHROPIC_API_KEY` documented in `.env.example`, `README.md`, and `docs/ENVIRONMENT_REFERENCE.md`; a server-only `src/lib/ai/client.ts` wrapper exists with model default, structured-output + web-search helpers, timeout/retry, and usage logging.
- [ ] `docs/AI_INTEGRATION.md` documents the patterns, the guardrails, the model-per-workload choices, and the prompt-injection policy for untrusted input.
- [ ] `NEXT_PUBLIC_FEATURE_AI` flag gates all AI UI and a server guard rejects AI calls when disabled.
- [ ] **Structure incoming content:** an intake item can be classified + structured by Claude into a reviewable suggestion (content type, summary, entities, suggested channel/action, founder signal); the rule-based classifier remains as a deterministic fast-path/fallback; a human confirms before it routes.
- [ ] **Summarize meetings:** a campus session (or weekly meeting) produces a structured summary (TL;DR, decisions, action items with owner + due, publication blurb) saved to the session and shown in the meeting workspace.
- [ ] **Follow-up tasks:** action items from a summary are proposed as `comms_tasks` (owner + due date, linked to the session/agenda item); a human edits/confirms before they are committed; committed tasks appear on owners' dashboards.
- [ ] **News feed:** a `CRON_SECRET`-protected endpoint (registered in `vercel.json`) populates a `news_feed_items` table via web search with citations; the dashboard "Field Newsfeed" renders real items tailored to stakeholder themes.
- [ ] **Member monitoring:** a scheduled endpoint finds recent public mentions of opted-in members, stores them with source + confidence, dedupes, and surfaces them in the CRM activity feed + notifications.
- [ ] Unit tests cover the AI client wrapper (mocked SDK), each capability's parsing/guardrail logic, and the cron auth; `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` are green.

## Out of scope (future sprints)

- Outbound AI-drafted replies/auto-posting (publishing connectors are Sprint 06 territory; drafting can be a follow-up).
- Managed Agents / long-running autonomous agents — this sprint is single-call + scheduled-job workflows, which is the right altitude for these tasks.
- Fine-tuning or self-hosted models.

## References

- `docs/PLATFORM_CONCEPT_UPDATE_v1.md`, `sprints/README.md`
- ADR-0008 (unified task domain layer), ADR-0006 (Communications Workspace), ADR-0007 (Unified Contact Identity)
- Existing surfaces: `src/lib/comms-classifier.ts`, `src/app/api/comms/digest/route.ts` (cron pattern), `src/app/app/dashboard/page.tsx` (empty newsfeed), `src/lib/comms-tasks.ts`
