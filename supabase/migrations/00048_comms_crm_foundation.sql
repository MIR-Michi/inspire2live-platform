-- MIGRATION 00048: Communications CRM foundation

create table if not exists public.comms_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  segment text not null check (segment in ('internal', 'external')),
  source_type text not null default 'manual' check (source_type in ('manual', 'profile', 'campus_member')),
  source_id uuid,
  full_name text not null,
  picture_url text,
  bio text,
  title text,
  organisation text,
  email text,
  phone text,
  city text,
  country text,
  preferred_channel text,
  relationship_owner_id uuid references public.profiles(id) on delete set null,
  relationship_owner_label text,
  lifecycle_stage text not null default 'nurture' check (lifecycle_stage in ('active', 'nurture', 'follow_up', 'archived')),
  last_interaction_at timestamptz,
  next_follow_up_at date,
  consent_status text not null default 'unknown' check (consent_status in ('unknown', 'granted', 'declined', 'not_required')),
  privacy_notes text,
  retention_review_at date,
  source_label text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_comms_crm_contacts_source
  on public.comms_crm_contacts(source_type, source_id)
  where source_id is not null;

create index if not exists idx_comms_crm_contacts_segment
  on public.comms_crm_contacts(segment, lifecycle_stage);

create index if not exists idx_comms_crm_contacts_owner
  on public.comms_crm_contacts(relationship_owner_id)
  where relationship_owner_id is not null;

create index if not exists idx_comms_crm_contacts_followup
  on public.comms_crm_contacts(next_follow_up_at)
  where next_follow_up_at is not null;

create table if not exists public.comms_crm_contact_initiatives (
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  relationship_label text,
  created_at timestamptz not null default now(),
  primary key (contact_id, initiative_id)
);

create index if not exists idx_comms_crm_contact_initiatives_initiative
  on public.comms_crm_contact_initiatives(initiative_id);

create table if not exists public.comms_crm_contact_events (
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  relationship_type text not null default 'related' check (
    relationship_type in ('related', 'speaker', 'host', 'guest', 'owner', 'attendee', 'follow_up')
  ),
  created_at timestamptz not null default now(),
  primary key (contact_id, event_id, relationship_type)
);

create index if not exists idx_comms_crm_contact_events_event
  on public.comms_crm_contact_events(event_id);

create table if not exists public.comms_crm_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  interaction_type text not null default 'note' check (
    interaction_type in ('note', 'email', 'call', 'meeting', 'whatsapp', 'event', 'podcast', 'follow_up')
  ),
  summary text not null,
  occurred_at timestamptz not null default now(),
  next_follow_up_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_crm_interactions_contact
  on public.comms_crm_interactions(contact_id, occurred_at desc);

create table if not exists public.comms_crm_connector_backlog (
  id uuid primary key default gen_random_uuid(),
  integration_target text not null check (
    integration_target in ('outlook', 'mailchimp', 'whatsapp', 'linkedin', 'hubspot', 'salesforce', 'sharepoint')
  ),
  use_case text not null,
  status text not null default 'backlog' check (status in ('backlog', 'discovery', 'ready', 'blocked')),
  guardrail text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_comms_crm_connector_backlog_target_use_case
  on public.comms_crm_connector_backlog(integration_target, use_case);

insert into public.comms_crm_connector_backlog (integration_target, use_case, status, guardrail)
values
  ('outlook', 'Import relationship touchpoints from email and calendar metadata', 'discovery', 'No message-body ingestion before explicit privacy review.'),
  ('mailchimp', 'Link newsletter audience segments back to CRM contacts', 'backlog', 'Consent status must be recorded before any sync.'),
  ('whatsapp', 'Record community follow-up touchpoints', 'backlog', 'No automated outreach until provider and consent controls are approved.'),
  ('linkedin', 'Track public engagement opportunities and publication follow-up', 'backlog', 'Store only intentional comms actions, not broad social scraping.'),
  ('hubspot', 'Evaluate external CRM interoperability', 'backlog', 'Supabase remains the source of truth for platform-owned CRM data.'),
  ('salesforce', 'Evaluate partner CRM interoperability', 'backlog', 'Only sync approved fields after data mapping review.'),
  ('sharepoint', 'Attach approved relationship and consent documents', 'backlog', 'Use links to approved folders, not blind document crawling.')
on conflict (integration_target, use_case) do update
set status = excluded.status,
    guardrail = excluded.guardrail;

alter table public.comms_crm_contacts enable row level security;
alter table public.comms_crm_contact_initiatives enable row level security;
alter table public.comms_crm_contact_events enable row level security;
alter table public.comms_crm_interactions enable row level security;
alter table public.comms_crm_connector_backlog enable row level security;

drop policy if exists comms_crm_contacts_comms_access on public.comms_crm_contacts;
create policy comms_crm_contacts_comms_access on public.comms_crm_contacts
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_crm_contact_initiatives_comms_access on public.comms_crm_contact_initiatives;
create policy comms_crm_contact_initiatives_comms_access on public.comms_crm_contact_initiatives
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_crm_contact_events_comms_access on public.comms_crm_contact_events;
create policy comms_crm_contact_events_comms_access on public.comms_crm_contact_events
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_crm_interactions_comms_access on public.comms_crm_interactions;
create policy comms_crm_interactions_comms_access on public.comms_crm_interactions
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists comms_crm_connector_backlog_comms_access on public.comms_crm_connector_backlog;
create policy comms_crm_connector_backlog_comms_access on public.comms_crm_connector_backlog
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
