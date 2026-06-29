-- ============================================================
-- MIGRATION 00104: AI-generated campus session briefing
-- ============================================================
-- Stores an educational pre-meeting briefing about the presenter and the topic
-- of a campus session. Generated on demand (never automatically) via a "Generate
-- briefing" action; regeneration is restricted to admins in the application layer.

alter table public.campus_sessions
  add column if not exists briefing jsonb,
  add column if not exists briefing_presenter text,
  add column if not exists briefing_topic text,
  add column if not exists briefing_generated_at timestamptz,
  add column if not exists briefing_generated_by uuid references public.profiles(id);

notify pgrst, 'reload schema';
