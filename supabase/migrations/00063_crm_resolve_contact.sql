-- ============================================================
-- MIGRATION 00063: crm_resolve_contact() find-or-create RPC
--   (Sprint 13 · S13-T02)
--
-- The single entry point for creating/linking a contact from ANY source
-- (manual CRM add, campus import, profile creation, onboarding registration).
-- Resolves on normalized email; never mints a duplicate or a separate campus
-- identity; never sets a "pending" kind.
--
-- Behaviour:
--   * Match an existing contact by profile_id, else by normalized_email.
--   * If a profile_id is supplied (promotion to platform user), the matched
--     contact is linked and flipped to internal_user / active.
--   * Otherwise a new row defaults to internal_contact for I2L emails, else
--     external, with platform_status = 'none'.
--
-- Security: SECURITY DEFINER, used only by the profile/onboarding/contact
-- triggers (which run as the table owner). Execute is REVOKED from public and
-- NOT granted to `authenticated` — so it cannot be invoked as an RPC by ordinary
-- users, and it does not interfere when a regular user updates their own profile
-- (the trigger that calls it runs in their session). Server actions write to
-- comms_crm_contacts directly under the comms-only RLS policy instead.
-- ============================================================

create or replace function public.crm_resolve_contact(
  p_email text,
  p_full_name text default null,
  p_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_contact_id uuid;
  v_kind text;
begin
  if v_norm_email is null and p_profile_id is null then
    raise exception 'crm_resolve_contact requires an email or a profile id';
  end if;

  -- 1) Find by profile, then by normalized email.
  if p_profile_id is not null then
    select id into v_contact_id
    from public.comms_crm_contacts
    where profile_id = p_profile_id
    limit 1;
  end if;

  if v_contact_id is null and v_norm_email is not null then
    select id into v_contact_id
    from public.comms_crm_contacts
    where normalized_email = v_norm_email
    order by (profile_id is not null) desc, created_at asc
    limit 1;
  end if;

  -- 2) Update the matched spine, or create a new one.
  if v_contact_id is not null then
    update public.comms_crm_contacts
    set
      email = coalesce(email, p_email),
      full_name = case
        when (full_name is null or full_name = '') and p_full_name is not null then p_full_name
        else full_name
      end,
      profile_id = coalesce(p_profile_id, profile_id),
      contact_kind = case when coalesce(p_profile_id, profile_id) is not null
                          then 'internal_user' else contact_kind end,
      platform_status = case when coalesce(p_profile_id, profile_id) is not null and platform_status = 'none'
                             then 'active' else platform_status end,
      updated_at = now()
    where id = v_contact_id;
    return v_contact_id;
  end if;

  v_kind := case
    when p_profile_id is not null then 'internal_user'
    when v_norm_email like '%@inspire2live.org' then 'internal_contact'
    else 'external'
  end;

  insert into public.comms_crm_contacts (
    full_name, email, segment, source_type, contact_kind, profile_id,
    platform_status, lifecycle_stage, consent_status
  )
  values (
    coalesce(nullif(p_full_name, ''), p_email, 'Unnamed contact'),
    p_email,
    case when v_kind = 'external' then 'external' else 'internal' end,
    case when p_profile_id is not null then 'profile' else 'manual' end,
    v_kind,
    p_profile_id,
    case when p_profile_id is not null then 'active' else 'none' end,
    'nurture',
    'unknown'
  )
  returning id into v_contact_id;

  return v_contact_id;
end;
$$;

-- Not callable as an RPC by ordinary users — only by the triggers (owner) and
-- the service role.
revoke all on function public.crm_resolve_contact(text, text, uuid) from public;
revoke all on function public.crm_resolve_contact(text, text, uuid) from authenticated;
grant execute on function public.crm_resolve_contact(text, text, uuid) to service_role;

notify pgrst, 'reload schema';
