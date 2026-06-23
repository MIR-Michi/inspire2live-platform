-- ============================================================
-- MIGRATION 00069: Full new-member ↔ CRM synchronisation
--
--   Closes the gap that let a new member exist on the comms dashboard
--   but NOT in the CRM directory. Migration 00065 linked an onboarding
--   record to a CRM contact ONLY when it carried an email (via
--   crm_resolve_contact, which requires an email or a profile). Members
--   registered name-only (the @inspire2live.org mailbox not provisioned
--   yet) therefore appeared on the dashboard but were invisible in the
--   CRM — the two lists drifted apart.
--
--   Now EVERY onboarding record materialises a 1:1 CRM contact:
--     * with an email or profile → resolve onto the spine (unchanged);
--     * name-only → create a dedicated internal_contact linked back via
--       member_onboarding_id, so it shows up in the directory and can be
--       enriched / invited later without minting a duplicate.
--
--   Deletion stays symmetric: deleting the CRM contact already cascades
--   to member_onboarding (server action); deleting the onboarding record
--   now cascades to its name-only CRM contact via this trigger's partner
--   delete trigger below.
-- ============================================================

-- ── onboarding INSERT → always materialise a linked contact ─────────────────
create or replace function public.handle_member_onboarding_contact_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_has_email boolean := new.email is not null and trim(new.email) <> '';
begin
  -- With an email (or an existing profile), resolve/link onto the canonical
  -- spine — never minting a duplicate or a separate campus identity.
  if v_has_email or new.profile_id is not null then
    v_contact_id := public.crm_resolve_contact(new.email, new.full_name, new.profile_id);

    update public.comms_crm_contacts
    set member_onboarding_id = new.id
    where id = v_contact_id
      and member_onboarding_id is null;

    return new;
  end if;

  -- Name-only member: still create a CRM contact so the directory and the
  -- dashboard stay in lock-step. Skip if one is somehow already linked.
  if exists (
    select 1 from public.comms_crm_contacts where member_onboarding_id = new.id
  ) then
    return new;
  end if;

  insert into public.comms_crm_contacts (
    full_name, segment, source_type, contact_kind, platform_status,
    lifecycle_stage, consent_status, member_onboarding_id, source_label
  )
  values (
    coalesce(nullif(new.full_name, ''), 'New member'),
    'internal', 'manual', 'internal_contact', 'none',
    'nurture', 'unknown', new.id, 'New member onboarding'
  );

  return new;
end;
$$;

-- ── onboarding DELETE → remove its name-only CRM contact ────────────────────
-- Symmetric with deleteCrmContact (which cascades CRM → onboarding). Only ever
-- removes a non-platform contact: a profile-linked contact belongs to a real
-- user and must survive (its onboarding row is just the checklist).
create or replace function public.handle_member_onboarding_contact_unlink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.comms_crm_contacts
  where member_onboarding_id = old.id
    and profile_id is null;
  return old;
end;
$$;

drop trigger if exists on_member_onboarding_contact_unlink on public.member_onboarding;
create trigger on_member_onboarding_contact_unlink
  after delete on public.member_onboarding
  for each row execute function public.handle_member_onboarding_contact_unlink();

-- Backfill: materialise contacts for existing onboarding records that have none
-- (e.g. name-only members registered before this migration).
insert into public.comms_crm_contacts (
  full_name, segment, source_type, contact_kind, platform_status,
  lifecycle_stage, consent_status, member_onboarding_id, source_label
)
select
  coalesce(nullif(mo.full_name, ''), 'New member'),
  'internal', 'manual', 'internal_contact', 'none',
  'nurture', 'unknown', mo.id, 'New member onboarding'
from public.member_onboarding mo
where mo.profile_id is null
  and (mo.email is null or trim(mo.email) = '')
  and not exists (
    select 1 from public.comms_crm_contacts c where c.member_onboarding_id = mo.id
  );

notify pgrst, 'reload schema';
