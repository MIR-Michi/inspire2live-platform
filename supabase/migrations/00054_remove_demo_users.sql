-- ============================================================
-- MIGRATION 00054: REMOVE DEMO / SEED USERS AND THEIR CONTENT
--
-- Deletes the fake accounts that were seeded to populate the
-- platform for demos, plus the demo content they own. Two groups:
--   1. The @example.com personas (seed.sql / migration 00005)
--   2. The leftover @inspire2live.org demo trio: kai, nadia, maria
--      (michael.wittinger@inspire2live.org is a REAL admin and is
--       intentionally NOT included)
--
-- Most content FKs to profiles are ON DELETE NO ACTION (RESTRICT),
-- so the owned content must be removed first, in dependency order,
-- before the auth.users rows can be deleted (profiles cascade from
-- auth.users). Nullable references on potentially-real rows are set
-- to NULL rather than deleting the row.
--
-- The whole migration runs in a single transaction. Every statement
-- is guarded with to_regclass so it is safe across environments, and
-- if any unforeseen reference blocks a delete the transaction rolls
-- back cleanly — no partial/orphaned state.
-- ============================================================

-- Guarded executor: runs p_sql only if the table exists.
create or replace function public._demo_cleanup_exec(p_sql text, p_table text)
returns void language plpgsql as $$
begin
  if to_regclass('public.' || p_table) is not null then
    execute p_sql;
  end if;
end $$;

-- ── Staging: resolve the demo accounts and the content they own ──
drop table if exists public._demo_targets;
create table public._demo_targets (id uuid primary key);

insert into public._demo_targets (id)
select id from public.profiles
where lower(email) in (
  'maria@example.com',
  'kwame@example.com',
  'sophie@example.com',
  'hiroshi@example.com',
  'amara@example.com',
  'peter@example.com',
  'lina@example.com',
  'kai@inspire2live.org',
  'nadia@inspire2live.org',
  'maria@inspire2live.org'
);

-- Capture demo-owned parent entities BEFORE we start deleting them.
drop table if exists public._demo_initiatives;
create table public._demo_initiatives (id uuid primary key);
insert into public._demo_initiatives (id)
select id from public.initiatives where lead_id in (select id from public._demo_targets);

drop table if exists public._demo_hubs;
create table public._demo_hubs (id uuid primary key);
insert into public._demo_hubs (id)
select id from public.hubs where coordinator_id in (select id from public._demo_targets);

do $$
declare
  n_users int;
