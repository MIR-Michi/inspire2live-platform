-- ============================================================
-- MIGRATION 00067: Inspire2Live email is always internal
--
-- Hardens the contact-spine invariant: a contact whose email is on the
-- @inspire2live.org domain is ALWAYS internal — an `internal_contact` who is not
-- (yet) a platform user and needs a separate invitation — and may NEVER be
-- classified as `external`.
--
-- Migration 00062 introduced `crm_contacts_sync_derived`, which only *defaulted*
-- contact_kind when NULL and otherwise let the caller's explicit value win. That
-- allowed an Inspire2Live email to be saved as `external` if the form/caller said
-- so. Here we add a hard guard that coerces such a row back to `internal_contact`
-- regardless of the supplied kind, so the rule holds for every write path
-- (server actions, RPCs, direct writes, backfills).
-- ============================================================

create or replace function public.crm_contacts_sync_derived()
returns trigger as $$
begin
  new.normalized_email := nullif(lower(trim(coalesce(new.email, ''))), '');

  if new.contact_kind is null then
    if new.profile_id is not null then
      new.contact_kind := 'internal_user';
    elsif new.source_type = 'campus_member' then
      new.contact_kind := 'internal_contact';
    elsif new.normalized_email like '%@inspire2live.org' then
      new.contact_kind := 'internal_contact';
    elsif new.segment = 'internal' then
      new.contact_kind := 'internal_contact';
    else
      new.contact_kind := 'external';
    end if;
  end if;

  -- Hard invariant: an Inspire2Live email is always internal, never external —
  -- even when an explicit contact_kind = 'external' was supplied. A profile link
  -- keeps internal_user; otherwise such a person is an internal_contact.
  if new.normalized_email like '%@inspire2live.org' and new.contact_kind = 'external' then
    new.contact_kind := 'internal_contact';
  end if;

  -- segment is fully derived from contact_kind.
  new.segment := case when new.contact_kind = 'external' then 'external' else 'internal' end;

  -- A contact linked to a live profile is, by definition, an active user unless
  -- explicitly marked invited/inactive.
  if new.profile_id is not null and new.contact_kind = 'internal_user'
     and new.platform_status = 'none' then
    new.platform_status := 'active';
  end if;

  return new;
end;
$$ language plpgsql;

-- Re-classify any existing rows that violate the invariant.
update public.comms_crm_contacts
set contact_kind = 'internal_contact'
where contact_kind = 'external'
  and normalized_email like '%@inspire2live.org';

notify pgrst, 'reload schema';
