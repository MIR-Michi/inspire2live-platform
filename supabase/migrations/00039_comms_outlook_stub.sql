-- ============================================================
-- MIGRATION 00039: Add Outlook integration target
-- ============================================================

alter table public.comms_integration_intents
  drop constraint if exists comms_integration_intents_integration_target_check;

alter table public.comms_integration_intents
  add constraint comms_integration_intents_integration_target_check
  check (
    integration_target in (
      'wordpress',
      'linkedin',
      'mailchimp',
      'outlook',
      'sharepoint',
      'teams'
    )
  );

notify pgrst, 'reload schema';
