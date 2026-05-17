-- ============================================================
-- MIGRATION 00028: Communications intake items
--
-- Adds the source table for manually captured and future automated
-- World Campus Channel intake.
-- ============================================================

create table if not exists public.intake_items (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  capture_method text not null check (
    capture_method in ('manual', 'webhook', 'ai')
  ),
  sender_name text not null,
  sender_whatsapp_id text,
  raw_content text not null,
  source_url text,
  content_type text not null check (
    content_type in (
      'event_report',
      'article_share',
      'member_intro',
      'initiative_update',
      'media_request',
      'noise'
    )
  ),
  classification_confidence text check (
    classification_confidence in ('high', 'medium', 'low')
  ),
  is_peter_kapitein boolean not null default false,
  status text not null default 'unreviewed' check (
    status in ('unreviewed', 'routed', 'dismissed', 'archived')
  ),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  routed_to_type text,
  routed_to_id uuid,
  dismissed_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_intake_status
  on public.intake_items(status);

create index if not exists idx_intake_captured
  on public.intake_items(captured_at desc);

create index if not exists idx_intake_peter
  on public.intake_items(is_peter_kapitein)
  where is_peter_kapitein = true;

notify pgrst, 'reload schema';
