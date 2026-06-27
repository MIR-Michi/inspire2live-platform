-- ============================================================
-- MIGRATION 00086: ONCOLOGY CONFERENCES
--
-- The Conferences space (comms workspace). The platform AI discovers
-- upcoming oncology conferences for the next ~12 months (refreshed monthly
-- by a cron), and the comms team curates them through a visit pipeline:
--
--   discovered → intended → registered → ongoing → follow_up → archived
--
-- - conferences: the AI-discovered master list (one row per conference),
--   with an on-demand-enriched detail blob cached after first click.
-- - conference_tracking: one row per conference the team has shortlisted,
--   carrying its pipeline stage + notes (org-wide shared pipeline).
-- - conference_discovery_status: a singleton row tracking the background
--   discovery run so the UI can kick it off, poll, and survive a reload.
--
-- Access is restricted to the communications team / PlatformAdmin
-- (is_comms_team_or_admin); the cron writes via the service role.
-- ============================================================

-- ── conferences (AI-discovered master list) ────────────────
create table if not exists public.conferences (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  organizer       text,
  -- Coarse geography used for the region filter dropdown.
  region          text        not null default 'global'
    check (region in ('europe', 'north_america', 'latin_america', 'asia_pacific', 'middle_east_africa', 'global')),
  -- Free-text venue ("Vienna, Austria"; "Online").
  location        text,
  -- Primary oncology focus used for the "main focus" filter ("Breast cancer",
  -- "Immuno-oncology", "General oncology", …).
  main_focus      text,
  -- Additional topic tags for search/filter.
  topics          text[]      not null default '{}',
  format          text        not null default 'in_person'
    check (format in ('in_person', 'virtual', 'hybrid')),
  start_date      date,
  end_date        date,
  website_url     text,
  source_url      text,
  summary         text,
  -- 0-100 relevance to Inspire2Live's patient-advocacy mission, set by the model.
  relevance       integer     not null default 50 check (relevance between 0 and 100),
  -- Stable dedupe key (normalized name + start month) so monthly re-runs never
  -- duplicate a conference. Computed in the application layer.
  dedupe_key      text        not null,
  -- On-demand enrichment: gathered the first time a user opens the detail pane,
  -- then cached so it appears instantly next time.
  detail          jsonb,
  detail_status   text        not null default 'none'
    check (detail_status in ('none', 'loading', 'ready', 'error')),
  detail_fetched_at timestamptz,
  discovered_at   timestamptz not null default now(),
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.conferences is 'AI-discovered upcoming oncology conferences for the Conferences space. Refreshed monthly by cron. detail is enriched on first open and cached.';

create unique index if not exists idx_conferences_dedupe_key
  on public.conferences (dedupe_key);
create index if not exists idx_conferences_start_date
  on public.conferences (start_date asc nulls last, relevance desc);
create index if not exists idx_conferences_region
  on public.conferences (region);

alter table public.conferences enable row level security;

drop policy if exists conferences_comms_access on public.conferences;
create policy conferences_comms_access on public.conferences
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists conferences_set_updated_at on public.conferences;
create trigger conferences_set_updated_at
  before update on public.conferences
  for each row execute function public.set_updated_at();

-- ── conference_tracking (the visit pipeline) ───────────────
create table if not exists public.conference_tracking (
  conference_id uuid        primary key references public.conferences(id) on delete cascade,
  stage         text        not null default 'intended'
    check (stage in ('intended', 'registered', 'ongoing', 'follow_up', 'archived')),
  notes         text,
  added_by      uuid        references public.profiles(id) on delete set null,
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.conference_tracking is 'Org-wide shared pipeline for shortlisted conferences. One row per conference; stage drives the Shortlist/Pipeline/Archive tabs.';

create index if not exists idx_conference_tracking_stage
  on public.conference_tracking (stage);

alter table public.conference_tracking enable row level security;

drop policy if exists conference_tracking_comms_access on public.conference_tracking;
create policy conference_tracking_comms_access on public.conference_tracking
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists conference_tracking_set_updated_at on public.conference_tracking;
create trigger conference_tracking_set_updated_at
  before update on public.conference_tracking
  for each row execute function public.set_updated_at();

-- ── conference_discovery_status (singleton run tracker) ────
create table if not exists public.conference_discovery_status (
  singleton            boolean     primary key default true check (singleton),
  last_run_status      text        not null default 'idle'
    check (last_run_status in ('idle', 'running', 'success', 'error')),
  last_run_started_at  timestamptz,
  last_run_finished_at timestamptz,
  last_run_message     text,
  last_run_inserted    integer,
  updated_at           timestamptz not null default now()
);

comment on table public.conference_discovery_status is 'Singleton tracking the background conference-discovery run so the UI can start it, poll, and survive a reload.';

-- Seed the singleton row so status reads/updates always have a target.
insert into public.conference_discovery_status (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.conference_discovery_status enable row level security;

-- Comms team reads the run status; writes happen via the service role.
drop policy if exists conference_discovery_status_select on public.conference_discovery_status;
create policy conference_discovery_status_select on public.conference_discovery_status
  for select to authenticated
  using (public.is_comms_team_or_admin());

drop trigger if exists conference_discovery_status_set_updated_at on public.conference_discovery_status;
create trigger conference_discovery_status_set_updated_at
  before update on public.conference_discovery_status
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
