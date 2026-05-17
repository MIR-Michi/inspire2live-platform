-- ============================================================
-- MIGRATION 00035: Communications permission space + RLS
-- ============================================================

create or replace function public.is_comms_team_or_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'PlatformAdmin'
        or (p.role = 'Moderator' and p.comms_team = true)
      )
  );
$$;

alter table public.user_space_permissions
  drop constraint if exists user_space_permissions_space_check;

alter table public.user_space_permissions
  add constraint user_space_permissions_space_check
  check (space in (
    'dashboard','initiatives','tasks','congress','stories',
    'resources','partners','network','board','bureau',
    'notifications','profile','admin','comms'
  ));

alter table public.role_space_default_overrides
  drop constraint if exists rsdo_space_check;

alter table public.role_space_default_overrides
  add constraint rsdo_space_check
  check (space in (
    'dashboard','initiatives','tasks','congress','stories',
    'resources','partners','network','board','bureau',
    'notifications','profile','admin','comms'
  ));

alter table public.intake_items enable row level security;
alter table public.content_calendar enable row level security;
alter table public.events enable row level security;
alter table public.campus_sessions enable row level security;
alter table public.campus_members enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists intake_items_comms_access on public.intake_items;
create policy intake_items_comms_access on public.intake_items
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists content_calendar_comms_access on public.content_calendar;
create policy content_calendar_comms_access on public.content_calendar
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists events_comms_access on public.events;
create policy events_comms_access on public.events
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists campus_sessions_comms_access on public.campus_sessions;
create policy campus_sessions_comms_access on public.campus_sessions
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists campus_members_comms_access on public.campus_members;
create policy campus_members_comms_access on public.campus_members
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop policy if exists media_assets_comms_access on public.media_assets;
create policy media_assets_comms_access on public.media_assets
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
