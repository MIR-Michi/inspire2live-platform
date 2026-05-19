# Sprint 03 — Event Pipeline, World Campus Log & Peter Signal Layer

**Weeks:** 5–6 of the Communications MVP
**Exit milestone:** M4 — Full routing
**Status:** Completed

---

## Goal

Complete the structured-routing story: every signal type from the Concept Update taxonomy has a working destination. The event pipeline tracks conferences and congresses through their lifecycle. The World Campus log replaces buried WhatsApp threads as the system of record for sessions and members. Peter Kapitein's messages get the signal treatment they deserve — founder badge, elevated confidence, dedicated filter.

## Rationale

After Sprint 02, the intake queue can route Type-2 (Article Share) and most Type-1 (Event Report) items to the content calendar. But routing is incomplete:

- **Type-1 Event Reports** also need a working Event Pipeline destination — without it, photos and reports from GUIDE.MRD or the Annual Congress have no structured home.
- **Type-3 Member Introductions** need the World Campus Log member view — without it, Peter's "warm welcome to Michael from Austria" remains an ephemeral chat message.
- **Type-4 Initiative Updates** need both Event Pipeline and Campus Log working to route correctly.

The Peter Kapitein signal layer (Concept Update §8) is bundled here because all four of his content patterns (welcomes, content shares, social messages, content into events) touch the destinations being built this sprint. Implementing it alongside the destinations is cheaper than coming back later.

The Annual Congress shares a data model with the Event Pipeline (Concept Update §6.3) via an `is_annual_congress` flag, so the linkage to the existing `/app/congress` surface is verified in this sprint.

## Acceptance criteria

- [x] `/app/comms/events` lists all events ordered by `start_date desc`, with lifecycle stage badges (announced / attending / in_progress / post_event / archived) and a filter by stage.
- [x] Event detail view displays all fields from Concept Update §6.3: name, date, location, organiser, I2L representatives, initiative linkage, stage, output checklist (report drafted / LinkedIn published / newsletter mentioned / media stored), notes.
- [x] Server actions for: create event, transition stage, toggle output checklist items, link an initiative.
- [x] Intake → Event Pipeline routing creates a new event record (or updates an existing one if the intake classifier identifies the same event by name + date proximity). The intake item's `routed_to_id` references the event.
- [x] Annual Congress linkage: `is_annual_congress = true` events show a banner linking to the existing `/app/congress` surface. The existing Congress workspace remains untouched.
- [x] `/app/comms/campus-log` has two tabs: **Sessions** and **Members**.
- [x] Sessions tab lists `campus_sessions` ordered by `session_date desc` with theme, participating hubs, summary preview, and link to detail.
- [x] Session detail allows editing summary, action items, recording URL, slides reference, initiative connections, and published outputs.
- [x] Members tab lists `campus_members` with name, country, organisation, role, date welcomed, Peter-welcomed flag (founder icon), last channel activity. Search by name and filter by country.
- [x] Member detail shows the member's intake contributions (intake items attributed to them) and content calendar appearances.
- [x] Intake → Campus Log routing for Type-3 items creates a new `campus_members` row populated from the message (extract name + country with simple parsing rules; coordinator can edit before save).
- [x] Peter Kapitein signal layer:
  - [x] `is_peter_kapitein` flag set automatically on intake when sender matches "Peter Kapitein" (case-insensitive, configurable in a constants file).
  - [x] Founder badge displayed on Peter's items in the intake queue.
  - [x] Classification confidence auto-elevated to `high` for Peter's items.
  - [x] Dedicated filter "Peter's messages" in the intake queue.
  - [x] Member entries auto-created from Peter's welcome messages set `welcomed_by_peter = true`.
- [x] Seed data extended: 5 events across all five lifecycle stages, 3 World Campus sessions, 12 campus members (including Atefeh, Stephen Rowley, Jeff Waldron, Michael from Austria, Kemi Adekanye, Peter Kapitein).
- [x] All five signal types route end-to-end with seeded data: Event Report → Event Pipeline + Media stub; Article Share → Content Calendar; Member Intro → Campus Log + Member; Initiative Update → Event Pipeline + Campus Log; Media Request → Media Library action item placeholder (full media library lands in Sprint 04).
- [x] All new code passes `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Verification log

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm test` (`196/196`)
- `pnpm build`
- `pnpm dlx supabase@2.76.10 db lint --local --fail-on error`
- `docker exec -i supabase_db_inspire2live-platform psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/seed-demo.sql`
- Local seed verification after load:
  - `events`: 5
  - `campus_sessions`: 3
  - `campus_members`: 12
  - `intake_items` flagged as Peter signals: 4
  - routed destinations present for `calendar`, `campus_member`, `event`, and `media_asset`

## Notes

- The acceptance line originally said "4 events across all five lifecycle stages". The implemented seed uses 5 events so each lifecycle stage is represented once.
- `pnpm build` completes successfully. The pre-existing dynamic-server log for `/app/admin/permissions` still appears during static generation, but it does not fail the build and is unrelated to Sprint 03.

## Out of scope (deferred)

- Media library upload UI and SharePoint linking → Sprint 04.
- Media recovery action item resolution flow → Sprint 04.
- WhatsApp Business API webhook auto-population of `sender_whatsapp_id` → Phase 2.
- AI-assisted parsing of member intro name/country → Phase 3.
