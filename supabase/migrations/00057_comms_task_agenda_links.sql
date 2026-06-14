alter table public.comms_tasks
  add column if not exists agenda_item_id uuid references public.comms_weekly_agenda_items(id) on delete set null;

create index if not exists idx_comms_tasks_agenda_item
  on public.comms_tasks(agenda_item_id)
  where agenda_item_id is not null;

notify pgrst, 'reload schema';
