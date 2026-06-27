-- ============================================================
-- MIGRATION 00084: PERF — HOT-PATH INDEXES
--
-- Targeted indexes for queries that run on (nearly) every page load, to keep
-- navigation snappy. Idempotent and additive only.
--
-- Numbered 00084 to sit clear of the parallel Sprint 14 org-feed branch
-- (00080–00083); all statements use IF NOT EXISTS so apply order is irrelevant.
-- ============================================================

-- The app layout counts unreviewed intake for the current month on every page
-- load: WHERE status = 'unreviewed' AND captured_at >= … AND captured_at < …
-- A composite (status, captured_at) serves that filter+range directly, instead
-- of combining two single-column indexes.
create index if not exists idx_intake_items_status_captured
  on public.intake_items (status, captured_at desc);

notify pgrst, 'reload schema';
