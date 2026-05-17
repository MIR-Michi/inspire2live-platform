-- ============================================================
-- MIGRATION 00032: Communications campus members table
-- ============================================================

create table if not exists public.campus_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  organisation text,
  role_description text,
  whatsapp_id text,
  platform_profile_id uuid references public.profiles(id),
  date_welcomed date,
  welcomed_by_peter boolean not null default false,
  initiative_affiliations uuid[],
  notes text,
  last_channel_activity date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campus_members_country on public.campus_members(country);
create index if not exists idx_campus_members_peter on public.campus_members(welcomed_by_peter);

drop trigger if exists campus_members_set_updated_at on public.campus_members;
create trigger campus_members_set_updated_at
  before update on public.campus_members
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
