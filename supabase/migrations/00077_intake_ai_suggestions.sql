-- ============================================================
-- MIGRATION 00077: INTAKE AI SUGGESTIONS
--
-- Adds the Sprint 14 Capability 1 review layer:
-- - Claude-generated structure suggestions for intake_items
-- - human-applied suggestion lifecycle
-- ============================================================

create table if not exists public.intake_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid not null references public.intake_items(id) on delete cascade,
  source text not null default 'ai'
    check (source in ('ai', 'deterministic_fallback', 'batch')),
  content_type text not null
    check (content_type in ('event_report', 'article_share', 'member_intro', 'initiative_update', 'media_request', 'noise')),
  summary text not null,
  entities jsonb not null default '[]'::jsonb,
  suggested_channel text
    check (suggested_channel is null or suggested_channel in ('linkedin', 'newsletter', 'wordpress', 'podcast', 'youtube')),
  suggested_action text not null
    check (suggested_action in ('route_to_calendar', 'route_to_event', 'route_to_campus_member', 'route_to_media_asset', 'mark_reviewed', 'dismiss')),
  founder_signal boolean not null default false,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  rationale text,
  model text,
  effort text,
  raw_response jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'dismissed', 'superseded')),
  created_by uuid references public.profiles(id) on delete set null,
  applied_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intake_ai_suggestions_item
  on public.intake_ai_suggestions(intake_item_id, created_at desc);

create unique index if not exists idx_intake_ai_suggestions_one_pending
  on public.intake_ai_suggestions(intake_item_id)
  where status = 'pending';

alter table public.intake_ai_suggestions enable row level security;

drop policy if exists intake_ai_suggestions_comms_access on public.intake_ai_suggestions;
create policy intake_ai_suggestions_comms_access
  on public.intake_ai_suggestions
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists intake_ai_suggestions_set_updated_at on public.intake_ai_suggestions;
create trigger intake_ai_suggestions_set_updated_at
  before update on public.intake_ai_suggestions
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
