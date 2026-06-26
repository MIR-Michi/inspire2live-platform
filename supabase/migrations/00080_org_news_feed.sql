-- ============================================================
-- MIGRATION 00080: ORGANIZATION NEWS FEED
--
-- Sprint 14 Capability 4 (admin-configured org-wide news feed):
-- - org_feed_config: a single Platform-Admin-owned record describing what
--   the organization wants to monitor (topics, themes, source allow/block
--   lists, region, cadence).
-- - news_feed_items: the AI-assembled, citation-backed items that fill the
--   dashboard "Field Newsfeed" card for every stakeholder.
--
-- source_url is mandatory — every AI-surfaced claim must be traceable.
-- ============================================================

-- ── org_feed_config (single admin-owned record) ────────────
create table if not exists public.org_feed_config (
  singleton       boolean     primary key default true check (singleton),
  topics          text[]      not null default '{}',
  themes          text[]      not null default '{}',
  allowed_sources text[]      not null default '{}',
  blocked_sources text[]      not null default '{}',
  region          text,
  cadence         text        not null default 'weekly'
    check (cadence in ('daily', 'weekly', 'monthly')),
  enabled         boolean     not null default true,
  updated_by      uuid        references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now()
);

comment on table public.org_feed_config is 'Single org-wide news-feed monitoring configuration owned by PlatformAdmin. Drives generateOrgNewsfeed().';

alter table public.org_feed_config enable row level security;

-- Config is admin-managed; the generation job reads it via the service role.
drop policy if exists org_feed_config_select_admin on public.org_feed_config;
create policy org_feed_config_select_admin on public.org_feed_config
  for select to authenticated
  using (public.current_user_role() = 'PlatformAdmin');

drop policy if exists org_feed_config_write_admin on public.org_feed_config;
create policy org_feed_config_write_admin on public.org_feed_config
  for all to authenticated
  using (public.current_user_role() = 'PlatformAdmin')
  with check (public.current_user_role() = 'PlatformAdmin');

drop trigger if exists org_feed_config_set_updated_at on public.org_feed_config;
create trigger org_feed_config_set_updated_at
  before update on public.org_feed_config
  for each row execute function public.set_updated_at();

-- ── news_feed_items (read by all stakeholders) ─────────────
create table if not exists public.news_feed_items (
  id           uuid        primary key default gen_random_uuid(),
  headline     text        not null,
  summary      text,
  category     text        not null default 'other',
  region       text,
  source_url   text        not null,
  source_name  text,
  -- 0-100 relevance to I2L themes / active initiatives, set by the model.
  relevance    integer     not null default 50 check (relevance between 0 and 100),
  published_at timestamptz,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.news_feed_items is 'AI-assembled, citation-backed org news items rendered in the dashboard Field Newsfeed for all stakeholders. source_url is mandatory.';

-- Dedupe key: one item per source URL.
create unique index if not exists idx_news_feed_items_source_url
  on public.news_feed_items (source_url);
create index if not exists idx_news_feed_items_published
  on public.news_feed_items (published_at desc nulls last, relevance desc);

alter table public.news_feed_items enable row level security;

-- All authenticated stakeholders read the org feed.
drop policy if exists news_feed_items_select_all on public.news_feed_items;
create policy news_feed_items_select_all on public.news_feed_items
  for select to authenticated
  using (true);

-- Only admins write from the UI; the cron job writes via the service role.
drop policy if exists news_feed_items_write_admin on public.news_feed_items;
create policy news_feed_items_write_admin on public.news_feed_items
  for all to authenticated
  using (public.current_user_role() = 'PlatformAdmin')
  with check (public.current_user_role() = 'PlatformAdmin');

notify pgrst, 'reload schema';
