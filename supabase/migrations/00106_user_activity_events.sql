-- ============================================================
-- MIGRATION 00106: User activity events (admin engagement metrics)
-- ============================================================
-- Lightweight telemetry powering the admin "User Activity" view. Two event
-- kinds are recorded by the client:
--   • pageview  — emitted on each route change (where the user goes)
--   • heartbeat — emitted every ~20s ONLY while the tab is visible AND the user
--                 has interacted recently (real engagement, not idle-logged-in)
-- Time-on-platform / time-per-space is derived from heartbeat counts; "how
-- active / where" comes from pageviews and per-space breakdowns.

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('pageview', 'heartbeat')),
  space text not null,
  path text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_user_activity_user_time
  on public.user_activity_events(user_id, occurred_at desc);
create index if not exists idx_user_activity_time
  on public.user_activity_events(occurred_at desc);

alter table public.user_activity_events enable row level security;

-- Each user records only their own activity.
drop policy if exists user_activity_insert_own on public.user_activity_events;
create policy user_activity_insert_own on public.user_activity_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Platform admins can read everyone's activity for the metrics view.
drop policy if exists user_activity_admin_select on public.user_activity_events;
create policy user_activity_admin_select on public.user_activity_events
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'PlatformAdmin'
    )
  );

notify pgrst, 'reload schema';
