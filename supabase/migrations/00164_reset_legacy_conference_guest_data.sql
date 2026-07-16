-- ============================================================
-- MIGRATION 00164: Reset legacy conference guest data
--
-- The conference guest workflow was fundamentally redesigned in Sprint 18.
-- Existing tokens, invite logs and attendance submissions belong to the old
-- workflow and must not appear in the redesigned experience.
--
-- This is an intentional, irreversible one-time data reset. It removes every
-- previous guest invitation and response regardless of delivery/review status:
-- queued, sent, failed, pending, approved, rejected, granted or declined.
--
-- Preserved deliberately:
--   - CRM contacts and general CRM history
--   - conference catalogue rows
--   - conference tracking stages
--   - shared conference_prep operating records
--   - the congress-guest-uploads storage bucket
--
-- Those records may contain legitimate non-guest work and cannot be identified
-- safely as legacy-only. The guest tables are retained empty for the redesigned
-- workflow. Guest file database records are removed here; the managed Supabase
-- storage schema is not modified directly from SQL migrations.
-- ============================================================

do $$
declare
  v_invites integer := 0;
  v_access_requests integer := 0;
  v_files integer := 0;
  v_notes integer := 0;
  v_submissions integer := 0;
  v_tokens integer := 0;
begin
  -- Invite logs use ON DELETE SET NULL for token_id so the audit row normally
  -- survives token cleanup. Delete them explicitly for the requested reset.
  delete from public.conference_guest_invites;
  get diagnostics v_invites = row_count;

  -- Delete child records explicitly for clarity and deterministic reset counts.
  -- The foreign keys would otherwise remove most of these when tokens are
  -- deleted, but access requests can also retain a nullable submission link.
  delete from public.conference_guest_access_requests;
  get diagnostics v_access_requests = row_count;

  delete from public.conference_guest_files;
  get diagnostics v_files = row_count;

  delete from public.conference_guest_notes;
  get diagnostics v_notes = row_count;

  delete from public.conference_guest_submissions;
  get diagnostics v_submissions = row_count;

  delete from public.conference_guest_tokens;
  get diagnostics v_tokens = row_count;

  raise notice 'Conference guest reset complete: % invite logs, % access requests, % files, % notes, % submissions, % tokens removed.',
    v_invites,
    v_access_requests,
    v_files,
    v_notes,
    v_submissions,
    v_tokens;
end;
$$;

notify pgrst, 'reload schema';
