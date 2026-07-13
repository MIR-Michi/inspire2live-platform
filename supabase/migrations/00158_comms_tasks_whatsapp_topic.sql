-- ============================================================
-- MIGRATION 00158: Tie comms_tasks to a WhatsApp digest topic
--
-- Adds an optional link from a comms task to the categorized WhatsApp feed
-- item ("topic") it was raised from, so a comms operator can turn any digest
-- topic into an assigned, deadlined task that shows up in the owner's "my
-- dashboard" through the existing unified_tasks view (ADR-0008).
--
-- READ path only changes here: the view gains a `whatsapp_topic` context so
-- the task carries the topic as its context label/link. Writes still go
-- through the comms_tasks server action (unchanged RLS).
-- ============================================================

alter table public.comms_tasks
  add column if not exists whatsapp_feed_item_id uuid
    references public.whatsapp_feed_items(id) on delete set null;

create index if not exists idx_comms_tasks_whatsapp_feed_item
  on public.comms_tasks(whatsapp_feed_item_id)
  where whatsapp_feed_item_id is not null;

-- Rebuild the unified_tasks view so a comms task linked to a WhatsApp topic
-- surfaces with context_kind='whatsapp_topic'. Order of the CASE matters:
-- campus session and agenda item keep priority, then topic, then standalone.
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

  -- Communications-team tasks (incl. campus checklist + WhatsApp topics)
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
      when c.campus_session_id     is not null then 'campus_session'
      when c.agenda_item_id        is not null then 'agenda_item'
      when c.whatsapp_feed_item_id is not null then 'whatsapp_topic'
      else 'standalone'
    end                         as context_kind,
    coalesce(c.campus_session_id, c.agenda_item_id, c.whatsapp_feed_item_id) as context_id,
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
