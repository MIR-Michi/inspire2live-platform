# Changelog

All notable changes to the Inspire2Live Platform are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Documentation
- **Sprint 19 planned — Adaptive Dashboard Design & Personalization.** Added a platform-specific design concept and sprint backlog for Campus-inspired two-zone dashboard layouts, a shared widget registry, per-user cross-device layout preferences, explicit edit mode, accessible cross-zone tile movement and sizing, presets/focus mode, restrained motion, and localized task-completion celebration. This planning change adds no runtime code, dependency, migration, or UI behavior. See `docs/ADAPTIVE_DASHBOARD_DESIGN_CONCEPT.md` and `sprints/sprint-19-adaptive-dashboard-design/`.
- **Canonical contributor/agent briefing.** Added a root [`AGENTS.md`](AGENTS.md) as the single, tool-agnostic entry point (architecture, commands, verify-before-commit gate, guardrails, git/branch/commit conventions, and a work-documentation standard). `CLAUDE.md` and the top of `README.md` now point to it. Consolidated the scattered, partly tool-specific guidance: the Cline/PowerShell doc (`docs/CLINE_WORKFLOW.md`) is reduced to a historical stub, its defensive-Supabase-query rules moved into `docs/IMPLEMENTATION_GUIDE.md`. Introduced a standardised **Change Record** convention (`docs/changes/`) so work done *outside* a sprint is documented consistently. Recorded the workflow-as-practised in **ADR-0011** (PR-based trunk + sprint cadence), superseding ADR-0005. Refreshed `docs/README.md` (ADR index 0006–0011, AI docs, change records) and de-duplicated model IDs from `docs/AI_INTEGRATION.md` in favour of the code catalog (`src/kernel/ai-client/models.ts`). **Fully refreshed `docs/SDLC.md`** to current reality (PR/sprint workflow, Next.js 16, the three CI workflows incl. governance + db-migrations validation + the deploy `db push` flow, migration/role model), softened to link to source-of-truth rather than restate. Added a **doc-maintenance rule to `AGENTS.md` §8** — a change→docs trigger matrix + `Last reviewed:` freshness convention + link-don't-restate — so stale content is fixed at authoring time. See `docs/changes/2026-07-17-agents-guidance-consolidation.md`.

### Fixed
- **Conference list duplicates — root-caused and prevented (migration `00167`).** The master list accumulated duplicates because three insert paths each computed a *different* dedupe key for the same event: AI discovery (`slug(name):YYYY-MM`, month-precise + title-sensitive), guest resolution (`guest-…`, migration 00112), and seed/manual. So "ESMO Congress 2026" and "ESMO Congress" (dated a month off, added by a guest) landed as separate rows. The fix is one **source-agnostic canonical key** — normalise the name (drop the trailing year, ordinal edition markers like "24th", and low-signal stopwords) and key on the conference **year** so month drift and title variants no longer split — enforced by a **BEFORE INSERT/UPDATE trigger + unique index** so the database computes the key for *every* future insert (AI, guest, seed, manual) and rejects duplicates. The migration also backfills the key and **merges existing duplicates**, re-pointing all dependent rows (tracking, prep, assignments, tasks, guest submissions/tokens/invites) onto a single survivor. The app-side key (`conferenceDedupeKey`) matches the SQL. Verified end-to-end against an ephemeral Postgres: 5 seeded cross-source duplicates collapsed to 2 with zero orphaned dependents, and a subsequent guest-style duplicate was auto-rejected by the trigger.

### Changed
- **Cheaper conference discovery search.** The "already have these — do not repeat" list (up to ~100 conference names) was being sent **uncached in every one of the ~36 search lanes**. It now lives in the **cached** system prompt (billed once per run, cache-read thereafter) and is capped + stably sorted. Search breadth and budget are now operator-tunable (see below) rather than hard-coded.
- **Conference discovery now has a first-class settings space.** Platform Settings → Automation → Conference discovery exposes automatic discovery, minimum days between searches, look-ahead window, max web searches per lane, source lenses per region, known-conference hint size, and an admin-only on-demand run. The Conferences workspace no longer renders discovery-result counts, refresh telemetry, a settings shortcut, or hidden status polling.

