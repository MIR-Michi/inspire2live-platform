-- MIGRATION 00044: Add reviewed intake status

alter table public.intake_items
  drop constraint if exists intake_items_status_check;

alter table public.intake_items
  add constraint intake_items_status_check
  check (status in ('unreviewed', 'reviewed', 'routed', 'dismissed', 'archived'));

notify pgrst, 'reload schema';
