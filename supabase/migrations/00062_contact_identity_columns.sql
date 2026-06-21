-- ============================================================
-- MIGRATION 00062: Contact identity model — columns + derived sync
--   (Sprint 13 · S13-T01)
--
-- Turns `comms_crm_contacts` into the canonical "contact spine":
--   * contact_kind        — internal_user / internal_contact / external
--                           (replaces the binary segment; segment is kept as a
--                            DERIVED back-compat column). No `internal_pending`.
--   * platform_status     — none / invited / active / inactive. "Pending" lives
--                           here (= 'invited'), never as a kind.
--   * profile_id          — link to the platform user (category A).
--   * member_onboarding_id — link to the onboarding checklist.
--   * normalized_email    — lower(trim(email)); the identity match key.
--   * intended_role       — OPTIONAL planning hint: the platform role ("user
--                           type") to assign if/when this contact is invited.
--   * whatsapp_id / welcomed_by_peter — World Campus channel attributes folded
--                           onto the contact (campus members are NOT a separate
--                           identity; there is no campus_member_id link).
--
-- A BEFORE INSERT/UPDATE trigger keeps `normalized_email` and the derived
-- `segment` in sync and defaults `contact_kind` when not supplied.
--
-- The partial unique index on normalized_email is created in the backfill
-- migration (00064), AFTER existing duplicates are collapsed.
-- ============================================================

alter table public.comms_crm_contacts
  add column if not exists contact_kind text,
  add column if not exists platform_status text not null default 'none',
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists member_onboarding_id uuid references public.member_onboarding(id) on delete set null,
  add column if not exists normalized_email text,
  add column if not exists intended_role text,
  add column if not exists whatsapp_id text,
  add column if not exists welcomed_by_peter boolean not null default false;

-- ── Constraints ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comms_crm_contacts_contact_kind_check') then
    alter table public.comms_crm_contacts
      add constraint comms_crm_contacts_contact_kind_check
      check (contact_kind is null or contact_kind in ('internal_user', 'internal_contact', 'external'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comms_crm_contacts_platform_status_check') then
    alter table public.comms_crm_contacts
      add constraint comms_crm_contacts_platform_status_check
      check (platform_status in ('none', 'invited', 'active', 'inactive'));
  end if;
end $$;

create index if not exists idx_comms_crm_contacts_contact_kind
  on public.comms_crm_contacts(contact_kind);
create index if not exists idx_comms_crm_contacts_profile
  on public.comms_crm_contacts(profile_id) where profile_id is not null;
create index if not exists idx_comms_crm_contacts_normalized_email
  on public.comms_crm_contacts(normalized_email) where normalized_email is not null;

-- ── Derived-sync trigger ─────────────────────────────────────────────────────
-- Keeps normalized_email + segment consistent and defaults contact_kind. The
-- caller's explicit contact_kind always wins; only NULL is auto-derived.
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

drop trigger if exists comms_crm_contacts_sync_derived on public.comms_crm_contacts;
create trigger comms_crm_contacts_sync_derived
  before insert or update on public.comms_crm_contacts
  for each row execute function public.crm_contacts_sync_derived();

-- ── Backfill derived fields for existing rows ───────────────────────────────
-- Link profile-sourced rows to their profile.
update public.comms_crm_contacts c
set profile_id = c.source_id
where c.source_type = 'profile'
  and c.source_id is not null
  and c.profile_id is null
  and exists (select 1 from public.profiles p where p.id = c.source_id);

-- Classify existing rows (trigger fills normalized_email + segment on write).
update public.comms_crm_contacts
set contact_kind = case
    when profile_id is not null then 'internal_user'
    when source_type = 'campus_member' then 'internal_contact'
    when lower(trim(coalesce(email, ''))) like '%@inspire2live.org' then 'internal_contact'
    when segment = 'internal' then 'internal_contact'
    else 'external'
  end
where contact_kind is null;

-- Mirror account state from the linked profile.
update public.comms_crm_contacts c
set platform_status = case when p.status = 'inactive' then 'inactive' else 'active' end
from public.profiles p
where c.profile_id = p.id;

notify pgrst, 'reload schema';
