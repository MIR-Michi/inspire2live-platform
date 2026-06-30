-- ============================================================
-- MIGRATION 00107: Admin login stats (backfill from the auth audit log)
-- ============================================================
-- Surfaces real login history that predates the activity-tracking feature.
-- Supabase records every sign-in in auth.audit_log_entries, and the last sign-in
-- on auth.users.last_sign_in_at — neither is exposed via the public API. This
-- SECURITY DEFINER function lets the admin "User activity" view read per-user
-- login counts (within a window) and the all-time last login. It refuses to run
-- for non-admins.

create or replace function public.admin_user_login_stats(since timestamptz)
returns table (user_id uuid, login_count bigint, last_login timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'PlatformAdmin'
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
