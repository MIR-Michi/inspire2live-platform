-- ============================================================
-- MIGRATION 00052: CRM person types, internal profile fields, and pipelines
--
-- Extends the CRM foundation (migration 00048) with:
--   1. A person_type classification (Comms, Patient Advocate, Clinician,
--      Researcher, Governmental, Patient) plus expertise/skills fields for
--      internal people, and an internal-by-default segment.
--   2. Pipelines (funnels): named pipelines with ordered stages and member
--      assignments, scoped to the same comms-only RLS chokepoint.
-- ============================================================

-- ── 1. Contact classification + internal profile fields ─────────────────────

alter table public.comms_crm_contacts
  add column if not exists person_type text,
  add column if not exists field_of_expertise text[] not null default '{}',
  add column if not exists skills text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'comms_crm_contacts_person_type_check'
  ) then
    alter table public.comms_crm_contacts
      add constraint comms_crm_contacts_person_type_check
      check (
        person_type is null
        or person_type in ('comms', 'patient_advocate', 'clinician', 'researcher', 'governmental', 'patient')
      );
  end if;
end $$;

alter table public.comms_crm_contacts
  alter column segment set default 'internal';

create index if not exists idx_comms_crm_contacts_person_type
  on public.comms_crm_contacts(person_type);

-- ── 2. Pipelines (funnels) ───────────────────────────────────────────────────

create table if not exists public.comms_crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comms_crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.comms_crm_pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_crm_pipeline_stages_pipeline
  on public.comms_crm_pipeline_stages(pipeline_id, position);

create table if not exists public.comms_crm_pipeline_members (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.comms_crm_pipeline_stages(id) on delete cascade,
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  note text,
  position integer not null default 0,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (stage_id, contact_id)
);

create index if not exists idx_comms_crm_pipeline_members_stage
  on public.comms_crm_pipeline_members(stage_id, position);
create index if not exists idx_comms_crm_pipeline_members_contact
  on public.comms_crm_pipeline_members(contact_id);

alter table public.comms_crm_pipelines enable row level security;
alter table public.comms_crm_pipeline_stages enable row level security;
alter table public.comms_crm_pipeline_members enable row level security;

create policy comms_crm_pipelines_comms_access
  on public.comms_crm_pipelines for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

create policy comms_crm_pipeline_stages_comms_access
  on public.comms_crm_pipeline_stages for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

create policy comms_crm_pipeline_members_comms_access
  on public.comms_crm_pipeline_members for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());
