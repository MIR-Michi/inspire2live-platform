-- ============================================================
-- MIGRATION 00085: NEWS FEED — PER-TOPIC GROUPING
--
-- The org newsfeed now fans out into small, focused searches per configured
-- topic/theme/mention group (faster + bounded, instead of one broad request).
-- Each item records which group it came from so the dashboard can filter by it.
-- ============================================================

alter table public.news_feed_items
  add column if not exists topic text;

comment on column public.news_feed_items.topic is 'The configured topic/theme/mention group this item was found for (for dashboard filtering).';

create index if not exists idx_news_feed_items_topic
  on public.news_feed_items(topic)
  where topic is not null;

notify pgrst, 'reload schema';
