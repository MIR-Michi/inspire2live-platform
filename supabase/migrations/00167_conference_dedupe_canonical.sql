-- ============================================================
-- MIGRATION 00167: Canonical conference de-duplication
--
-- The conference master list accumulated duplicates because three insert
-- paths each computed a *different* dedupe key for the same event:
--   • AI discovery      → slug(name):YYYY-MM   (month-precise; title-sensitive)
--   • guest resolution  → 'guest-'||slug||'-'||YYYY-MM   (00112)
--   • seed / manual     → hand-written keys    (00087)
-- so "ESMO Congress 2026" (AI) and "ESMO Congress" (guest, dated one month
-- off) landed as two rows.
--
-- This migration makes de-duplication source-agnostic and permanent:
--   1. one canonical key function — normalise the name (drop the trailing
--      year, ordinal edition markers, and low-signal stopwords) and key on the
--      conference YEAR, so month drift and title variants no longer split;
--   2. backfill every row to that key and MERGE the resulting duplicates,
--      re-pointing all dependent rows onto a single survivor;
--   3. a unique index + a BEFORE INSERT/UPDATE trigger so the database itself
--      computes the key for every future insert — AI, guest, or manual — and
--      rejects duplicates. The application key (conferences.ts) matches.
-- ============================================================

-- ── 1. Canonical key function (mirrors conferenceDedupeKey in conferences.ts) ──

create or replace function public.conference_canonical_key(p_name text, p_start date)
returns text
language plpgsql
stable
as $$
declare
  v text;
begin
  v := lower(coalesce(p_name, ''));
  v := regexp_replace(v, '[^a-z0-9]+', ' ', 'g');            -- punctuation → space
  v := regexp_replace(v, '\y(19|20)[0-9]{2}\y', ' ', 'g');   -- drop 4-digit years
  v := regexp_replace(v, '\y[0-9]+(st|nd|rd|th)\y', ' ', 'g'); -- drop ordinals (24th…)
  v := regexp_replace(v, '\y(the|a|an|annual|edition)\y', ' ', 'g'); -- stopwords
  v := regexp_replace(v, '\s+', '-', 'g');                   -- spaces → dashes
  v := regexp_replace(v, '-{2,}', '-', 'g');
  v := btrim(v, '-');
  if v is null or v = '' then
    v := 'conference';
  end if;
  return left(v || ':' || coalesce(to_char(p_start, 'YYYY'), 'tbd'), 200);
end;
$$;

comment on function public.conference_canonical_key(text, date) is
  'Source-agnostic conference dedupe key: normalised name (year/ordinals/stopwords stripped) + conference year. Mirrors conferenceDedupeKey in src/modules/ai-features/domain/conferences.ts.';

-- ── 2. Backfill + merge existing duplicates ───────────────────────────────────

-- The unique index must be dropped before the backfill can create transient
-- duplicate keys; it is recreated in step 3 after the merge.
drop index if exists public.idx_conferences_dedupe_key;

update public.conferences
set dedupe_key = public.conference_canonical_key(name, start_date);

do $$
begin
  -- Pick one survivor per canonical key: prefer a row that is already tracked,
  -- then one with prep, then one with a website, then the oldest.
  create temporary table _conf_dupes as
  with ranked as (
    select
      c.id,
      first_value(c.id) over w as survivor_id,
      row_number() over w as rn
    from public.conferences c
    window w as (
      partition by c.dedupe_key
      order by
        (exists (select 1 from public.conference_tracking t where t.conference_id = c.id))::int desc,
        (exists (select 1 from public.conference_prep p where p.conference_id = c.id))::int desc,
        (c.website_url is not null)::int desc,
        c.discovered_at asc nulls last,
        c.id asc
    )
  )
  select id as loser_id, survivor_id
  from ranked
  where rn > 1;

  -- Re-point dependents with a unique-on-conference constraint. For each of
  -- these the survivor may hold at most one row, and several losers in a group
  -- may each hold one, so adopt exactly one into a survivor that lacks it (the
  -- richest/most-recent), then delete every remaining loser row.

  -- conference_tracking (PK = conference_id)
  with pick as (
    select distinct on (d.survivor_id) t.conference_id as from_id, d.survivor_id
    from _conf_dupes d
    join public.conference_tracking t on t.conference_id = d.loser_id
    where not exists (select 1 from public.conference_tracking s where s.conference_id = d.survivor_id)
    order by d.survivor_id, t.updated_at desc nulls last
  )
  update public.conference_tracking t set conference_id = p.survivor_id
  from pick p where t.conference_id = p.from_id;
  delete from public.conference_tracking t using _conf_dupes d where t.conference_id = d.loser_id;

  -- conference_prep (PK = conference_id)
  with pick as (
    select distinct on (d.survivor_id) p.conference_id as from_id, d.survivor_id
    from _conf_dupes d
    join public.conference_prep p on p.conference_id = d.loser_id
    where not exists (select 1 from public.conference_prep s where s.conference_id = d.survivor_id)
    order by d.survivor_id, p.updated_at desc nulls last
  )
  update public.conference_prep p set conference_id = pick.survivor_id
  from pick where p.conference_id = pick.from_id;
  delete from public.conference_prep p using _conf_dupes d where p.conference_id = d.loser_id;

  -- conference_contact_assignments (UNIQUE conference_id, contact_id)
  with pick as (
    select distinct on (d.survivor_id, a.contact_id) a.id as assignment_id, d.survivor_id
    from _conf_dupes d
    join public.conference_contact_assignments a on a.conference_id = d.loser_id
    where not exists (
      select 1 from public.conference_contact_assignments s
      where s.conference_id = d.survivor_id and s.contact_id = a.contact_id
    )
    order by d.survivor_id, a.contact_id, a.assigned_at desc nulls last
  )
  update public.conference_contact_assignments a set conference_id = p.survivor_id
  from pick p where a.id = p.assignment_id;
  delete from public.conference_contact_assignments a using _conf_dupes d where a.conference_id = d.loser_id;

  -- Re-point dependents with no unique-on-conference constraint outright.
  update public.comms_tasks t set conference_id = d.survivor_id
  from _conf_dupes d where t.conference_id = d.loser_id;
  update public.conference_guest_submissions s set conference_id = d.survivor_id
  from _conf_dupes d where s.conference_id = d.loser_id;
  update public.conference_guest_tokens t set conference_id = d.survivor_id
  from _conf_dupes d where t.conference_id = d.loser_id;
  update public.conference_guest_invites i set conference_id = d.survivor_id
  from _conf_dupes d where i.conference_id = d.loser_id;

  -- Remove the now-orphaned duplicate conferences.
  delete from public.conferences c using _conf_dupes d where c.id = d.loser_id;

  drop table _conf_dupes;
end;
$$;

-- ── 3. Enforce uniqueness + auto-key every future insert ──────────────────────

create unique index if not exists idx_conferences_dedupe_key
  on public.conferences(dedupe_key);

create or replace function public.set_conference_dedupe_key()
returns trigger
language plpgsql
as $$
begin
  new.dedupe_key := public.conference_canonical_key(new.name, new.start_date);
  return new;
end;
$$;

drop trigger if exists conferences_set_dedupe_key on public.conferences;
create trigger conferences_set_dedupe_key
  before insert or update of name, start_date on public.conferences
  for each row execute function public.set_conference_dedupe_key();

notify pgrst, 'reload schema';
