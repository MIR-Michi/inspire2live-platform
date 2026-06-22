-- ============================================================
-- MIGRATION 00066: Weekly agenda item ordering
--
-- Adds an explicit `position` for drag-and-drop ordering of weekly meeting
-- agenda topics, and a reorder RPC. Reordering is a collaborative action (any
-- comms member may reorder the shared agenda), so it runs through a
-- SECURITY DEFINER function — the row-level update policy is owner-scoped
-- ("you proposed it, you own it") and would otherwise block reordering of
-- another member's topic.
-- ============================================================

alter table public.comms_weekly_agenda_items
  add column if not exists position integer not null default 0;

create index if not exists idx_comms_weekly_agenda_position
  on public.comms_weekly_agenda_items(meeting_date, position);

-- Backfill: order existing items within each meeting by creation time.
with ranked as (
  select id, row_number() over (partition by meeting_date order by created_at) - 1 as rn
  from public.comms_weekly_agenda_items
)
update public.comms_weekly_agenda_items a
set position = ranked.rn
from ranked
where ranked.id = a.id;

-- Reorder: set each item's position to its index in the supplied id array.
create or replace function public.reorder_agenda_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_comms_team_or_admin() then
    raise exception 'Not authorized to reorder agenda items';
  end if;

  update public.comms_weekly_agenda_items a
  set position = t.ord - 1,
      updated_at = now()
  from unnest(p_item_ids) with ordinality as t(id, ord)
  where a.id = t.id;
end;
$$;

revoke all on function public.reorder_agenda_items(uuid[]) from public;
grant execute on function public.reorder_agenda_items(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
