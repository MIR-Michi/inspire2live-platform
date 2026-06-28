-- ============================================================
-- MIGRATION 00101: CRM campus-member flag, contact footprint fields, links
--
-- Reworks the CRM contact spine to support the Inspire2Live community import:
--
--   1. is_campus_member — an EXPLICIT, first-class affiliation flag. Many I2L
--      contacts use non-@inspire2live.org emails but are still active for I2L;
--      classification used to key off the email domain alone, so they were
--      mis-filed as `external`. This flag decouples "active for I2L" from the
--      email domain: the derived-sync trigger now treats a campus member as an
--      `internal_contact` regardless of email. Campus membership is defined
--      from scratch by the import (00102) — it is NOT backfilled from the legacy
--      campus_members roster.
--
--   2. linkedin_url / organisation_url / continent — public-footprint + geo
--      fields the directory now carries directly.
--
--   3. comms_crm_contact_links — a structured table for a contact's public
--      footprint (publications, talks, media, profiles). One row per item so the
--      list is queryable instead of stuffed into free text.
--
-- Access mirrors the rest of the CRM: comms team / admin (is_comms_team_or_admin).
-- ============================================================

-- ── 1. New contact columns ──────────────────────────────────
alter table public.comms_crm_contacts
  add column if not exists is_campus_member boolean not null default false,
  add column if not exists linkedin_url text,
  add column if not exists organisation_url text,
  add column if not exists continent text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comms_crm_contacts_continent_check') then
    alter table public.comms_crm_contacts
      add constraint comms_crm_contacts_continent_check
      check (
        continent is null
        or continent in ('Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania', 'Antarctica')
      );
  end if;
end $$;

create index if not exists idx_comms_crm_contacts_campus_member
  on public.comms_crm_contacts(is_campus_member) where is_campus_member;
create index if not exists idx_comms_crm_contacts_continent
  on public.comms_crm_contacts(continent) where continent is not null;

-- ── 2. Contact links (public footprint) ─────────────────────
create table if not exists public.comms_crm_contact_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.comms_crm_contacts(id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('publication', 'talk', 'media', 'profile', 'linkedin', 'other')),
  label text not null,
  url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_crm_contact_links_contact
  on public.comms_crm_contact_links(contact_id, kind, position);

-- Lets the import (and future syncs) upsert a contact's footprint idempotently.
create unique index if not exists idx_comms_crm_contact_links_unique
  on public.comms_crm_contact_links(contact_id, kind, coalesce(url, label));

alter table public.comms_crm_contact_links enable row level security;

drop policy if exists comms_crm_contact_links_comms_access on public.comms_crm_contact_links;
create policy comms_crm_contact_links_comms_access on public.comms_crm_contact_links
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── 3. Derived-sync trigger: campus members are internal contacts ───────────
-- Extends 00062's function with an is_campus_member branch so an I2L community
-- member with a non-i2l email resolves to internal_contact (not external). The
-- caller's explicit contact_kind still wins; only NULL is auto-derived.
create or replace function public.crm_contacts_sync_derived()
returns trigger as $$
begin
  new.normalized_email := nullif(lower(trim(coalesce(new.email, ''))), '');

  if new.contact_kind is null then
    if new.profile_id is not null then
      new.contact_kind := 'internal_user';
    elsif new.is_campus_member then
      new.contact_kind := 'internal_contact';
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

notify pgrst, 'reload schema';
