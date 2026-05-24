-- MIGRATION 00042: Sprint 08 comms user type and workspace restructure support

alter table public.profiles
  add column if not exists user_type text not null default 'default';

alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (user_type in ('default', 'comms', 'board', 'partner'));

comment on column public.profiles.user_type is
  'Workspace context for the user. Drives nav rendering and default landing route. comms: Communications team member. default: Standard platform user. board: Board member. partner: Industry partner.';

update public.profiles
set user_type = 'comms'
where comms_team = true
  and user_type = 'default';

update public.profiles
set user_type = 'comms',
    comms_team = true
where email = 'marsu101@proton.me';

create or replace function public.current_user_context()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'role', role,
    'user_type', user_type,
    'comms_team', comms_team
  )
  from public.profiles
  where id = auth.uid();
$$;

alter table public.events
  add column if not exists is_i2l_organised boolean not null default false;

alter table public.content_calendar
  add column if not exists whatsapp_groups text[] not null default '{}'::text[];

notify pgrst, 'reload schema';
