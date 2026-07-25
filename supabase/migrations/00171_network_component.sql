-- ============================================================
-- MIGRATION 00171: `network` component — the relationship graph
--
-- Sprint 20 / ADR-0013. The generic half of the Podcast Opportunity Engine:
-- a people directory, declared + public affiliations, a connection graph, the
-- cheap "do you know X" map question, and the introduction request (the favour).
--
-- Nothing in here is podcast-specific. `network_introduction_requests` carries a
-- generic (context_type, context_id) pair instead of a foreign key to a podcast
-- candidate, which is what keeps this component extractable into a second
-- platform (ADR-0009 §9 rule 4, ADR-0013 §2).
--
-- Data protection (concept §16): professional information only, per-field source
-- attribution, an objection flag that hides a person everywhere and permanently,
-- and member affiliations that are opt-in item by item and revocable.
-- ============================================================

-- ─── People ──────────────────────────────────────────────────────────────────
-- Everyone the organisation could plausibly reach out to: past guests, members,
-- CRM contacts and external candidates. Links into the kernel identity spine
-- (profiles / comms_crm_contacts) are real FKs; that is the one allowed
-- cross-component reference.

create table if not exists public.network_people (
  id                      uuid        primary key default gen_random_uuid(),
  full_name               text        not null,
  role_title              text,
  organisation            text,
  country                 text,
  languages               text[]      not null default '{}',
  topic_tags              text[]      not null default '{}',
  -- The reason to be on a specific episode/panel — not a biography.
  what_they_can_say       text,
  -- Public, source-linked profile pages: [{ label, url }]
  public_profile_urls     jsonb       not null default '[]'::jsonb,
  -- Public audience indicators only: { followers: {...}, outlets: [...] }
  audience_indicators     jsonb       not null default '{}'::jsonb,
  -- A person who promotes their own appearances is worth more than one with
  -- twice the audience who does not (concept §6).
  shares_own_appearances  boolean,
  -- Public appearances: [{ show, url, published_at }]. The single most
  -- predictive field in the model (concept §6/§7).
  podcast_appearances     jsonb       not null default '[]'::jsonb,
  -- Approval overhead that lengthens or kills a booking.
  institutional_friction  text        not null default 'none'
    check (institutional_friction in ('none', 'pharmaceutical', 'regulator', 'civil_service', 'press_office')),
  -- Relationship with an industry partner, so a conflict is visible at booking
  -- time rather than discovered later (concept §16, editorial independence).
  industry_relationship   text,
  -- Origin group, used for filtering and for the "already known" route.
  origin                  text        not null default 'external'
    check (origin in ('past_guest', 'member', 'crm_contact', 'external')),
  -- Identity-spine links (ADR-0007). Nullable: most people are neither.
  crm_contact_id          uuid        references public.comms_crm_contacts(id) on delete set null,
  profile_id              uuid        references public.profiles(id) on delete set null,
  -- Per-field provenance: { "role_title": "https://…", … }. A field with no
  -- source is treated as unverified and excluded from scoring (concept §16).
  source_attribution      jsonb       not null default '{}'::jsonb,
  -- Right to object: hides the record from every screen AND from scoring,
  -- permanently.
  objection_received      boolean     not null default false,
  objection_recorded_at   timestamptz,
  notes                   text,
  last_reviewed_at        timestamptz,
  -- Retention: rows with no activity for 18 months are purged (concept §16).
  last_activity_at        timestamptz not null default now(),
  created_by              uuid        references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.network_people is
  'Sprint 20 (network): directory of people the organisation could reach out to. Professional information only; every field source-attributed; objection_received hides the record everywhere and permanently.';

create index if not exists idx_network_people_name on public.network_people(lower(full_name));
create index if not exists idx_network_people_origin on public.network_people(origin) where objection_received = false;
create index if not exists idx_network_people_crm on public.network_people(crm_contact_id);
create index if not exists idx_network_people_profile on public.network_people(profile_id);

-- ─── Affiliations ────────────────────────────────────────────────────────────
-- Two tables on purpose: a target person's affiliations are *public* facts with
-- a source URL; a member's are *declared*, opt-in item by item, and revocable.
-- Storing them together would blur consent with observation.

create table if not exists public.network_person_affiliations (
  id           uuid        primary key default gen_random_uuid(),
  person_id    uuid        not null references public.network_people(id) on delete cascade,
  kind         text        not null
    check (kind in ('institution', 'society', 'congress', 'board', 'university', 'disease_area', 'country')),
  name         text        not null,
  from_year    int,
  to_year      int,
  source_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.network_person_affiliations is
  'Sprint 20 (network): publicly stated affiliations of a directory person, each with its source URL.';

create index if not exists idx_network_person_affil_person on public.network_person_affiliations(person_id);
create index if not exists idx_network_person_affil_match on public.network_person_affiliations(kind, lower(name));

create table if not exists public.network_member_affiliations (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles(id) on delete cascade,
  kind         text        not null
    check (kind in ('institution', 'society', 'congress', 'board', 'university', 'disease_area', 'country')),
  name         text        not null,
  from_year    int,
  to_year      int,
  -- Per-item consent. 'private' means the member declared it but does not want
  -- it used for route suggestions; declining is invisible to everyone else.
  visibility   text        not null default 'network'
    check (visibility in ('network', 'private')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.network_member_affiliations is
  'Sprint 20 (network): a member''s opt-in, item-by-item, revocable declared contexts. Members tick contexts; they never upload contacts.';

create index if not exists idx_network_member_affil_profile on public.network_member_affiliations(profile_id);
create index if not exists idx_network_member_affil_match on public.network_member_affiliations(kind, lower(name))
  where visibility = 'network';

-- ─── The connection graph ────────────────────────────────────────────────────
-- One row per known or *suspected* connection. Endpoints are polymorphic
-- (a member profile or a directory person) so the graph can span both sides
-- without a second table.

create table if not exists public.network_connections (
  id               uuid        primary key default gen_random_uuid(),
  from_type        text        not null check (from_type in ('profile', 'person')),
  from_id          uuid        not null,
  to_type          text        not null check (to_type in ('profile', 'person')),
  to_id            uuid        not null,
  connection_type  text        not null check (connection_type in (
                     'knows_well', 'published_together', 'knows_a_little', 'shared_board',
                     'shared_congress_session', 'shared_institution', 'shared_society', 'shared_country')),
  -- 0..1. Denormalised from connection_type at write time so the ranking query
  -- stays a plain sort; the vocabulary lives in the domain layer.
  strength         numeric(4,3) not null check (strength >= 0 and strength <= 1),
  -- What backs the claim: [{ kind, detail, source_url }]
  evidence         jsonb       not null default '[]'::jsonb,
  -- A connection is only 'confirmed' when a human said so. Inferred rows stay
  -- suggested until then — the model never claims two people know each other.
  status           text        not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'rejected')),
  confirmed_by     uuid        references public.profiles(id) on delete set null,
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.network_connections is
  'Sprint 20 (network): one row per known or suspected connection, with type, strength, evidence and who confirmed it. Suggested rows are guesses from affiliation overlap; only a human answer promotes one to confirmed.';

create unique index if not exists uq_network_connection_edge
  on public.network_connections(from_type, from_id, to_type, to_id, connection_type);
create index if not exists idx_network_connections_to on public.network_connections(to_type, to_id, strength desc);
create index if not exists idx_network_connections_from on public.network_connections(from_type, from_id, strength desc);

-- ─── The map question (cheap, commits nobody) ────────────────────────────────

create table if not exists public.network_connection_checks (
  id            uuid        primary key default gen_random_uuid(),
  profile_id    uuid        not null references public.profiles(id) on delete cascade,
  person_id     uuid        not null references public.network_people(id) on delete cascade,
  -- Free-text context shown with the question ("we are planning an episode on…").
  context_note  text,
  asked_by      uuid        references public.profiles(id) on delete set null,
  asked_at      timestamptz not null default now(),
  -- 'rather_not' is a first-class answer and is never rendered as a failure.
  answer        text        check (answer in ('knows_well', 'knows_a_little', 'knows_someone', 'no', 'rather_not')),
  -- For 'knows_someone': who they said could help, in their words.
  answer_note   text,
  answered_at   timestamptz
);

comment on table public.network_connection_checks is
  'Sprint 20 (network): the five-second map question. Costs nothing, commits nobody, moves no card. Every answer improves the map permanently — including every no.';

create index if not exists idx_network_checks_person on public.network_connection_checks(person_id);
create index if not exists idx_network_checks_profile on public.network_connection_checks(profile_id, asked_at desc);

-- ─── The favour (only after a connection is confirmed) ───────────────────────

create table if not exists public.network_introduction_requests (
  id                     uuid        primary key default gen_random_uuid(),
  -- Generic context instead of a cross-component FK (ADR-0013 §2). For the
  -- podcast this is ('podcast_candidate', <candidate id>).
  context_type           text        not null,
  context_id             uuid,
  -- What the introducer is being asked about, in one line, in the requester's words.
  context_summary        text,
  introducer_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  person_id              uuid        not null references public.network_people(id) on delete cascade,
  -- The route this request is walking, when one was chosen.
  connection_id          uuid        references public.network_connections(id) on delete set null,
  requested_by           uuid        references public.profiles(id) on delete set null,
  requested_at           timestamptz not null default now(),
  -- 'use_my_name' = "write to them yourself and say I sent you".
  response               text        check (response in ('yes', 'use_my_name', 'declined', 'no_reply')),
  responded_at           timestamptz,
  -- The introducer writes to the guest themselves, in their own words, from
  -- their own inbox. The platform never sends on their behalf; this only
  -- records that they said they did.
  intro_sent_at          timestamptz,
  outcome                text        check (outcome in ('guest_accepted', 'guest_declined', 'no_reply', 'not_pursued')),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.network_introduction_requests is
  'Sprint 20 (network): the favour ask, sent only to a confirmed contact. context_type/context_id keep the component generic. A decline carries no visible consequence and the history exists so nobody is quietly over-drawn.';

create index if not exists idx_network_intro_introducer
  on public.network_introduction_requests(introducer_profile_id, requested_at desc);
create index if not exists idx_network_intro_context
  on public.network_introduction_requests(context_type, context_id);
create index if not exists idx_network_intro_person on public.network_introduction_requests(person_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

create or replace function public.network_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_network_people_touch on public.network_people;
create trigger trg_network_people_touch before update on public.network_people
  for each row execute function public.network_touch_updated_at();

drop trigger if exists trg_network_member_affil_touch on public.network_member_affiliations;
create trigger trg_network_member_affil_touch before update on public.network_member_affiliations
  for each row execute function public.network_touch_updated_at();

drop trigger if exists trg_network_connections_touch on public.network_connections;
create trigger trg_network_connections_touch before update on public.network_connections
  for each row execute function public.network_touch_updated_at();

drop trigger if exists trg_network_intro_touch on public.network_introduction_requests;
create trigger trg_network_intro_touch before update on public.network_introduction_requests
  for each row execute function public.network_touch_updated_at();

-- ─── Row level security ──────────────────────────────────────────────────────
-- Access mirrors the Comms space for the directory and the graph. Member
-- affiliations are additionally the member's own to write and to withdraw.

alter table public.network_people                enable row level security;
alter table public.network_person_affiliations   enable row level security;
alter table public.network_member_affiliations   enable row level security;
alter table public.network_connections           enable row level security;
alter table public.network_connection_checks     enable row level security;
alter table public.network_introduction_requests enable row level security;

drop policy if exists network_people_comms on public.network_people;
create policy network_people_comms on public.network_people
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists network_person_affil_comms on public.network_person_affiliations;
create policy network_person_affil_comms on public.network_person_affiliations
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

-- A member owns their own declared contexts: they may read, add, edit and
-- revoke them. Consent that cannot be withdrawn is not consent.
drop policy if exists network_member_affil_own on public.network_member_affiliations;
create policy network_member_affil_own on public.network_member_affiliations
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- The comms team reads declared contexts to build routes. 'private' items are
-- filtered by the domain layer and by the matching index, not by the policy —
-- the member can still see and manage them.
drop policy if exists network_member_affil_comms on public.network_member_affiliations;
create policy network_member_affil_comms on public.network_member_affiliations
  for select using (public.is_comms_team_or_admin());

drop policy if exists network_connections_comms on public.network_connections;
create policy network_connections_comms on public.network_connections
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

drop policy if exists network_checks_comms on public.network_connection_checks;
create policy network_checks_comms on public.network_connection_checks
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

-- The member being asked answers their own map question.
drop policy if exists network_checks_own on public.network_connection_checks;
create policy network_checks_own on public.network_connection_checks
  for select using (profile_id = auth.uid());

drop policy if exists network_checks_own_answer on public.network_connection_checks;
create policy network_checks_own_answer on public.network_connection_checks
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists network_intro_comms on public.network_introduction_requests;
create policy network_intro_comms on public.network_introduction_requests
  for all using (public.is_comms_team_or_admin()) with check (public.is_comms_team_or_admin());

-- The introducer sees the requests addressed to them and records their answer.
drop policy if exists network_intro_own on public.network_introduction_requests;
create policy network_intro_own on public.network_introduction_requests
  for select using (introducer_profile_id = auth.uid());

drop policy if exists network_intro_own_answer on public.network_introduction_requests;
create policy network_intro_own_answer on public.network_introduction_requests
  for update using (introducer_profile_id = auth.uid()) with check (introducer_profile_id = auth.uid());

-- ─── Published read contract ─────────────────────────────────────────────────
-- The ONLY way another component reads people (ADR-0009 §6 rule 2). It is
-- `security_invoker`, so it grants no visibility the caller did not already
-- have, and it enforces the objection rule once, centrally: an objecting person
-- is invisible to every consumer by construction.

drop view if exists public.network_people_public;
create view public.network_people_public
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.role_title,
  p.organisation,
  p.country,
  p.languages,
  p.topic_tags,
  p.what_they_can_say,
  p.public_profile_urls,
  p.audience_indicators,
  p.shares_own_appearances,
  p.podcast_appearances,
  p.institutional_friction,
  p.industry_relationship,
  p.origin,
  p.crm_contact_id,
  p.profile_id,
  p.source_attribution,
  p.last_reviewed_at
from public.network_people p
where p.objection_received = false;

comment on view public.network_people_public is
  'Sprint 20 (network): the published read contract for people. security_invoker, so it is not a permission bypass. Objecting people are excluded here so no consumer can forget the rule.';

notify pgrst, 'reload schema';