begin
  select count(*) into n_users from public._demo_targets;
  raise notice 'Demo cleanup: % matching account(s) found', n_users;
  if n_users = 0 then
    raise notice 'Nothing to delete.';
    return;
  end if;

  -- ── 1) NULL nullable references on possibly-real rows ─────────
  perform public._demo_cleanup_exec(
    'update public.content_calendar set author_id = null where author_id in (select id from public._demo_targets)', 'content_calendar');
  perform public._demo_cleanup_exec(
    'update public.campus_sessions set created_by = null where created_by in (select id from public._demo_targets)', 'campus_sessions');
  perform public._demo_cleanup_exec(
    'update public.campus_members set platform_profile_id = null where platform_profile_id in (select id from public._demo_targets)', 'campus_members');
  perform public._demo_cleanup_exec(
    'update public.intake_items set reviewed_by = null where reviewed_by in (select id from public._demo_targets)', 'intake_items');
  perform public._demo_cleanup_exec(
    'update public.intake_classification_corrections set corrected_by = null where corrected_by in (select id from public._demo_targets)', 'intake_classification_corrections');
  perform public._demo_cleanup_exec(
    'update public.intake_classifier_rules set created_by = null where created_by in (select id from public._demo_targets)', 'intake_classifier_rules');
  perform public._demo_cleanup_exec(
    'update public.intake_classifier_training_examples set created_by = null where created_by in (select id from public._demo_targets)', 'intake_classifier_training_examples');
  perform public._demo_cleanup_exec(
    'update public.media_assets set contributed_by = null where contributed_by in (select id from public._demo_targets)', 'media_assets');
  perform public._demo_cleanup_exec(
    'update public.media_recovery_requests set requested_by = null where requested_by in (select id from public._demo_targets)', 'media_recovery_requests');
  perform public._demo_cleanup_exec(
    'update public.congress_sessions set session_lead_id = null where session_lead_id in (select id from public._demo_targets)', 'congress_sessions');
  perform public._demo_cleanup_exec(
    'update public.congress_sessions set note_taker_id = null where note_taker_id in (select id from public._demo_targets)', 'congress_sessions');
  perform public._demo_cleanup_exec(
    'update public.congress_sessions set decision_capture_id = null where decision_capture_id in (select id from public._demo_targets)', 'congress_sessions');
  perform public._demo_cleanup_exec(
    'update public.congress_decisions set owner_id = null where owner_id in (select id from public._demo_targets)', 'congress_decisions');
  perform public._demo_cleanup_exec(
    'update public.discussions set decision_made_by = null where decision_made_by in (select id from public._demo_targets)', 'discussions');
  perform public._demo_cleanup_exec(
    'update public.partner_engagements set reviewer_id = null where reviewer_id in (select id from public._demo_targets)', 'partner_engagements');

  -- ── 2) Delete owned content, children before parents ─────────

  -- Permission audit entries authored by, or targeting, demo users
  perform public._demo_cleanup_exec(
    'delete from public.permission_audit_log where changed_by in (select id from public._demo_targets) or target_user_id in (select id from public._demo_targets)', 'permission_audit_log');

  -- Partners
  perform public._demo_cleanup_exec(
    'delete from public.partner_audit_entries where actor_id in (select id from public._demo_targets) or engagement_id in (select id from public.partner_engagements where partner_id in (select id from public._demo_targets))', 'partner_audit_entries');
  perform public._demo_cleanup_exec(
    'delete from public.partner_engagements where partner_id in (select id from public._demo_targets)', 'partner_engagements');

  -- Congress topics + their votes
  perform public._demo_cleanup_exec(
    'delete from public.topic_votes where topic_id in (select id from public.congress_topics where submitter_id in (select id from public._demo_targets))', 'topic_votes');
  perform public._demo_cleanup_exec(
    'delete from public.congress_topics where submitter_id in (select id from public._demo_targets)', 'congress_topics');

  -- Tasks subtree (comments first)
  perform public._demo_cleanup_exec(
    'delete from public.task_comments where author_id in (select id from public._demo_targets) or task_id in (select id from public.tasks where assignee_id in (select id from public._demo_targets) or reporter_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives))', 'task_comments');
  perform public._demo_cleanup_exec(
    'delete from public.tasks where assignee_id in (select id from public._demo_targets) or reporter_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives)', 'tasks');

  -- Discussions subtree (replies first)
  perform public._demo_cleanup_exec(
    'delete from public.discussion_replies where author_id in (select id from public._demo_targets) or discussion_id in (select id from public.discussions where author_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives))', 'discussion_replies');
  perform public._demo_cleanup_exec(
    'delete from public.discussions where author_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives)', 'discussions');

  -- Initiative-scoped content
  perform public._demo_cleanup_exec(
    'delete from public.resources where uploaded_by_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives)', 'resources');
  perform public._demo_cleanup_exec(
    'delete from public.milestones where initiative_id in (select id from public._demo_initiatives)', 'milestones');
  perform public._demo_cleanup_exec(
    'delete from public.initiative_members where user_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives)', 'initiative_members');
  perform public._demo_cleanup_exec(
    'delete from public.activity_log where actor_id in (select id from public._demo_targets) or initiative_id in (select id from public._demo_initiatives)', 'activity_log');

  -- Hubs subtree
  perform public._demo_cleanup_exec(
    'delete from public.hub_members where user_id in (select id from public._demo_targets) or hub_id in (select id from public._demo_hubs)', 'hub_members');
  perform public._demo_cleanup_exec(
    'delete from public.hub_initiatives where hub_id in (select id from public._demo_hubs) or initiative_id in (select id from public._demo_initiatives)', 'hub_initiatives');
  perform public._demo_cleanup_exec(
    'delete from public.hubs where coordinator_id in (select id from public._demo_targets)', 'hubs');

  -- Initiatives last (parents of the above)
  perform public._demo_cleanup_exec(
    'delete from public.initiatives where lead_id in (select id from public._demo_targets)', 'initiatives');

  -- ── 3) Delete the accounts. Profiles + remaining CASCADE/SET NULL
  --        references (notifications, session_attendees, etc.) clear
  --        automatically when the auth.users row is removed.
  delete from auth.users where id in (select id from public._demo_targets);

  raise notice 'Demo cleanup complete: removed % account(s) and their content', n_users;
end $$;

-- ── Tidy up staging objects ──
drop table if exists public._demo_initiatives;
drop table if exists public._demo_hubs;
drop table if exists public._demo_targets;
drop function if exists public._demo_cleanup_exec(text, text);

notify pgrst, 'reload schema';
