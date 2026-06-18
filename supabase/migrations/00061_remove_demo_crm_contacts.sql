-- ============================================================
-- MIGRATION 00061: Remove demo World Campus CRM contacts
--
-- The CRM directory's "External" contacts are seeded demo people
-- from supabase/demo/world-campus-whatsapp-seed.sql (campus_members):
-- Monica Kleijn Evason, Atefeh, Ifeoma, Ieva, Peter Kapitein and
-- MARTI CONNECTING AFRICA. None are real — remove them from the
-- platform. No table references campus_members by id (only indexes),
-- so a direct delete is safe.
--
-- Also clears any matching rows that were promoted into the
-- comms_crm_* tables (children first), in case the same people exist
-- there. Everything is guarded with to_regclass and runs in one
-- transaction, so it is safe across environments.
-- ============================================================

do $$
declare
  demo_names text[] := array[
    'Monica Kleijn Evason',
    'Atefeh',
    'Ifeoma',
    'Ieva',
    'Peter Kapitein',
    'MARTI CONNECTING AFRICA'
  ];
begin
  -- Source records shown as External contacts in the CRM directory.
  if to_regclass('public.campus_members') is not null then
    delete from public.campus_members where name = any(demo_names);
  end if;

  -- Defensive: clear the same people from the dedicated CRM tables,
  -- children before parents to respect foreign keys.
  if to_regclass('public.comms_crm_contacts') is not null then
    if to_regclass('public.comms_crm_interactions') is not null then
      delete from public.comms_crm_interactions
      where contact_id in (select id from public.comms_crm_contacts where full_name = any(demo_names));
    end if;
    if to_regclass('public.comms_crm_contact_initiatives') is not null then
      delete from public.comms_crm_contact_initiatives
      where contact_id in (select id from public.comms_crm_contacts where full_name = any(demo_names));
    end if;
    if to_regclass('public.comms_crm_contact_events') is not null then
      delete from public.comms_crm_contact_events
      where contact_id in (select id from public.comms_crm_contacts where full_name = any(demo_names));
    end if;
    delete from public.comms_crm_contacts where full_name = any(demo_names);
  end if;
end $$;

notify pgrst, 'reload schema';
