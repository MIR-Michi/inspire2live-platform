-- ============================================================
-- MIGRATION 00055: WhatsApp outbound delivery status tracking
--
-- Sprint 12 (S12-T01). The WhatsApp Cloud API delivers message
-- status receipts ("statuses" change events) back through the
-- same webhook: sent -> delivered -> read, or failed. Until now
-- whatsapp_outbound_messages.delivery_status only modelled the
-- fire-and-forget 'sent' / 'failed' pair, so operators could not
-- tell whether a reply actually reached (or was read by) the
-- recipient.
--
-- This migration:
--   1. Widens the delivery_status vocabulary to include
--      'delivered' and 'read'.
--   2. Adds delivered_at / read_at timestamps for the receipt
--      times reported by Meta.
--   3. Indexes graph_message_id so the webhook processor can look
--      up the outbound row a status event refers to.
-- ============================================================

-- ── 1) Widen the delivery_status check vocabulary ───────────
alter table public.whatsapp_outbound_messages
  drop constraint if exists whatsapp_outbound_messages_delivery_status_check;

alter table public.whatsapp_outbound_messages
  add constraint whatsapp_outbound_messages_delivery_status_check
  check (delivery_status in ('sent', 'delivered', 'read', 'failed'));

-- ── 2) Receipt timestamps ───────────────────────────────────
alter table public.whatsapp_outbound_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

-- ── 3) Lookup index for status-event matching ───────────────
create index if not exists idx_whatsapp_outbound_graph_message_id
  on public.whatsapp_outbound_messages(graph_message_id);

notify pgrst, 'reload schema';
