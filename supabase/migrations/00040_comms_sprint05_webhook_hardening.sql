-- ============================================================
-- MIGRATION 00040: Sprint 05 webhook hardening
-- ============================================================

alter table public.intake_items
  add column if not exists provider_message_id text;

create unique index if not exists idx_intake_provider_message_id
  on public.intake_items(provider_message_id)
  where provider_message_id is not null;

notify pgrst, 'reload schema';
