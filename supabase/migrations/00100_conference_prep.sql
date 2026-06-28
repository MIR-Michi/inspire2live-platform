-- ============================================================
-- MIGRATION 00100: CONFERENCE PREP (the "speaking" operating space)
--
-- Once a conference is moved to the "registered" stage in the visit
-- pipeline (conference_tracking.stage), the comms team prepares and runs
-- the actual speaking engagement: the presentation (abstract + title +
-- deck), the people to connect with, photos captured on-site, and the
-- amplification afterwards (LinkedIn / website / WhatsApp / newsletter),
-- plus repurpose ideas (podcast / World Campus).
--
-- This lives in a 1:1 companion table to conferences. The pipeline stage
-- stays the single source of truth in conference_tracking — this table
-- only holds the work product for each stage. A row is created lazily the
-- first time prep is saved.
--
-- Access mirrors the rest of the Conferences space: comms team / admin
-- (is_comms_team_or_admin); the column FKs use set null so deleting a
-- linked podcast event or campus session never orphans the prep row.
-- ============================================================

create table if not exists public.conference_prep (
  conference_id        uuid        primary key references public.conferences(id) on delete cascade,

  -- ── Registered: the presentation ──────────────────────────
  -- null = "not decided yet", true = presenting, false = attending only.
  has_presentation     boolean,
  presentation_title   text,
  abstract             text,
  deck_url             text,
  -- Free-form supporting links (runbook, notes, handout).
  asset_urls           text[]      not null default '{}',
  -- People to connect with about the presentation:
  -- [{ "name": "...", "org": "...", "topic": "...", "connected": false }]
  key_people           jsonb       not null default '[]',
  -- Comms-team accountability for this engagement.
  comms_owner_id       uuid        references public.profiles(id) on delete set null,
  comms_contributor_id uuid        references public.profiles(id) on delete set null,
  -- Registered checklist.
  abstract_submitted   boolean     not null default false,
  deck_drafted         boolean     not null default false,
  deck_final           boolean     not null default false,

  -- ── Ongoing: on-site ──────────────────────────────────────
  photo_urls           text[]      not null default '{}',
  takeaways            text,
  delivered            boolean     not null default false,

  -- ── Follow-up: amplify ────────────────────────────────────
  output_report        boolean     not null default false,
  output_linkedin      boolean     not null default false,
  output_website       boolean     not null default false,
  output_whatsapp      boolean     not null default false,
  output_newsletter    boolean     not null default false,
  followup_notes       text,
  -- Repurpose ideas, optionally linked to the destinations that already
  -- own those workflows.
  podcast_idea         boolean     not null default false,
  podcast_event_id     uuid        references public.events(id) on delete set null,
  campus_idea          boolean     not null default false,
  campus_session_id    uuid        references public.campus_sessions(id) on delete set null,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.conference_prep is 'Per-conference speaking engagement work product (presentation, people, photos, amplification). 1:1 with conferences; the pipeline stage lives in conference_tracking.';

alter table public.conference_prep enable row level security;

drop policy if exists conference_prep_comms_access on public.conference_prep;
create policy conference_prep_comms_access on public.conference_prep
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists conference_prep_set_updated_at on public.conference_prep;
create trigger conference_prep_set_updated_at
  before update on public.conference_prep
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
