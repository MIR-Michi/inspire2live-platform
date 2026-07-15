-- ============================================================
-- MIGRATION 00161: SUPERADMIN RLS VISIBILITY FIX
--
-- Root cause of "all content disappeared for the admin": migration 00160
-- collapsed current_user_role() (Superadmin -> PlatformAdmin), which fixes every
-- RLS policy written as `current_user_role() = 'PlatformAdmin'`. But a handful of
-- policies and SECURITY DEFINER functions read `profiles.role` DIRECTLY (via a
-- `where p.id = auth.uid() and p.role = 'PlatformAdmin'` subquery) rather than
-- through current_user_role(). Once the founder's stored role became
-- 'Superadmin', those direct checks stopped matching — hiding the entire comms
-- workspace (is_comms_team_or_admin gates intake, content, events, campus, CRM,
-- tasks, …), plus feedback, user-activity, and login-stats.
--
-- Fix: teach those direct role checks that 'Superadmin' is an admin too. Both
-- admin tiers now pass, exactly as intended (identical DB rights; view-as remains
-- the only app-layer difference).
-- ============================================================

-- 1) THE BIG ONE: is_comms_team_or_admin() gates every comms table's RLS.
--    Add 'Superadmin' to the accepted role set.
create or replace function public.is_comms_team_or_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Comms', 'PlatformAdmin', 'Superadmin')
  );
$$;

-- 2) Feedback admin-all policy (direct role check).
drop policy if exists "feedback_admin_all" on public.feedback_items;
create policy "feedback_admin_all" on public.feedback_items
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('PlatformAdmin', 'Superadmin')
    )
  );

-- 3) User-activity admin-select policy (direct role check).
drop policy if exists user_activity_admin_select on public.user_activity_events;
create policy user_activity_admin_select on public.user_activity_events
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('PlatformAdmin', 'Superadmin')
    )
  );

-- 4) admin_user_login_stats(): SECURITY DEFINER with `set search_path = ''`
--    (so everything stays schema-qualified). Recreate with 'Superadmin' allowed.
create or replace function public.admin_user_login_stats(since timestamptz)
returns table (user_id uuid, login_count bigint, last_login timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('PlatformAdmin', 'Superadmin')
  ) then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id,
    coalesce(a.cnt, 0)::bigint,
    u.last_sign_in_at
  from auth.users u
  left join (
    select
      (e.payload ->> 'actor_id')::uuid as uid,
      count(*)::bigint as cnt
    from auth.audit_log_entries e
    where e.payload ->> 'action' = 'login'
      and e.created_at >= since
      and (e.payload ->> 'actor_id') is not null
    group by 1
  ) a on a.uid = u.id;
end;
$$;

revoke all on function public.admin_user_login_stats(timestamptz) from public;
grant execute on function public.admin_user_login_stats(timestamptz) to authenticated;

notify pgrst, 'reload schema';
