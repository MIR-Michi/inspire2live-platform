-- ============================================================
-- MIGRATION 00083: ORG FEED — BACKGROUND RUN STATUS
--
-- The newsfeed generation (web search + compile) is long-running, so it now
-- runs in the background instead of blocking the UI request. These columns on
-- the singleton org_feed_config record track the latest run so the UI can
-- kick it off, poll for completion, and survive a page reload mid-run.
-- ============================================================

alter table public.org_feed_config
  add column if not exists last_run_status      text not null default 'idle'
    check (last_run_status in ('idle', 'running', 'success', 'error')),
  add column if not exists last_run_started_at  timestamptz,
  add column if not exists last_run_finished_at timestamptz,
  add column if not exists last_run_message     text,
  add column if not exists last_run_inserted    integer;

comment on column public.org_feed_config.last_run_status is 'Status of the most recent (or in-progress) background newsfeed generation run.';

notify pgrst, 'reload schema';
