# Sprint 02 — Tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S02-T01 | Build manual intake submission form (`/app/comms/intake/new`) with all fields from Concept Update §7.2 Phase 1 | Codex | Completed | Implemented in `src/app/app/comms/intake/new/page.tsx` and `src/components/comms/manual-intake-form.tsx`. |
| S02-T02 | Implement server action to insert `intake_items` row with `capture_method = 'manual'` | Codex | Completed | `submitManualIntake()` writes manual captures with attached media reference support. |
| S02-T03 | Build intake queue list view at `/app/comms/intake` with filter bar (type filters from §7.3) | Codex | Completed | Queue page now renders live Supabase data with All / Events / Articles / Members / Initiative Updates / Media Requests / Dismissed filters. |
| S02-T04 | Implement type badges (5 signal types + noise) with the visual treatment from §5 and §7.3 | Codex | Completed | Badge/tone mapping centralized in `src/lib/comms-workflow.ts` and rendered in the intake queue shell. |
| S02-T05 | Build intake item card component (sender, timestamp, summary truncation, source URL, suggested destination, action row) | Codex | Completed | Added reusable queue card with expandable summary, destination chip, source/media refs, and action row. |
| S02-T06 | Implement Route action: destination modal + server action that creates destination record + updates intake row | Codex | Completed | Modal + server action now route items into calendar, event, campus-member, or media records and mark the intake row `routed`. |
| S02-T07 | Implement Edit classification action with content-type dropdown; log overrides | Codex | Completed | Added `intake_classification_corrections` plus the edit-classification modal and logging action. |
| S02-T08 | Implement Dismiss action; build dismissed-archive view (90-day retention filter) | Codex | Completed | Dismiss modal writes archived noise and the `Dismissed` filter keeps the 90-day archive visible for recovery. |
| S02-T09 | Build content calendar monthly grid view at `/app/comms/calendar` with channel colour coding | Codex | Completed | Monthly grid now renders channel-coded entries with edit access from the calendar route. |
| S02-T10 | Build content calendar list view with status filter (draft / in_review / scheduled / published / archived) | Codex | Completed | Added list view with status filter chips and entry cards. |
| S02-T11 | Build content card editor: title, channels multi-select, status, scheduled date, author, source link, body, tags | Codex | Completed | Editor modal supports the full Sprint 02 field set plus attached media references. |
| S02-T12 | Implement "Promote from intake" — one-click conversion from intake item to calendar draft | Codex | Completed | Added promotion panel on the calendar page for unrouted article shares and event reports. |
| S02-T13 | Implement status transitions (draft → in_review → scheduled → published → archived) with server actions | Codex | Completed | Transition buttons and server validation now enforce the Sprint 02 state machine, including manual publish. |
| S02-T14 | Build daily intake digest email template (Resend) with type breakdown and queue link | Codex | Completed | Added HTML digest template and digest send flow in `src/lib/comms-digest.ts`. |
| S02-T15 | Set up scheduled cron (Vercel cron or Supabase Edge Function) to send digest at coordinator-configured time | Codex | Completed | Added `/api/comms/digest` plus hourly Vercel cron config keyed off `notification_prefs.digestDeliveryTime`. |
| S02-T16 | Seed 8–12 realistic intake items from Concept Update §4 observed content | Codex | Completed | `supabase/seed-demo.sql` now inserts 10 realistic intake items and was verified against the local Supabase container. |
| S02-T17 | Seed 5 content calendar drafts (mix of LinkedIn / Newsletter / WordPress) | Codex | Completed | `supabase/seed-demo.sql` now inserts 5 calendar drafts spanning newsletter, LinkedIn, WordPress, and podcast. |
| S02-T18 | Unit tests: routing logic (each signal type → correct destination type) | Codex | Completed | Added routing coverage in `src/test/unit/comms-workflow.test.ts`. |
| S02-T19 | Unit tests: calendar status transition state machine | Codex | Completed | Added transition-state tests in `src/test/unit/comms-workflow.test.ts`. |
| S02-T20 | Update `docs/TRACEABILITY.md` with REQ-COMMS-INTAKE-* and REQ-COMMS-CAL-* entries | Codex | Completed | Traceability updated with Sprint 02 requirement rows and verification notes. |