### Added
- **Conference operating page redesign (Sprint 18):** the per-conference operating page no longer repeats the overview's stage tabs. A `StageRail` is replaced by a read-only **phase header** (Before · During · After) with a date-driven status line, and the body is a single-column, mobile-first stack of **collapsible tiles**. Requests are now driven by a declarative **requirement model** (`src/modules/events/domain/conference-requirements.ts`, unit-tested) instead of static per-stage checklists: the **presentation** tile shows only for presenters, and **photos** are always listed but only turn red **during/after** the conference — never before. Material carries a **traffic-light** status (green ✓ provided · red ! needed now · neutral · not yet due), colour always paired with an icon + label. The guest workspace adopts the same phase header, traffic-light status, and an **overview-first** card grid of the conferences on the guest's list. See `docs/CONFERENCE_OPERATIONS_REDESIGN_CONCEPT.md` and `sprints/sprint-18-conference-operations-redesign/`.
- **One conference operating record — guest ↔ team merge (Sprint 18):** invited guests now co-edit the same operating record as the team instead of filling a separate form attached beside it. A token-scoped `guest_contribute_to_prep` RPC (migration `00163`, SECURITY DEFINER, scoped to a conference the token reported attending) writes guest photos, takeaways, slides, and attending type straight into `conference_prep`; the operating page merges team + guest photos/summaries/comments/slides into one view (`conference-operating-view.ts`, unit-tested) and the standalone read-only "Guest reports" block is removed — guest contributions fold into the On-site tile and count toward its traffic-light status.
- **Instant, logged conference invites (Sprint 18):** `generateGuestToken` now returns the invite link immediately and delivers WhatsApp/email in the background (`after()`), so the coordinator no longer waits on external APIs. Every invite is durably recorded — recipient, channels, per-channel delivery status, `sent_at`, `invited_by` — in a new `conference_guest_invites` table (migration `00162`) and surfaced as an "Invitations sent" list on the operating page.
- **Assign a task from a WhatsApp topic:** every categorized digest topic now has a `+ Task` button to create a comms task with an owner (any comms-team member) and optional deadline. The task links to the topic (`comms_tasks.whatsapp_feed_item_id`, migration `00158`) and surfaces in the owner's "My dashboard" through the existing `unified_tasks` view with a new `whatsapp_topic` context — no new task store, no duplication.
- **Shared WhatsApp digest in Campus:** the Campus month WhatsApp tab now shows the same AI digest (summary + categorized topics) as the WhatsApp workspace, read-only, resolved via `whatsapp_feed_summaries.campus_session_id` (digest runs auto-link to the meeting their window closes on). One `WhatsAppDigestPanel` component is rendered by both surfaces; Campus never re-runs the AI. See `docs/CAMPUS_DIGEST_AND_TOPIC_TASKS_REPORT.md`.

### Fixed
- **Campus "incoming" counts are now consistent.** The nav badge, the Campus overview cards, and the month-detail header previously used three different definitions (global comms unread vs 100-capped all-channel calendar-month unreviewed vs campus-channel month WhatsApp). They now share one canonical metric — unreviewed `campus`-channel intake within the meeting's window (previous → current meeting), exact count, no cap (`countCampusIncoming` / `resolveCurrentMeetingDate` in `lib/campus-metrics`).

### Changed
- **`ResizableSplit` gains a `seam` variant** (thin full-height divider, no gap) for seamless-bordered containers, and is now applied to the Campus month layout — the left/right width is drag-adjustable there too.

### Added (earlier this cycle)
- **Drag-resizable two-column layouts:** a reusable `ResizableSplit` component (draggable divider, keyboard-accessible `role="separator"`, `localStorage`-persisted ratio per surface, responsive stacking below `lg`). Applied to the WhatsApp workspace, the conference operating shell, and the admin AI settings page; remaining main/side splits (conferences master-detail, campus month, media library, event operating) are a documented follow-up. See `docs/WHATSAPP_MERGE_AND_RESIZABLE_COLUMNS_REPORT.md`.
- **Unified WhatsApp workspace:** merged `/app/comms/whatsapp` (inbox) and `/app/comms/whatsapp/digest` into one drag-resizable two-column page — AI summary/categorization on the left, the **media-rich raw feed (images, video, audio, documents)** on the right, with click-to-highlight source traceability. Reply and admin delete are preserved; `/app/comms/whatsapp/digest` now redirects to the unified page and the separate nav entry is removed.
- **WhatsApp feed AI categorization** (now at `/app/comms/whatsapp`): for a time window (default: previous → most recent campus meeting), Claude summarizes the community WhatsApp feed and classifies messages into birthday / new member / event / question / news / I2L initiative / other. Two-column review UI with click-to-highlight source traceability (each item cites the `intake_items` message it came from). Human-confirmed downstream routing: birthday/event → `content_calendar`, new member → `member_onboarding`; optional monthly rollup summary. New `ai_features` tables `whatsapp_feed_summaries` / `whatsapp_feed_items` (migration `00157`), `claude-sonnet-5` catalog entry, and `whatsapp_feed_categorization` / `whatsapp_feed_monthly_summary` AI workloads (default Sonnet 5 / low). See `docs/WHATSAPP_FEED_AI_CATEGORIZATION_REPORT.md`.

