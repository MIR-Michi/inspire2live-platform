-- Sprint 19: per-user, versioned dashboard layout preferences.
-- Presentation preferences only: no widget data or permission grants live here.

create table if not exists public.user_dashboard_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dashboard_id text not null,
  layout_version integer not null default 1,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_dashboard_preferences_pkey primary key (user_id, dashboard_id),
  constraint user_dashboard_preferences_dashboard_id_check
    check (dashboard_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  constraint user_dashboard_preferences_layout_version_check
    check (layout_version > 0),
  constraint user_dashboard_preferences_layout_object_check
    check (jsonb_typeof(layout) = 'object')
);

create index if not exists idx_user_dashboard_preferences_dashboard
  on public.user_dashboard_preferences (dashboard_id);

alter table public.user_dashboard_preferences enable row level security;

revoke all on public.user_dashboard_preferences from anon;
grant select, insert, update, delete on public.user_dashboard_preferences to authenticated;

drop policy if exists user_dashboard_preferences_read_own on public.user_dashboard_preferences;
create policy user_dashboard_preferences_read_own
  on public.user_dashboard_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_dashboard_preferences_insert_own on public.user_dashboard_preferences;
create policy user_dashboard_preferences_insert_own
  on public.user_dashboard_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_dashboard_preferences_update_own on public.user_dashboard_preferences;
create policy user_dashboard_preferences_update_own
  on public.user_dashboard_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_dashboard_preferences_delete_own on public.user_dashboard_preferences;
create policy user_dashboard_preferences_delete_own
  on public.user_dashboard_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_dashboard_preferences is
  'Versioned per-user dashboard presentation preferences. Does not store widget data or grant access.';
comment on column public.user_dashboard_preferences.layout is
  'Validated layout JSON: split ratio, preset, density, and widget zone/order/size/visibility/collapse state.';

notify pgrst, 'reload schema';
