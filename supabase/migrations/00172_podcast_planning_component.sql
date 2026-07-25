-- ============================================================
-- MIGRATION 00172: `podcast-planning` component — questions and the board
--
-- Sprint 20 / ADR-0013. The editorial half of the Podcast Opportunity Engine:
-- the questions the podcast is asking, one card per person per question moving
-- through six stages, versioned score snapshots, and every invitation sent.
--
-- Replaces the podcast Guests tab. Guest data is not deleted: the past guests
-- are imported into `network_people` (migration 00171) where they become the
-- strongest available introducers for the next question.
--
-- Deliberate: `podcast_question_candidates.person_id` carries NO foreign key.
-- People are owned by the `network` component and read through its
-- `network_people_public` view (ADR-0009 §9 rule 4, ADR-0013 §2).
--
-- Also deliberate: the Phase B tables from the concept (`podcast_signals`,
-- `podcast_topic_groups`, `podcast_episode_results`) are NOT created here. A
-- table with no reader is an orphan under ADR-0009 §10.
-- ============================================================

-- ─── The question ────────────────────────────────────────────────────────────
-- Three or four live at a time. A question survives any number of refusals,
-- which is exactly why it is not the card that moves.

create table if not exists public.podcast_questions (
  id                   uuid        primary key default gen_random_uuid(),
  -- One sentence someone could disagree with — not a subject area.
  question             text        not null,
  -- The reason it matters now: a publication, a ruling, a deadline, a public row.
  why_now              text,
  why_now_source_urls  text[]      not null default '{}',
  -- Anchors timeliness: the date the "why now" actually happened.
  why_now_at           date,
  -- A fixed date the question hangs off (a congress, a consultation deadline).
  anchor_date          date,
  -- How many independent sources are talking about it (concept §10, timeliness).
  independent_sources  int         not null default 0 check (independent_sources >= 0),
  -- What a listener should do afterwards. Required before any of this
  -- question's names may leave the wishlist (concept §2/§11).
  ask_type             text        check (ask_type in (
                         'join_initiative', 'register_congress', 'submit_story',
                         'join_hub', 'subscribe', 'policy_response')),
  ask_destination_url  text,
  -- Confirmed by a human that the destination exists and works. An ask pointing
  -- at a broken page wastes the entire episode.
  ask_verified_at      timestamptz,
  -- One of the six shapes (concept §9). Decides how many seats must be filled.
  format               text        check (format in (
                         'advocate_meets_expert', 'the_disagreement', 'how_it_works',
                         'hub_story', 'congress_episode', 'initiative_update')),
  topic_tags           text[]      not null default '{}',
  -- Mission inputs (concept §10). Kept on the question because they are
  -- properties of the question, not of the person.
  initiative_id        uuid        references public.initiatives(id) on delete set null,
  on_advocacy_agenda   boolean     not null default false,
  patient_relevance    text        not null default 'field'
    check (patient_relevance in ('patients', 'both', 'field')),
  -- Estimated pull of the question, judged against past content (0..7).
  question_pull        int         not null default 0 check (question_pull between 0 and 7),
  -- How that kind of ask has converted before (0..5).
  ask_conversion_prior int        not null default 0 check (ask_conversion_prior between 0 and 5),
  -- Who else will push it: hubs, partners, contributors (0..5).
  amplification        int         not null default 0 check (amplification between 0 and 5),
  owner_id             uuid        references public.profiles(id) on delete set null,
  status               text        not null default 'draft'
    check (status in ('draft', 'live', 'retired')),
  retired_reason       text,
  created_by           uuid        references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.podcast_questions is
  'Sprint 20 (podcast-planning): the thing the podcast is asking. Lives for months and survives refusals. Its listener action must be defined before any of its candidates may leave the wishlist.';

create index if not exists idx_podcast_questions_status on public.podcast_questions(status, updated_at desc);
create index if not exists idx_podcast_questions_owner on public.podcast_questions(owner_id);

-- ─── The card that moves ─────────────────────────────────────────────────────

create table if not exists public.podcast_question_candidates (
  id                  uuid        primary key default gen_random_uuid(),
  question_id         uuid        not null references public.podcast_questions(id) on delete cascade,
  -- Soft reference into the `network` component. NO foreign key on purpose:
  -- see the migration header and ADR-0013 §2. Resolved through
  -- public.network_people_public; writes go through network's domain actions.
  person_id           uuid        not null,
  -- What only this person can say. "Senior and works in this field" is not an
  -- angle and sends the card back to the wishlist.
  angle               text,
  stage               text        not null default 'wishlist'
    check (stage in ('wishlist', 'research', 'ask', 'planning', 'booked', 'recorded', 'not_now', 'closed')),
  stage_entered_at    timestamptz not null default now(),
  -- The name whose acceptance makes every other invitation easier. At most one
  -- per question (enforced by the partial unique index below).
  is_anchor           boolean     not null default false,
  route               text        check (route in (
                        'already_known', 'one_introduction', 'two_steps', 'cold_hook', 'press_office')),
  -- Research findings that feed the score (concept §7).
  recent_appearance   text        not null default 'none'
    check (recent_appearance in ('within_12_months', 'older', 'none')),
  good_moment         int         not null default 0 check (good_moment between 0 and 3),
  practicalities      int         not null default 0 check (practicalities between 0 and 3),
  prior_refusal       text        not null default 'none'
    check (prior_refusal in ('none', 'not_now', 'soft_no', 'firm_no')),
  prior_refusal_at    date,
  -- Reach inputs specific to this person on this question (0..8).
  guest_audience      int         not null default 0 check (guest_audience between 0 and 8),
  -- Latest computed values, denormalised from podcast_candidate_scores for
  -- sorting. The snapshot table stays the audit trail.
  chance_of_yes       int,
  score_total         int,
  scored_at           timestamptz,
  -- Not now: sleeps until this date, then reappears in Research.
  wake_date           date,
  closed_reason       text        check (closed_reason in (
                        'declined', 'no_reply', 'no_route', 'wrong_person', 'moment_passed')),
  closed_note         text,
  closed_at           timestamptz,
  -- The score never overrules a person — but the decision is recorded, not
  -- hidden, and reviewed later against outcomes (concept §10).
  override_by         uuid        references public.profiles(id) on delete set null,
  override_reason     text,
  override_at         timestamptz,
  -- Planning-stage facts.
  recording_date      date,
  consent_confirmed   boolean     not null default false,
  seats_filled        boolean     not null default false,
  will_share          boolean,
  -- Set when the card hands over to the content calendar at Recorded.
  content_calendar_id uuid        references public.content_calendar(id) on delete set null,
  created_by          uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.podcast_question_candidates is
  'Sprint 20 (podcast-planning): one card per person per question — the thing that moves through the six stages. person_id is a soft reference into the network component (no FK by design, ADR-0013 §2).';

create unique index if not exists uq_podcast_candidate_person_question
  on public.podcast_question_candidates(question_id, person_id);
create unique index if not exists uq_podcast_candidate_anchor
  on public.podcast_question_candidates(question_id) where is_anchor;
create index if not exists idx_podcast_candidates_stage
  on public.podcast_question_candidates(stage, stage_entered_at);
create index if not exists idx_podcast_candidates_person
  on public.podcast_question_candidates(person_id);
create index if not exists idx_podcast_candidates_wake
  on public.podcast_question_candidates(wake_date) where stage = 'not_now';

-- ─── Versioned score snapshots ───────────────────────────────────────────────
-- So a weight change stays auditable and a historical number stays reproducible.

create table if not exists public.podcast_candidate_scores (
  id              uuid        primary key default gen_random_uuid(),
  candidate_id    uuid        not null references public.podcast_question_candidates(id) on delete cascade,
  computed_at     timestamptz not null default now(),
  weights_version text        not null,
  chance_of_yes   int         not null,
  reach           int         not null,
  timeliness      int         not null,
  followup        int         not null,
  mission         int         not null,
  format_fit      int         not null,
  total           int         not null,
  -- The per-part breakdown and the strongest/weakest note. The breakdown is
  -- always shown, never just the number.
  explanation     jsonb       not null default '{}'::jsonb,
  computed_by     uuid        references auth.users(id) on delete set null
);

comment on table public.podcast_candidate_scores is
  'Sprint 20 (podcast-planning): versioned score snapshots. Scoring is plain arithmetic over stored fields, so every number on screen can be inspected and reproduced.';

create index if not exists idx_podcast_scores_candidate
  on public.podcast_candidate_scores(candidate_id, computed_at desc);

-- ─── Every attempt to reach one person for one question ──────────────────────

create table if not exists public.podcast_invitations (
  id                      uuid        primary key default gen_random_uuid(),
  candidate_id            uuid        not null references public.podcast_question_candidates(id) on delete cascade,
  kind                    text        not null check (kind in ('introduction', 'direct')),
  -- Soft reference to network_introduction_requests for the introduction kind
  -- (no cross-component FK, ADR-0013 §2).
  introduction_request_id uuid,
  sent_by                 uuid        references public.profiles(id) on delete set null,
  sent_at                 timestamptz not null default now(),
  -- The message as it went out, in the sender's own words. The platform
  -- composes a draft; the human sends it.
  message_text            text,
  nudged_at               timestamptz,
  response                text        check (response in ('yes', 'not_now', 'declined', 'no_reply')),
  responded_at            timestamptz,
  -- For 'not_now': when to come back.
  recall_date             date,
  notes                   text,
  created_at              timestamptz not null default now()
);

comment on table public.podcast_invitations is
  'Sprint 20 (podcast-planning): every attempt to reach one person for one question, with nudges and what came back. Refusals are the point — after twenty of them the routes that work become visible.';

create index if not exists idx_podcast_invitations_candidate
  on public.podcast_invitations(candidate_id, sent_at desc);
create index if not exists idx_podcast_invitations_open
  on public.podcast_invitations(sent_at) where response is null;

-- ─── updated_at triggers ─────────────────────────────────────────────────────

create or replace function public.podcast_planning_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_podcast_questions_touch on public.podcast_questions;
create trigger trg_podcast_questions_touch before update on public.podcast_questions
  for each row execute function public.podcast_planning_touch_updated_at();

drop trigger if exists trg_podcast_candidates_touch on public.podcast_question_candidates;
create trigger trg_podcast_candidates_touch before update on public.podcast_question_candidates
  for each row execute function public.podcast_planning_touch_updated_at();

-- ─── Row level security ──────────────────────────────────────────────────────
-- Mirrors the rest of the Comms space.

alter table public.podcast_questions           enable row level security;
alter table public.podcast_question_candidates enable row level security;
alter table public.podcast_candidate_scores    enable row level security;
alter table public.podcast_invitations         enable row level security;

drop policy if exists podcast_questions_comms on public.podcast_questions;
create policy podcast_questions_comms on public.podcast_questions
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists podcast_candidates_comms on public.podcast_question_candidates;
create policy podcast_candidates_comms on public.podcast_question_candidates
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists podcast_scores_comms on public.podcast_candidate_scores;
create policy podcast_scores_comms on public.podcast_candidate_scores
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists podcast_invitations_comms on public.podcast_invitations;
create policy podcast_invitations_comms on public.podcast_invitations
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
