-- ============================================================
-- MIGRATION 00064: Contact identity backfill + dedup + unique key
--   (Sprint 13 · S13-T03)
--
-- 1. Collapses any existing comms_crm_contacts rows that share a normalized
--    email into a single canonical spine (keeping the profile-linked / oldest
--    row), repointing children with conflict avoidance.
-- 2. Links contacts to their onboarding record by profile.
-- 3. Adds the partial unique index on normalized_email (only safe AFTER dedup).
--
-- Dry-run report (run before applying in a populated environment):
--   select normalized_email, count(*)
--   from public.comms_crm_contacts
--   where normalized_email is not null
--   group by normalized_email having count(*) > 1;
-- ============================================================

do $$
declare
  grp record;
  keeper uuid;
  dup uuid;
begin
  for grp in
    select normalized_email
    from public.comms_crm_contacts
    where normalized_email is not null
    group by normalized_email
    having count(*) > 1
  loop
    -- Prefer the profile-linked row, then the earliest created.
    select id into keeper
    from public.comms_crm_contacts
    where normalized_email = grp.normalized_email
    order by (profile_id is not null) desc, created_at asc
    limit 1;

    for dup in
      select id from public.comms_crm_contacts
      where normalized_email = grp.normalized_email and id <> keeper
    loop
      -- Associated initiatives (PK contact_id, initiative_id)
      update public.comms_crm_contact_initiatives ci set contact_id = keeper
        where ci.contact_id = dup
          and not exists (
            select 1 from public.comms_crm_contact_initiatives k
            where k.contact_id = keeper and k.initiative_id = ci.initiative_id);
      delete from public.comms_crm_contact_initiatives where contact_id = dup;

      -- Associated events (PK contact_id, event_id, relationship_type)
      update public.comms_crm_contact_events ce set contact_id = keeper
        where ce.contact_id = dup
          and not exists (
            select 1 from public.comms_crm_contact_events k
            where k.contact_id = keeper and k.event_id = ce.event_id
              and k.relationship_type = ce.relationship_type);
      delete from public.comms_crm_contact_events where contact_id = dup;

      -- Interactions (no extra unique constraint)
      update public.comms_crm_interactions set contact_id = keeper where contact_id = dup;

      -- Pipeline memberships (unique stage_id, contact_id)
      update public.comms_crm_pipeline_members pm set contact_id = keeper
        where pm.contact_id = dup
          and not exists (
            select 1 from public.comms_crm_pipeline_members k
            where k.stage_id = pm.stage_id and k.contact_id = keeper);
      delete from public.comms_crm_pipeline_members where contact_id = dup;

      -- Fold useful identity fields onto the keeper where it has gaps.
      update public.comms_crm_contacts keep
      set
        profile_id   = coalesce(keep.profile_id, d.profile_id),
        bio          = coalesce(keep.bio, d.bio),
        title        = coalesce(keep.title, d.title),
        organisation = coalesce(keep.organisation, d.organisation),
        phone        = coalesce(keep.phone, d.phone),
        whatsapp_id  = coalesce(keep.whatsapp_id, d.whatsapp_id),
        notes        = coalesce(keep.notes, d.notes)
      from public.comms_crm_contacts d
      where keep.id = keeper and d.id = dup;

      delete from public.comms_crm_contacts where id = dup;
    end loop;
  end loop;
end $$;

-- Link contacts to their onboarding record by shared profile.
update public.comms_crm_contacts c
set member_onboarding_id = mo.id
from public.member_onboarding mo
where mo.profile_id = c.profile_id
  and c.profile_id is not null
  and c.member_onboarding_id is null;

-- Now that emails are unique, enforce it as the identity match key.
create unique index if not exists uq_comms_crm_contacts_normalized_email
  on public.comms_crm_contacts (normalized_email)
  where normalized_email is not null;

notify pgrst, 'reload schema';
