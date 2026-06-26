-- ============================================================
-- MIGRATION 00082: ORG FEED — MENTION MONITORING
--
-- Extends the organization news feed to also monitor mentions of Inspire2Live
-- and its people (news, articles, social media), alongside topical news:
--   - watch_organization + organization_aliases: track the org by name.
--   - watch_crm_internal: track anyone with an @inspire2live.org email in the
--     platform CRM / profiles (resolved at generation time).
--   - watch_people: track specific named individuals (e.g. Peter Kapitein).
-- Each surfaced mention records which watched entity it is about (mention_of).
-- ============================================================

alter table public.org_feed_config
  add column if not exists watch_organization  boolean not null default true,
  add column if not exists organization_aliases text[] not null default array['Inspire2Live']::text[],
  add column if not exists watch_crm_internal   boolean not null default false,
  add column if not exists watch_people         text[] not null default '{}'::text[];

comment on column public.org_feed_config.organization_aliases is 'Names/aliases the organization is referred to by, matched when monitoring mentions.';
comment on column public.org_feed_config.watch_crm_internal is 'When true, people with an @inspire2live.org email in the CRM/profiles are added to mention monitoring at generation time.';
comment on column public.org_feed_config.watch_people is 'Specific named individuals to monitor for public mentions.';

-- The watched entity (organization alias or person name) a feed item mentions.
alter table public.news_feed_items
  add column if not exists mention_of text;

comment on column public.news_feed_items.mention_of is 'The watched entity (org alias or person) this item mentions, when it was surfaced by mention monitoring.';

create index if not exists idx_news_feed_items_mention_of
  on public.news_feed_items(mention_of)
  where mention_of is not null;

notify pgrst, 'reload schema';
