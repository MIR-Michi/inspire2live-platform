# Sprint 02 — Intake Queue & Content Calendar

**Weeks:** 3–4 of the Communications MVP
**Exit milestone:** M3 — Intake usable
**Status:** Implemented — review pending

---

## Goal

Make the intake queue genuinely usable: a comms coordinator can capture a WhatsApp message via a structured form, see it appear in the intake queue with its content type, and route it to the content calendar (which itself is now functional for newsletter and LinkedIn drafts). By the end of this sprint, the comms team has at least the first useful daily loop: capture → triage → schedule.

## Rationale

The Concept Update §7.2 specifies Phase 1 capture as manual: the comms coordinator submits items via a form. This is deliberate — it keeps humans in the loop for classification and trains the team in the taxonomy before any automation. Sprint 02 implements that loop end-to-end.

The content calendar is paired with the intake queue in the same sprint because the intake → calendar route is the single most common path (Type-2 article shares and most Type-1 event reports promote to calendar drafts). Building them together avoids shipping a queue that has no destination to route to.

The daily digest email is also scoped here because Resend is already in the infrastructure (Concept Update §10), and the digest is the artefact that demonstrates "review, not monitor" — without it, the queue is just another inbox to check.

## Acceptance criteria

- [x] `/app/comms/intake` renders a working queue: lists `intake_items` ordered by `captured_at desc`, status `unreviewed` by default, with type badges and filter bar (All / Events / Articles / Members / Initiative Updates / Media Requests / Dismissed).
- [x] Each queue item displays sender, received timestamp, message summary (3-line truncation, expandable), source URL if present, suggested destination chip, and three actions: Route / Edit classification / Dismiss.
- [x] A "+ New intake item" button opens a structured form: sender name, message content/summary, content type (taxonomy dropdown), source URL, attached media reference. Submitting writes a row to `intake_items` with `capture_method = 'manual'` and `status = 'unreviewed'`.
- [x] Route action opens a modal with the pre-selected destination per the routing table in Concept Update §7.5. Confirming creates the destination record (initially: content_calendar entry for Article Share and Event Report) and updates the intake item to `status = 'routed'`, recording `routed_to_type` and `routed_to_id`.
- [x] Edit classification action lets the coordinator change the content type before routing. Manual corrections are recorded so the Phase 3 classifier can learn from them.
- [x] Dismiss action marks the item `status = 'dismissed'` and retains it in a 90-day archive view.
- [x] `/app/comms/calendar` renders both views: monthly grid with channel-colour-coded entries (LinkedIn=blue, Newsletter=teal, WordPress=orange, Podcast=purple, YouTube=red) and a list view with status filter.
- [x] Content card supports all fields from Concept Update §6.2: title, channels (multi-select), status, scheduled date, author, source link, draft body, tags. Create-from-scratch and promote-from-intake both produce calendar rows.
- [x] Calendar status transitions: draft → in_review → scheduled → published → archived. "Publish" is manual in Phase 1 — it sets `published_at` and `status = 'published'` but does not call any external API.
- [x] Daily intake digest email implemented via Resend: configurable send time (default 08:00 coordinator timezone), summary of items captured since last review, breakdown by type, link back to `/app/comms/intake`.
- [x] Seed data extended with 8–12 realistic intake items drawn from the observed channel content in Concept Update §4 (Stephen Rowley GUIDE.MRD photos, Tempus AI link, Peter welcoming Michael from Austria, Atefeh's congress-photos request, etc.).
- [x] All new code passes `pnpm lint`, `pnpm typecheck`, `pnpm test`. At least one unit test covers the intake routing logic.

## Out of scope (deferred)

- WhatsApp Business API webhook for auto-capture → Phase 2.
- Rule-based or AI-assisted classification → Phase 2 / Phase 3.
- Direct publish to WordPress / LinkedIn / Mailchimp → Phase 2.
- Event Pipeline lifecycle actions beyond "create from intake" → Sprint 03.
- World Campus Log entries from intake → Sprint 03.
- Media library upload flow → Sprint 04.
