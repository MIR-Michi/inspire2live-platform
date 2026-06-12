# Sprint 12 — WhatsApp Webhook Production Hardening

**Phase:** 2 hardening
**Status:** Not Started

## Goal

Take the WhatsApp Cloud API integration from "functionally working" to
**production-ready**: operators can confirm a message round-trip end to end
(inbound capture → classification → outbound reply → delivery confirmation),
failures are visible and recoverable, and a new operator can configure the
Meta side of the integration from documentation alone.

## Rationale

Sprint 05 shipped the inbound webhook, signature verification, and rule-based
classifier (`/api/comms/whatsapp`, `comms-webhook.ts`, `comms-classifier.ts`),
and a later sprint added outbound replies
(`whatsapp_outbound_messages`, `whatsapp-send.ts`, `comms/whatsapp/actions.ts`).
Both halves work in isolation, but a platform review identified gaps that
matter once this is the comms team's primary WhatsApp surface rather than a
pilot:

- Outbound sends are fire-and-forget — there's no way to know if a reply was
  actually delivered or read.
- Webhook failures are logged to `whatsapp_webhook_events` but never
  surfaced or retried — a transient DB error silently drops a message.
- There is no operator-facing documentation for configuring the Meta App,
  webhook callback URL, or required environment variables end to end.
- Conversation context (which intake items belong to the same WhatsApp
  thread) isn't visible in the UI.
- Only plain-text outbound messages are supported; no templates, no media.

This sprint addresses the items that block calling the integration
"production ready," in priority order. Lower-priority items are included so
they aren't lost, but the sprint can be considered shippable once the
P0/P1 acceptance criteria are met.

## Scope

In scope:
- Inbound webhook resilience (status events, retry/DLQ visibility).
- Outbound delivery status tracking (sent → delivered → read / failed).
- Conversation threading between inbound and outbound messages.
- Operator documentation (setup guide + env var reference).
- Basic webhook health visibility (counts of accepted/duplicate/failed).

Out of scope (explicitly deferred, note in backlog if still wanted later):
- WhatsApp message templates / outbound media attachments.
- Multi-number / multi-WABA support.
- Two-way rich media (interactive buttons, lists).

## Acceptance criteria

- [ ] Inbound webhook handles Meta `statuses` change events (delivered/read/
      failed) for messages this platform sent, and updates
      `whatsapp_outbound_messages.delivery_status` accordingly.
- [ ] `whatsapp_webhook_events` rows with `processing_status = 'failed'` are
      visible to comms/admins in the UI (or an existing monitoring surface)
      with enough detail to diagnose and a way to re-trigger processing.
- [ ] Intake items and outbound replies that belong to the same WhatsApp
      conversation are visibly linked in the UI (e.g. a simple thread view
      on the intake detail / WhatsApp inbox).
- [ ] `docs/ENVIRONMENT_REFERENCE.md` documents all `WHATSAPP_*` variables
      (currently only in `.env.example`), and a new
      `docs/WHATSAPP_WEBHOOK_SETUP.md` walks an operator through the full
      Meta App + webhook callback configuration from scratch.
- [ ] A monitoring summary (counts of accepted / duplicate / failed webhook
      events, last received timestamp) is available via the existing
      `/api/monitoring`-style surface or a comms dashboard tile.
- [ ] All changes covered by unit tests; existing webhook/classifier tests
      continue to pass; `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Verification plan

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- Manual: simulate a Meta `statuses` webhook payload against
  `/api/comms/whatsapp` (e.g. via a fixture in the webhook test suite) and
  confirm `whatsapp_outbound_messages.delivery_status` transitions.
- Manual: walk through `docs/WHATSAPP_WEBHOOK_SETUP.md` against a sandbox
  Meta App to confirm it's sufficient on its own.
