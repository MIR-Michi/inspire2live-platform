-- MIGRATION 00045: Structured campus session decisions

alter table public.campus_sessions
  add column if not exists decisions_for_publication text[] not null default '{}'::text[];

notify pgrst, 'reload schema';
