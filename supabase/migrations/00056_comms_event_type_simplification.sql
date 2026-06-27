-- MIGRATION 00056: Simplify Communications event types
-- Active Communications event workflows are now limited to conferences and podcasts.
-- Legacy non-podcast event rows are retained as conferences.

update public.events
set event_type = 'conference'
where event_type is distinct from 'podcast';

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('conference', 'podcast'));

notify pgrst, 'reload schema';
