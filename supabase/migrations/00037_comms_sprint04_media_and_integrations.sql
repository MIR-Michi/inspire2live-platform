-- ============================================================
-- MIGRATION 00037: Sprint 04 media recovery + integration intents
-- ============================================================

create table if not exists public.media_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  request_intake_id uuid not null unique references public.intake_items(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  event_id uuid references public.events(id),
  session_id uuid references public.campus_sessions(id),
  initiative_id uuid references public.initiatives(id),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution_notes text,
  resolved_asset_id uuid references public.media_assets(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_media_recovery_status
  on public.media_recovery_requests(status);

create index if not exists idx_media_recovery_event
  on public.media_recovery_requests(event_id)
  where event_id is not null;

create index if not exists idx_media_recovery_session
  on public.media_recovery_requests(session_id)
  where session_id is not null;

create table if not exists public.media_recovery_offers (
  id uuid primary key default gen_random_uuid(),
  recovery_request_id uuid not null references public.media_recovery_requests(id) on delete cascade,
  intake_item_id uuid not null unique references public.intake_items(id) on delete cascade,
  offered_by text not null,
  notes text not null,
  sharepoint_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_recovery_offers_request
  on public.media_recovery_offers(recovery_request_id, created_at desc);

create table if not exists public.comms_integration_intents (
  id uuid primary key default gen_random_uuid(),
  integration_target text not null check (
    integration_target in ('wordpress', 'linkedin', 'mailchimp', 'sharepoint', 'teams')
  ),
  action_name text not null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('content_calendar', 'events', 'campus_sessions', 'media_assets', 'media_recovery_requests')
  ),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_integration_target
  on public.comms_integration_intents(integration_target, created_at desc);

create index if not exists idx_comms_integration_entity
  on public.comms_integration_intents(entity_type, entity_id, created_at desc);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'task_assigned',
      'task_completed',
      'milestone_approaching',
      'milestone_completed',
      'new_discussion',
      'mention',
      'decision_flagged',
      'partner_application',
      'inactivity_nudge',
      'initiative_joined',
      'congress_role_assigned',
      'invite_received',
      'media_recovery_offer'
    )
  );

alter table public.media_recovery_requests enable row level security;
alter table public.media_recovery_offers enable row level security;
alter table public.comms_integration_intents enable row level security;

drop policy if exists media_recovery_requests_comms_access on public.media_recovery_requests;
create policy media_recovery_requests_comms_access on public.media_recovery_requests
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists media_recovery_offers_comms_access on public.media_recovery_offers;
create policy media_recovery_offers_comms_access on public.media_recovery_offers
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_integration_intents_comms_access on public.comms_integration_intents;
create policy comms_integration_intents_comms_access on public.comms_integration_intents
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
