-- ============================================================
-- MIGRATION 00088: Conference contact assignments
--
-- Links registered conferences to Inspire2Live/CRM contacts who will attend or
-- act as the I2L point of contact. Contacts remain canonical in
-- comms_crm_contacts; this table only stores the conference relationship and
-- notification state.
-- ============================================================

create table if not exists public.conference_contact_assignments (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences(id) on delete cascade,
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  role text not null default 'attendee'
    check (role in ('attendee', 'speaker', 'organizer', 'i2l_contact')),
  notification_status text not null default 'queued'
    check (notification_status in ('queued', 'sent', 'partial', 'failed', 'skipped')),
  notification_detail text,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, contact_id)
);

create index if not exists idx_conference_contact_assignments_conference
  on public.conference_contact_assignments(conference_id, assigned_at desc);
create index if not exists idx_conference_contact_assignments_contact
  on public.conference_contact_assignments(contact_id, assigned_at desc);

alter table public.conference_contact_assignments enable row level security;

drop policy if exists conference_contact_assignments_comms_access on public.conference_contact_assignments;
create policy conference_contact_assignments_comms_access
  on public.conference_contact_assignments for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists conference_contact_assignments_set_updated_at on public.conference_contact_assignments;
create trigger conference_contact_assignments_set_updated_at
  before update on public.conference_contact_assignments
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
