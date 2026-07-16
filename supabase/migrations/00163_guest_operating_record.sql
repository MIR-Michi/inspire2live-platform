-- ============================================================
-- MIGRATION 00163: Guest writes into the shared operating record
--
-- Sprint 18 (T08/T10). Previously a guest's contributions lived only in
-- their own submission's files/notes and were shown to the team as a
-- separate read-only "guest reports" block beside the operating page —
-- two pictures of one conference.
--
-- This adds a single, strictly-scoped SECURITY DEFINER RPC that lets a
-- valid magic-link guest write the shared on-site fields directly into
-- `conference_prep` (the team's operating record) for a conference their
-- token is actually linked to. The team and the guest now co-edit one
-- record; the per-guest submission/notes/files remain as the contribution
-- trail (and the intake/link event).
--
-- Guests may only touch guest-owned columns (photo_urls, takeaways,
-- has_presentation, deck_url) — never comms ownership or pipeline internals
-- — and only for a conference_id that appears on one of their submissions.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.guest_contribute_to_prep(
  p_raw_token        text,
  p_conference_id    uuid,
  p_takeaways        text default null,
  p_photo_url        text default null,
  p_deck_url         text default null,
  p_has_presentation boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash     text;
  v_token_id uuid;
begin
  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select id into v_token_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  -- Scope: the token must have reported attendance for this exact conference.
  if not exists (
    select 1 from public.conference_guest_submissions
    where token_id = v_token_id
      and conference_id = p_conference_id
  ) then
    raise exception 'conference_not_linked';
  end if;

  -- Create the operating record lazily, then merge only guest-owned fields.
  insert into public.conference_prep (conference_id)
  values (p_conference_id)
  on conflict (conference_id) do nothing;

  update public.conference_prep
  set
    -- Append the photo (dedup) so team + guest photos accumulate in one place.
    photo_urls = case
      when p_photo_url is null or p_photo_url = '' then photo_urls
      when photo_urls @> array[p_photo_url] then photo_urls
      else array_append(photo_urls, p_photo_url)
    end,
    -- Guests own the on-site takeaways summary; only overwrite when provided.
    takeaways = coalesce(nullif(p_takeaways, ''), takeaways),
    deck_url = coalesce(nullif(p_deck_url, ''), deck_url),
    has_presentation = coalesce(p_has_presentation, has_presentation),
    updated_at = now()
  where conference_id = p_conference_id;
end;
$$;

grant execute on function public.guest_contribute_to_prep(text, uuid, text, text, text, boolean) to anon;
grant execute on function public.guest_contribute_to_prep(text, uuid, text, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
