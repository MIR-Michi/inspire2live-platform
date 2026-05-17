-- ============================================================
-- MIGRATION 00031: Communications media assets table
-- ============================================================

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_type text not null check (
    asset_type in ('photo', 'video', 'recording', 'slides', 'document', 'report')
  ),
  sharepoint_url text,
  storage_path text,
  event_id uuid references public.events(id),
  session_id uuid references public.campus_sessions(id),
  initiative_id uuid references public.initiatives(id),
  contributed_by uuid references public.profiles(id),
  rights_status text not null default 'internal_only' check (
    rights_status in ('internal_only', 'approved_for_publication', 'needs_clearance')
  ),
  tags text[],
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_type on public.media_assets(asset_type);
create index if not exists idx_media_rights on public.media_assets(rights_status);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campus_sessions'
      and column_name = 'slides_media_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'campus_sessions_slides_media_id_fkey'
  ) then
    alter table public.campus_sessions
      add constraint campus_sessions_slides_media_id_fkey
      foreign key (slides_media_id)
      references public.media_assets(id);
  end if;
end $$;

notify pgrst, 'reload schema';
