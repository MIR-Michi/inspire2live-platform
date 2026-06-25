-- ============================================================
-- MIGRATION 00075: unified_tasks read-only view
--
-- One read shape over the three task stores (initiative `tasks`,
-- `comms_tasks`, `member_onboarding_tasks`) so the application can load
-- "all of a person's tasks" through a single query. See ADR-0008.
--
-- This is the READ path only. Writes still go to each source table via its
-- own server action (preserving that table's RLS, triggers, and
-- side-effects). The view normalizes nothing about status — it exposes the
-- raw status + source so the TypeScript domain layer can map to the single
-- canonical vocabulary in one place (lib/tasks/status.ts).
--
-- SECURITY: created `with (security_invoker = true)` so the view runs with
-- the privileges (and RLS) of the QUERYING user, not the view owner. Each
-- underlying table's existing row-level security therefore still applies —
-- the view grants no visibility a user did not already have.
-- ============================================================

create or replace view public.unified_tasks
with (security_invoker = true) as
  -- Initiative / project tasks
  select
    'initiative'::text          as source,
    t.id,
    t.title,
    t.description,
    t.assignee_id               as owner_id,
    t.status                    as status,
    t.due_date,
    t.priority,
    null::integer               as position,
    'initiative'::text          as context_kind,
    t.initiative_id             as context_id,
    t.created_at,
    t.updated_at
  from public.tasks t

  union all

  -- Communications-team tasks (incl. campus meeting checklist)
  select
    'comms'::text               as source,
    c.id,
    c.title,
    c.description,
    c.owner_id,
    c.status,
    c.due_date,
    null::text                  as priority,
    null::integer               as position,
    case
      when c.campus_session_id is not null then 'campus_session'
      when c.agenda_item_id   is not null then 'agenda_item'
      else 'standalone'
    end                         as context_kind,
    coalesce(c.campus_session_id, c.agenda_item_id) as context_id,
    c.created_at,
    c.updated_at
  from public.comms_tasks c

  union all

  -- New-member onboarding checklist tasks
  select
    'onboarding'::text          as source,
    m.id,
    m.title,
    null::text                  as description,
    m.assignee_id               as owner_id,
    m.status,
    null::date                  as due_date,
    null::text                  as priority,
    m.position,
    'onboarding_member'::text   as context_kind,
    m.onboarding_id             as context_id,
    m.created_at,
    m.updated_at
  from public.member_onboarding_tasks m;

grant select on public.unified_tasks to authenticated;

notify pgrst, 'reload schema';
