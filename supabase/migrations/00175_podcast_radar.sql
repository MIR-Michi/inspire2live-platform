-- 00175_podcast_radar.sql
--
-- Sprint 22 (podcast-planning): Radar — assisted discovery of questions and of
-- the people who could answer them. See docs/PODCAST_RADAR_CONCEPT.md and
-- ADR-0016.
--
-- Two of the three Phase B tables reserved by migration 00172's header are
-- created here, because this sprint gives both a reader.
-- `podcast_episode_results` is still NOT created: it belongs to the Results
-- screen, and a table with no reader is an orphan under ADR-0009 §10.
--
-- The load-bearing rule of ADR-0016 shows up as schema, not as convention:
-- `podcast_radar_signals` rows are written from open APIs *before* any model
-- runs, and every suggested person on a proposal must reference one of them.
-- That is what makes `independent_sources` a count of records rather than an
-- assertion, and it is why a signal row carries no model column at all.

-- ─── Signals: what the open sources returned ─────────────────────────────────

create table if not exists public.podcast_radar_signals (
  id                uuid        primary key default gen_random_uuid(),
  -- Which open source produced it. Deliberately a check rather than a lookup
  -- table: adding a source is a code change (a client in @/kernel/sources), so
  -- a row nobody can produce would be dead data.
  source            text        not null
    check (source in ('openalex', 'europepmc', 'congress_programme', 'regulator', 'web')),
  -- The source's own stable identifier (an OpenAlex work id, a DOI, a
  -- programme URL). Half of the dedupe key.
  external_id       text        not null,
  title             text        not null,
  url               text,
  -- When the underlying thing happened, not when we found it. This is what
  -- ends up on a question's `why_now_at` and drives the timeliness decay.
  published_at      date,
  -- Named people the source itself reported, with their stated affiliation:
  -- [{ name, role, organisation, country, externalId, url }]. Extracted by the
  -- client from structured fields — never by a model.
  people            jsonb       not null default '[]'::jsonb,
  -- The normalised record, kept so a re-parse never needs a re-fetch.
  payload           jsonb       not null default '{}'::jsonb,
  -- Computed identically here and in app code (radarDedupeKey), so every
  -- insert path converges on one row and a re-run is idempotent.
  dedupe_key        text        not null,
  discovered_at     timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

comment on table public.podcast_radar_signals is
  'Sprint 22 (podcast-planning): one row per record returned by an open source, stored before any model runs. Makes "three independent sources" a count of rows rather than a claim (ADR-0016 §1).';

create unique index if not exists uq_podcast_radar_signals_dedupe
  on public.podcast_radar_signals(dedupe_key);
create index if not exists idx_podcast_radar_signals_published
  on public.podcast_radar_signals(published_at desc nulls last);
create index if not exists idx_podcast_radar_signals_source
  on public.podcast_radar_signals(source, discovered_at desc);

-- ─── Proposals: the one thing Radar produces ─────────────────────────────────

