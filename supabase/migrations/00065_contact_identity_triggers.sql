-- ============================================================
-- MIGRATION 00065: Contact identity triggers
--   (Sprint 13 · S13-T04)
--
-- Wires the canonical spine to its sources so promotion is a LINK, never a
-- duplicate:
--
--   * profiles INSERT/UPDATE → resolve onto the existing spine by email,
--     set profile_id, flip to internal_user, and mirror account state into
--     platform_status (invited while onboarding incomplete, active once done,
--     inactive when deactivated).
--   * member_onboarding INSERT → resolve/link a contact (internal_contact when
--     there's no profile yet) and record member_onboarding_id. Onboarding/CRM
--     data entry NEVER produces a pending or internal_user contact on its own.
-- ============================================================

-- ── profiles ↔ contact spine ────────────────────────────────────────────────
create or replace function public.handle_profile_contact_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  -- Industry partners are managed via the partners surface, not the comms CRM
  -- directory (which excludes them) — don't materialise a spine row for them.
  if new.email is null or new.role = 'IndustryPartner' then
    return new;
  end if;

  v_contact_id := public.crm_resolve_contact(new.email, new.name, new.id);

  update public.comms_crm_contacts
  set platform_status = case
      when new.status = 'inactive' then 'inactive'
      when coalesce(new.onboarding_completed, false) then 'active'
      else 'invited'   -- profile exists but not yet onboarded = "pending"
    end
  where id = v_contact_id;

  return new;
end;
$$;

drop trigger if exists on_profile_contact_sync on public.profiles;
create trigger on_profile_contact_sync
  after insert or update of email, name, status, onboarding_completed
  on public.profiles
  for each row execute function public.handle_profile_contact_sync();

-- ── member_onboarding ↔ contact spine ───────────────────────────────────────
create or replace function public.handle_member_onboarding_contact_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  if new.email is null or trim(new.email) = '' then
    return new;
  end if;

  -- Resolves to the existing spine (or creates an internal_contact). Passing the
  -- profile_id (which may be null) keeps internal_user when one is already set.
  v_contact_id := public.crm_resolve_contact(new.email, new.full_name, new.profile_id);

  update public.comms_crm_contacts
  set member_onboarding_id = new.id
  where id = v_contact_id
    and member_onboarding_id is null;

  return new;
end;
$$;

drop trigger if exists on_member_onboarding_contact_link on public.member_onboarding;
create trigger on_member_onboarding_contact_link
  after insert on public.member_onboarding
  for each row execute function public.handle_member_onboarding_contact_link();

notify pgrst, 'reload schema';
