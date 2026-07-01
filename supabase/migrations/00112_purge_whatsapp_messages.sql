-- ============================================================
-- MIGRATION 00112: One-time purge of all WhatsApp messages
--
-- Removes every WhatsApp message across the platform:
--   • outbound replies      (whatsapp_outbound_messages — entire table)
--   • raw inbound payloads   (whatsapp_webhook_events — entire table)
--   • inbound messages       (intake_items where sender_whatsapp_id is set)
--
-- Inbound WhatsApp lives in the shared intake queue, so deleting these rows
-- also clears them from the intake queue and every dashboard that reads
-- intake_items. All child rows cascade except content_calendar.source_intake_id
-- (a non-cascading FK), which is nulled first so the delete isn't blocked.
--
-- This is a deliberate data purge, not a schema change: it deletes whatever
-- exists at apply time. On a fresh database (CI) it is a harmless no-op.
-- ============================================================

-- Null the only non-cascading reference to WhatsApp intake items.
update public.content_calendar
set source_intake_id = null
where source_intake_id in (
  select id from public.intake_items where sender_whatsapp_id is not null
);

-- Outbound replies (the whole table is WhatsApp).
delete from public.whatsapp_outbound_messages;

-- Raw inbound webhook payloads (hold the message content; their link to
-- intake_items only set-nulls, so delete them explicitly).
delete from public.whatsapp_webhook_events;

-- Inbound WhatsApp messages in the intake queue. Cascades handle
-- ai suggestions, classification corrections, media requests, etc.
delete from public.intake_items
where sender_whatsapp_id is not null;
