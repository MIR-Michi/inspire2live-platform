# Changelog

All notable changes to the Inspire2Live Platform are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
