# Sprint 03 — Tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S03-T01 | Build event pipeline list view at `/app/comms/events` with stage filter and date sort | Codex | Completed | Delivered in `src/app/app/comms/events/page.tsx` and `src/components/comms/events-pipeline-shell.tsx`; verified with build, tests, and seeded stage counts. |
| S03-T02 | Build event detail view with all Concept Update §6.3 fields | Codex | Completed | Delivered in `src/app/app/comms/events/[id]/page.tsx` with notes, reps, initiative linkage, lifecycle actions, and output checklist. |
| S03-T03 | Server action: create event (manual + via intake routing) | Codex | Completed | Added `createEvent` plus intake-driven event creation/update in `src/app/app/comms/events/actions.ts` and `src/app/app/comms/intake/actions.ts`. |
| S03-T04 | Server action: transition event stage (announced → attending → in_progress → post_event → archived) | Codex | Completed | Implemented `transitionEventStage` and wired it into the event detail view. |
| S03-T05 | Server action: toggle event output checklist items | Codex | Completed | Implemented `toggleEventOutputItem` and output cards on the event detail page. |
| S03-T06 | Implement intake → event routing with duplicate detection (match by name + date proximity) | Codex | Completed | Added `buildEventDraftFromIntake` + `findDuplicateEventMatch` in `src/lib/comms-routing.ts` and used them in intake routing. |
| S03-T07 | Annual Congress linkage: banner + deep link to existing `/app/congress` for `is_annual_congress = true` events | Codex | Completed | Added Congress banner and deep link in `src/app/app/comms/events/[id]/page.tsx`. |
| S03-T08 | Build `/app/comms/campus-log` shell with Sessions and Members tabs | Codex | Completed | Delivered in `src/app/app/comms/campus-log/page.tsx` and `src/components/comms/campus-log-shell.tsx`. |
| S03-T09 | Build campus sessions list and detail views | Codex | Completed | Sessions tab and detail page are live in `src/components/comms/campus-log-shell.tsx` and `src/app/app/comms/campus-log/sessions/[id]/page.tsx`. |
| S03-T10 | Server action: create / update campus session (summary, action items, recording, slides, initiative links, published outputs) | Codex | Completed | Implemented `createCampusSession` and `saveCampusSession` in `src/app/app/comms/campus-log/actions.ts`. |
| S03-T11 | Build campus members list view with search and country filter | Codex | Completed | Members tab now supports client-side search and country filtering in `src/components/comms/campus-log-shell.tsx`. |
| S03-T12 | Build member detail view (linked intake items + content calendar appearances) | Codex | Completed | Added member detail evidence view in `src/app/app/comms/campus-log/members/[id]/page.tsx`. |
| S03-T13 | Implement intake → campus member routing for Type-3 items (with name/country parsing rule and coordinator edit step) | Codex | Completed | Added parse/edit routing fields in the intake modal and persisted them through `routeIntakeItem`. |
| S03-T14 | Implement Peter Kapitein detection: auto-flag `is_peter_kapitein` on intake submission | Codex | Completed | Centralised aliases in `src/lib/comms-constants.ts` and detection in `src/lib/comms-routing.ts`; manual intake now uses the helper. |
| S03-T15 | Founder badge component + display in intake queue and campus member views | Codex | Completed | Added reusable founder badge in `src/components/comms/founder-badge.tsx` and displayed it in queue/member surfaces. |
| S03-T16 | Auto-elevate classification confidence to `high` for Peter's items | Codex | Completed | `submitManualIntake` now uses Peter-aware confidence logic from `src/lib/comms-routing.ts`. |
| S03-T17 | Add "Peter's messages" filter to intake queue | Codex | Completed | Added filter metadata and queue filtering support in `src/lib/comms-workflow.ts` and `src/app/app/comms/intake/page.tsx`. |
| S03-T18 | Auto-set `welcomed_by_peter = true` when intake-derived member rows originate from Peter's welcomes | Codex | Completed | Peter-derived campus member rows now set `welcomed_by_peter` during routing and seed verification. |
| S03-T19 | Seed 4 events across all five lifecycle stages, 3 campus sessions, 12 campus members (named per Concept Update §4) | Codex | Completed | `supabase/seed-demo.sql` now seeds 5 events to cover all 5 lifecycle stages, plus 3 sessions and 12 members. |
| S03-T20 | Verify all five signal types route end-to-end with seeded data; document each path in `description.md` checklist | Codex | Completed | Loaded `seed-demo.sql` into local Supabase and verified routed destination counts plus sprint acceptance checklist updates. |
| S03-T21 | Unit tests: Peter Kapitein detection; intake → event duplicate detection; campus member parsing | Codex | Completed | Added `src/test/unit/comms-routing.test.ts`; full suite passes with `196/196` tests green. |
| S03-T22 | Update `docs/TRACEABILITY.md` with REQ-COMMS-EVENT-*, REQ-COMMS-CAMPUS-*, REQ-COMMS-PETER-* entries | Codex | Completed | Traceability matrix updated with Sprint 03 event, campus, Peter, and seed verification rows. |
