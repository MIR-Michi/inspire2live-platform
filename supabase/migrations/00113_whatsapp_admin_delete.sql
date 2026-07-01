-- ============================================================
-- MIGRATION 00113: WhatsApp admin deletion controls
--
-- Admins need to remove individual or bulk WhatsApp messages from the inbox
-- while preserving audit/history. These columns hide messages from the WhatsApp
-- inbox without hard-deleting the underlying inbound intake or outbound send log.
-- ============================================================

alter table public.intake_items
  add column if not exists whatsapp_deleted_at timestamptz,
  add column if not exists whatsapp_deleted_by uuid references public.profiles(id) on delete set null;

alter table public.whatsapp_outbound_messages
  add column if not exists whatsapp_deleted_at timestamptz,
  add column if not exists whatsapp_deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_intake_items_whatsapp_visible
  on public.intake_items(sender_whatsapp_id, captured_at desc)
  where sender_whatsapp_id is not null and whatsapp_deleted_at is null;

create index if not exists idx_whatsapp_outbound_visible
  on public.whatsapp_outbound_messages(recipient_whatsapp_id, sent_at desc)
  where whatsapp_deleted_at is null;

notify pgrst, 'reload schema';
