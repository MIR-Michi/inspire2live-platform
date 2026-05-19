# Sprint 04 — Tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S04-T01 | Build media library list view at `/app/comms/media` with search, type filter, event/session filter, tag filter | Codex | Completed | Implemented in `src/app/app/comms/media/page.tsx` + `src/components/comms/media-library-shell.tsx`; verified by lint, typecheck, tests, build, and local seed replay. |
| S04-T02 | Build media asset detail view with all Concept Update §6.5 fields | Codex | Completed | Implemented in `src/app/app/comms/media/[id]/page.tsx` with source context and usage log evidence. |
| S04-T03 | Build create-media-asset form (manual SharePoint URL paste, metadata fields) | Codex | Completed | Implemented via `src/app/app/comms/media/actions.ts` and `CreateMediaAssetModal`; SharePoint remains reference-link based in Phase 1. |
| S04-T04 | Implement rights-status badge component (internal_only / approved_for_publication / needs_clearance) | Codex | Completed | Shared badge added in `src/components/comms/rights-status-badge.tsx` and used across media list/detail flows. |
| S04-T05 | Implement usage log: increment `usage_count` and back-link when calendar entry references an asset | Codex | Completed | `src/lib/comms-media.ts` + calendar save flow now sync usage counts and media detail shows linked calendar entries. |
| S04-T06 | Build Media Recovery action-item view in `/app/comms/media` for Type-5 intake items | Codex | Completed | Recovery queue implemented with additive schema support from `00037_comms_sprint04_media_and_integrations.sql`. |
| S04-T07 | Implement offer linking: subsequent intake messages can be attached as offers to an open recovery request | Codex | Completed | Intake routing modal now supports recovery selection; offers persist in `media_recovery_offers`. |
| S04-T08 | Implement recovery resolution flow: paste SharePoint URL → create media_assets row → mark resolved | Codex | Completed | Resolution action creates the final asset, closes the request, and revalidates media detail routes. |
| S04-T09 | Notification: fire when a new offer is linked to an open recovery request | Codex | Completed | `media_recovery_offer` notification type added and surfaced in notifications/dashboard views. |
| S04-T10 | WordPress publish stub on content calendar (feature-flag gated; no-op handler; logs intent) | Codex | Completed | Admin-only stub added with explicit integration-intent logging; no Phase 1 external API call. |
| S04-T11 | LinkedIn schedule stub on content calendar | Codex | Completed | Stub action wired through calendar list cards and `comms_integration_intents`. |
| S04-T12 | Mailchimp newsletter draft stub on content calendar | Codex | Completed | Stub action added with explicit no-op logging contract for Phase 2 swap. |
| S04-T13 | SharePoint browse stub on media library | Codex | Completed | `+ from SharePoint` stub added in media library using the shared stub form component. |
| S04-T14 | Teams meeting link stub on event detail + campus session detail | Codex | Completed | Teams stub surfaced on both event detail and campus session detail pages. |
| S04-T15 | Document all integration stubs in Concept Update §12 reference table | Codex | Completed | `docs/PLATFORM_CONCEPT_UPDATE_v1.md` updated to describe the Phase 1 stub behavior and Phase 2 swap target. |
| S04-T16 | Onboard 3 real comms team users in Supabase (real accounts, `comms_team = true`) | TBD | Blocked | Requires real pilot participants and human account ownership. |
| S04-T17 | Schedule daily digest for each pilot user at their preferred time | TBD | Blocked | Requires confirmed pilot users plus real preference gathering. |
| S04-T18 | Run pilot kickoff session (45 min): taxonomy demo, routing demo, Q&A | TBD | Blocked | Human workshop task; cannot be completed autonomously. |
| S04-T19 | E2E test (Playwright): login as comms coordinator → submit intake → route to calendar → publish | Codex | Completed | Verified against the local Supabase stack after fixing modal dialog semantics, seeded demo password generation, and the final status-transition assertion in `src/test/e2e/comms-happy-path.spec.ts`. |
| S04-T20 | Pilot week run: monitor usage and capture metric numbers daily | TBD | Blocked | Requires real pilot traffic and daily human observation. |
| S04-T21 | Collect pilot feedback (form + 1-on-1s); commit to `sprints/sprint-04-media-and-pilot-launch/feedback.md` | TBD | Blocked | Placeholder file created, but real feedback requires the human pilot week. |
| S04-T22 | Write Phase 2 sprint backlog draft (placeholder folders for Sprint 05+) | Codex | Completed | Draft placeholder folders created for Sprint 05–07 with initial descriptions and task lists. |
| S04-T23 | Update `docs/TRACEABILITY.md` with REQ-COMMS-MEDIA-*, REQ-COMMS-INTEG-*, REQ-COMMS-PILOT-* entries | Codex | Completed | Traceability rows added for Sprint 04 implementation plus explicit blocked pilot requirements. |
| S04-T24 | Update `CHANGELOG.md` with the MVP-shipped entry | Codex | Completed | Changelog updated with the Sprint 04 media, recovery, integration-stub, and Phase 2 draft backlog additions. |
