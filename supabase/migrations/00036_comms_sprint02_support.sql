-- ============================================================
-- MIGRATION 00036: Sprint 02 communications workflow support
-- ============================================================

alter table public.intake_items
  add column if not exists attached_media_ref text;

alter table public.content_calendar
  add column if not exists source_link text,
  add column if not exists attached_media_refs text[] not null default '{}';

create table if not exists public.intake_classification_corrections (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid not null references public.intake_items(id) on delete cascade,
  previous_content_type text not null,
  corrected_content_type text not null,
  corrected_by uuid references public.profiles(id),
  corrected_at timestamptz not null default now()
);

create index if not exists idx_intake_classification_item
  on public.intake_classification_corrections(intake_item_id, corrected_at desc);

create table if not exists public.comms_digest_runs (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_email text not null,
  digest_date date not null,
  send_time text not null,
  timezone text not null default 'UTC',
  item_count integer not null default 0,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz not null default now(),
  unique(recipient_id, digest_date, send_time)
);

create index if not exists idx_comms_digest_runs_recipient
  on public.comms_digest_runs(recipient_id, digest_date desc);

alter table public.intake_classification_corrections enable row level security;

drop policy if exists intake_classification_corrections_comms_access
  on public.intake_classification_corrections;
create policy intake_classification_corrections_comms_access
  on public.intake_classification_corrections
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
