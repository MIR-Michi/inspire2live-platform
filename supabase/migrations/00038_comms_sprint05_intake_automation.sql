-- ============================================================
-- MIGRATION 00038: Sprint 05 intake automation and classification
-- ============================================================

alter table public.intake_items
  add column if not exists classifier_version text,
  add column if not exists classifier_status text not null default 'manual'
    check (classifier_status in ('manual', 'auto_classified', 'corrected', 'replayed')),
  add column if not exists classifier_reasoning jsonb not null default '[]'::jsonb,
  add column if not exists classifier_rule_ids text[] not null default '{}';

create index if not exists idx_intake_classifier_status
  on public.intake_items(classifier_status, captured_at desc);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'whatsapp_cloud',
  provider_message_id text not null unique,
  sender_whatsapp_id text,
  sender_name text,
  payload jsonb not null,
  intake_item_id uuid references public.intake_items(id) on delete set null,
  processing_status text not null default 'accepted'
    check (processing_status in ('accepted', 'duplicate', 'failed')),
  failure_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_whatsapp_webhook_events_received
  on public.whatsapp_webhook_events(received_at desc);

create index if not exists idx_whatsapp_webhook_events_sender
  on public.whatsapp_webhook_events(sender_whatsapp_id, received_at desc);

create table if not exists public.intake_classifier_training_examples (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid not null references public.intake_items(id) on delete cascade,
  correction_id uuid unique references public.intake_classification_corrections(id) on delete set null,
  sender_name text not null,
  raw_content text not null,
  previous_content_type text not null,
  corrected_content_type text not null,
  classifier_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_intake_classifier_examples_item
  on public.intake_classifier_training_examples(intake_item_id, created_at desc);

create table if not exists public.intake_classifier_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  description text,
  match_field text not null
    check (match_field in ('sender_name', 'raw_content', 'source_url')),
  match_type text not null
    check (match_type in ('contains', 'exact', 'regex')),
  pattern text not null,
  suggested_content_type text not null,
  suggested_confidence text not null default 'medium'
    check (suggested_confidence in ('low', 'medium', 'high')),
  marks_peter boolean not null default false,
  is_enabled boolean not null default true,
  priority integer not null default 100,
  created_from_correction_id uuid references public.intake_classification_corrections(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_intake_classifier_rules_priority
  on public.intake_classifier_rules(is_enabled, priority desc, created_at asc);

alter table public.whatsapp_webhook_events enable row level security;
alter table public.intake_classifier_training_examples enable row level security;
alter table public.intake_classifier_rules enable row level security;

drop policy if exists whatsapp_webhook_events_comms_access
  on public.whatsapp_webhook_events;
create policy whatsapp_webhook_events_comms_access
  on public.whatsapp_webhook_events
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists intake_classifier_training_examples_comms_access
  on public.intake_classifier_training_examples;
create policy intake_classifier_training_examples_comms_access
  on public.intake_classifier_training_examples
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists intake_classifier_rules_comms_access
  on public.intake_classifier_rules;
create policy intake_classifier_rules_comms_access
  on public.intake_classifier_rules
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
