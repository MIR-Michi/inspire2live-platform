-- ============================================================
-- MIGRATION 00154: Fast CRM contact autocomplete (trigram search)
--
-- The conference guest picker searches contacts with a substring match
-- (`full_name ILIKE '%query%'`). A leading wildcard can't use a plain B-tree
-- index, so every keystroke forced a sequential scan of comms_crm_contacts —
-- which gets slower as the CRM grows and made the autocomplete feel sluggish.
--
-- pg_trgm GIN indexes accelerate case-insensitive substring (ILIKE) matching,
-- so the same query is served from an index instead. Indexes are added for the
-- two columns the picker searches: full_name and email.
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_comms_crm_contacts_full_name_trgm
  on public.comms_crm_contacts using gin (full_name extensions.gin_trgm_ops);

create index if not exists idx_comms_crm_contacts_email_trgm
  on public.comms_crm_contacts using gin (email extensions.gin_trgm_ops);

notify pgrst, 'reload schema';
