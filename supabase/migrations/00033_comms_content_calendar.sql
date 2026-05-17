-- ============================================================
-- MIGRATION 00033: Communications content calendar table
-- ============================================================

create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channels text[] not null,
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'scheduled', 'published', 'archived')
  ),
  scheduled_at timestamptz,
  published_at timestamptz,
  body_draft text,
  author_id uuid references public.profiles(id),
  source_intake_id uuid references public.intake_items(id),
  source_initiative_id uuid references public.initiatives(id),
  source_event_id uuid references public.events(id),
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_status on public.content_calendar(status);
create index if not exists idx_calendar_scheduled on public.content_calendar(scheduled_at);

drop trigger if exists content_calendar_set_updated_at on public.content_calendar;
create trigger content_calendar_set_updated_at
  before update on public.content_calendar
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
