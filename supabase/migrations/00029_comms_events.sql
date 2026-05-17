-- ============================================================
-- MIGRATION 00029: Communications events pipeline table
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null check (
    event_type in ('conference', 'congress', 'workshop', 'webinar', 'symposium', 'other')
  ),
  is_annual_congress boolean not null default false,
  start_date date not null,
  end_date date,
  location_city text,
  location_country text,
  organiser text,
  stage text not null default 'announced' check (
    stage in ('announced', 'attending', 'in_progress', 'post_event', 'archived')
  ),
  i2l_representatives uuid[],
  initiative_ids uuid[],
  output_report_drafted boolean not null default false,
  output_linkedin_published boolean not null default false,
  output_newsletter_mentioned boolean not null default false,
  output_media_stored boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_stage on public.events(stage);
create index if not exists idx_events_date on public.events(start_date);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
