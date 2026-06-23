-- ============================================================
-- MIGRATION 00072: Link CRM pipelines to events
--
-- Adds a `pipeline_ids` array column to events so a podcast (or any
-- event) can be connected to one or more CRM pipelines — mirroring the
-- existing `initiative_ids` linkage. Connections are managed from the
-- event detail page and can be disconnected again.
-- ============================================================

alter table public.events
  add column if not exists pipeline_ids uuid[] not null default '{}';

notify pgrst, 'reload schema';