### Changed
- **MVP scope pivot (2026-05-17):** Communications Workspace + World Campus Channel Intake adopted as the new Phase 1 / MVP scope per `docs/PLATFORM_CONCEPT_UPDATE_v1.md` v1.0. Initiative workspace, bureau, congress slice, resource library, and partner portal reclassified as Phase 2 surface area (no code removed).
- Active delivery process changed from Work Packages to **sprints** — see `sprints/`.
- `docs/MVP_SCOPE_AND_ROADMAP.md` rewritten to reflect Comms-first MVP, revised capability layers (L1–L4), revised demo narrative, and revised success metrics.
- `docs/WP_STATUS.md` marked as historical (WP-0 through WP-5); WP-6 deferred into Phase 2.

### Added
- `docs/PLATFORM_CONCEPT_UPDATE_v1.md` — full Concept Update v1.0 specification.
- `sprints/` directory with Sprint 01 through Sprint 04 covering the Communications MVP (Weeks 1–8).
- Sprint 05 intake automation groundwork: WhatsApp webhook ingestion, explainable classifier reasoning, reusable classifier rules/training examples, and queue-level replay/correction flow.
- Outlook draft stub added to the communications integration layer so WordPress, Outlook, WhatsApp, and SharePoint all have explicit integration elements in the platform.
- Sprint 04 media library surfaces for `/app/comms/media`, including list/detail pages, manual SharePoint-link asset creation, rights badges, and asset usage log linking.
- Media recovery workflow with tracked requests, linked offers, resolution into `media_assets`, and `media_recovery_offer` notifications.
- Feature-flagged communications integration stubs for WordPress, LinkedIn, Mailchimp, SharePoint, and Teams, backed by explicit `comms_integration_intents` logging.
- Sprint 04 demo pack additions: media/recovery seed scenarios, `comms-media` unit coverage, and a Playwright happy path for comms coordinator login → intake → route → publish.
- Draft Phase 2 placeholder sprint backlogs for Sprint 05 through Sprint 07.
- Invitation system for initiatives and congress (invite by email or platform user)
- Notification system with in-app notification feed
- Password reset flow with dedicated `/reset-password` page
- Auth redirect URL helper with production/localhost detection (`auth-redirect-url.ts`)
- `notifications_type_check` constraint expansion for `initiative_invite` and `congress_invite`
- Unit test suite for auth redirect URL logic
- Documentation overhaul: 8 new docs + 4 populated ADRs + docs index

### Fixed
- CRM contacts on the `@inspire2live.org` domain are now always classified as internal (`internal_contact` — an internal person who is not yet a platform user and needs a separate invitation), never external. Enforced both server-side in `saveCrmContact` and at the database layer via the `crm_contacts_sync_derived` trigger (migration 00067), with a backfill that re-classifies any existing misfiled rows.
- Deleting a contact in the CRM now also removes that person from the rest of the platform (the New Members onboarding list), using the `member_onboarding_id` link with email/name fallbacks, so a deleted contact no longer lingers elsewhere.
- Auth magic links redirecting to `localhost` in production (Supabase Site URL + code fix)
- `notifications_type_check` constraint violation when sending initiative invitations

---

## [0.1.0] — 2025-12-01

### Added
- **Platform foundation:** Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript strict
- **Authentication:** Supabase Auth with magic link and password flows
- **Database:** PostgreSQL with 26 sequential migrations and full RLS
- **Role system:** 8 platform roles with 4-tier permission resolution
- **Initiatives:** Create, manage, assign tasks, track milestones, upload evidence
- **Congress lifecycle:** Planning → active → post-event → archived with workspace
- **Congress workspace:** Workstreams, RAID log, tasks, approvals, communications, timeline
- **Patient stories:** Create, review, publish workflow with public story pages
- **Admin panel:** User management, permission overrides, role default configuration
- **Bureau dashboard:** RAG health overview across all initiatives
- **Board dashboard:** Governance metrics and drill-down
- **Profile system:** Onboarding wizard, profile editor, avatar upload
- **Navigation:** Role-aware side nav and top nav
- **CI/CD:** GitHub Actions (lint, typecheck, build, unit tests, E2E) + Vercel auto-deploy
- **Testing:** 16+ unit test files (Vitest), 2 E2E smoke tests (Playwright)

### Infrastructure
- Supabase project (PostgreSQL + Auth + Storage)
- Vercel hosting with auto-deploy on push to `main`
- Resend for transactional email
- GitHub Actions CI pipeline (3 parallel jobs)

---

*Maintainer: Michael Wittinger*