create table if not exists public.podcast_radar_proposals (
  id                  uuid        primary key default gen_random_uuid(),
  -- Set when Radar was asked to find names for a question that already exists;
  -- null when it is proposing a new question from the fortnightly scan. One
  -- object, two modes (concept §3). No cascade to `podcast_questions` on
  -- purpose: retiring a question should not erase the record of what was
  -- proposed for it.
  question_id         uuid        references public.podcast_questions(id) on delete set null,
  mode                text        not null check (mode in ('names', 'topic')),
  -- For 'topic': the question as one arguable sentence, plus the dated reason.
  -- For 'names': a copy of the question text as it was when asked, so the
  -- proposal still reads correctly after the question is reworded.
  proposed_question   text        not null,
  why_now             text,
  why_now_at          date,
  -- The signal ids behind it, in the order they were shown. Not a join table:
  -- a proposal's evidence is read as a unit and never queried across.
  signal_ids          uuid[]      not null default '{}'::uuid[],
  -- The suggested people, each carrying the signal that produced them:
  -- [{ name, role, organisation, country, angle, signalId, url, sourceCount }].
  -- A suggestion whose signalId does not resolve is dropped in the domain
  -- layer before it is ever written here (ADR-0016 §2).
  names               jsonb       not null default '[]'::jsonb,
  model               text,
  effort              text,
  raw_response        jsonb       not null default '{}'::jsonb,
  status              text        not null default 'pending'
    check (status in ('pending', 'opened', 'dismissed', 'later', 'superseded')),
  -- One of the three fixed reasons. No free text: the taps are the only
  -- training signal there is, so they must cost nothing (concept §3).
  dismissed_reason    text
    check (dismissed_reason is null or dismissed_reason in ('off_agenda', 'already_covered', 'not_a_question')),
  decided_by          uuid        references public.profiles(id) on delete set null,
  decided_at          timestamptz,
  -- What accepting created, so "did Radar produce anyone who got booked" is
  -- answerable later.
  opened_question_id  uuid        references public.podcast_questions(id) on delete set null,
  opened_candidates   int         not null default 0,
  created_by          uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.podcast_radar_proposals is
  'Sprint 22 (podcast-planning): one reviewable proposal — a question, its evidence, and the names attached. Accepting writes people through network''s API plus unscored wishlist cards; it never writes a score, a listener action or a stage past Wishlist.';

-- At most one live proposal per question, so a second "Find names" replaces
-- rather than stacks. The pattern is `intake_ai_suggestions`': a database rule,
-- not a code convention.
create unique index if not exists uq_podcast_radar_one_pending
  on public.podcast_radar_proposals(question_id)
  where status = 'pending' and question_id is not null;
create index if not exists idx_podcast_radar_proposals_pending
  on public.podcast_radar_proposals(status, created_at desc);

-- ─── Provenance on the candidate ─────────────────────────────────────────────
-- There was nowhere to record that Radar put a name on a question, which made
-- "is Radar any good" unanswerable. `origin` defaults to 'human' so every
-- existing row keeps the right meaning.

alter table public.podcast_question_candidates
  add column if not exists origin text not null default 'human'
    check (origin in ('human', 'radar'));

alter table public.podcast_question_candidates
  add column if not exists radar_proposal_id uuid
    references public.podcast_radar_proposals(id) on delete set null;

create index if not exists idx_podcast_candidates_origin
  on public.podcast_question_candidates(origin) where origin = 'radar';

-- ─── Run status: the singleton lock ──────────────────────────────────────────
-- Same shape as `conference_discovery_status`: a claimed lock, a written
-- progress line, and a stale-run self-heal for a serverless function that was
-- killed before it could write a final state.

create table if not exists public.podcast_radar_status (
  singleton            boolean     primary key default true check (singleton),
  last_run_status      text        not null default 'idle'
    check (last_run_status in ('idle', 'running', 'success', 'error')),
  last_run_started_at  timestamptz,
  last_run_finished_at timestamptz,
  last_run_message     text,
  last_run_inserted    int
);

comment on table public.podcast_radar_status is
  'Sprint 22 (podcast-planning): singleton run lock and last-run explanation for Radar. A zero-result run says what it looked at — a silent empty result is indistinguishable from a broken feature.';

insert into public.podcast_radar_status (singleton) values (true)
  on conflict (singleton) do nothing;

-- ─── updated_at trigger ──────────────────────────────────────────────────────

drop trigger if exists trg_podcast_radar_proposals_touch on public.podcast_radar_proposals;
create trigger trg_podcast_radar_proposals_touch before update on public.podcast_radar_proposals
  for each row execute function public.podcast_planning_touch_updated_at();

-- ─── Row level security ──────────────────────────────────────────────────────
-- Identical to the rest of podcast-planning. Note that background runs write
-- with the service role: a session-less cron using the anon client would have
-- every insert silently filtered by these policies.

alter table public.podcast_radar_signals   enable row level security;
alter table public.podcast_radar_proposals enable row level security;
alter table public.podcast_radar_status    enable row level security;

drop policy if exists podcast_radar_signals_comms on public.podcast_radar_signals;
create policy podcast_radar_signals_comms on public.podcast_radar_signals
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists podcast_radar_proposals_comms on public.podcast_radar_proposals;
create policy podcast_radar_proposals_comms on public.podcast_radar_proposals
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists podcast_radar_status_comms on public.podcast_radar_status;
create policy podcast_radar_status_comms on public.podcast_radar_status
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
