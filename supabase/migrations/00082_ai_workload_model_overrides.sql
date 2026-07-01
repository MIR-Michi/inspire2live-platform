-- ============================================================
-- MIGRATION 00082: AI WORKLOAD MODEL OVERRIDES
-- Adds per-workload model/effort configuration for AI routing.
-- ============================================================

alter table public.ai_settings
  add column if not exists model_overrides jsonb not null default '{}'::jsonb;

comment on column public.ai_settings.model_overrides is
  'Per-AI-workload model/effort overrides keyed by workload id. Falls back to workload recommendations and org-wide defaults.';
