-- ============================================================
-- MIGRATION 00030: Communications campus sessions table
-- ============================================================

create table if not exists public.campus_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  theme text,
  participating_hub_ids uuid[],
  summary text,
  action_items_for_publication text[],
  recording_url text,
  slides_media_id uuid,
  initiative_ids uuid[],
  published_outputs uuid[],
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists campus_sessions_set_updated_at on public.campus_sessions;
create trigger campus_sessions_set_updated_at
  before update on public.campus_sessions
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
