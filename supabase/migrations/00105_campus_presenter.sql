-- ============================================================
-- MIGRATION 00105: Campus session presenter (highlight of the month)
-- ============================================================
-- The "Highlight of the month" block introduces the meeting's presenter with a
-- photo and an optional LinkedIn link, alongside the highlight text (stored in
-- the existing campus_sessions.summary column).

alter table public.campus_sessions
  add column if not exists presenter_name text,
  add column if not exists presenter_avatar_url text,
  add column if not exists presenter_linkedin_url text;

notify pgrst, 'reload schema';
