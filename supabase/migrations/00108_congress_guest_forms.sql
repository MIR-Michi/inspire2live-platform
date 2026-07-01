-- ============================================================
-- MIGRATION 00108: Congress guest forms
--
-- Allows non-platform users (patient advocates, contacts) to report
-- conference attendance via a personal magic link. No account required.
--
-- Tables:
--   conference_guest_tokens   – magic link tokens (hashed), one per contact
--   conference_guest_submissions – staging table; coordinator reviews before
--                                  merging into the live CRM
--
-- Flow:
--   1. Coordinator creates a token for a CRM contact (platform action).
--   2. Token is sent via WhatsApp/email as a short public URL.
--   3. Contact fills the mobile-first form at /congress/attend/<token>.
--   4. Submission lands in the staging table with status='pending'.
--   5. Coordinator reviews, then approves (→ CRM) or rejects.
-- ============================================================

-- ── Guest tokens ─────────────────────────────────────────────────────────────

create table if not exists public.conference_guest_tokens (
  id              uuid        primary key default gen_random_uuid(),
  -- SHA-256 hex of the raw token sent in the URL. Never store the raw token.
  token_hash      text        not null unique,
  -- Optional: pre-link to an existing CRM contact for prefill.
  contact_id      uuid        references public.comms_crm_contacts(id) on delete set null,
  -- Prefill values (captured at creation so they survive contact edits).
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  -- Optional: scope to a specific conference (prefills the conference field).
  conference_id   uuid        references public.conferences(id) on delete set null,
  -- Admin who created this token.
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Tokens expire after 90 days; admin can revoke early.
  expires_at      timestamptz not null default now() + interval '90 days',
  revoked_at      timestamptz,
  -- How many times the form has been submitted via this token.
  used_count      int         not null default 0
);

comment on table public.conference_guest_tokens is
  'Magic-link tokens for the congress guest attendance form. One token per contact/send.';

create index if not exists idx_conf_guest_tokens_contact
  on public.conference_guest_tokens(contact_id)
  where contact_id is not null;

create index if not exists idx_conf_guest_tokens_expires
  on public.conference_guest_tokens(expires_at)
  where revoked_at is null;

-- RLS: only the comms team / PlatformAdmin can manage tokens.
alter table public.conference_guest_tokens enable row level security;

drop policy if exists conf_guest_tokens_comms on public.conference_guest_tokens;
create policy conf_guest_tokens_comms on public.conference_guest_tokens
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- The public form validates a token via a SECURITY DEFINER RPC (see below),
-- so no anon-select policy is needed on the table itself.

-- ── Guest submissions (staging) ───────────────────────────────────────────────

create table if not exists public.conference_guest_submissions (
  id                    uuid        primary key default gen_random_uuid(),
  token_id              uuid        not null references public.conference_guest_tokens(id) on delete cascade,
  -- Submitter info (may differ from prefill if contact corrects their data).
  submitter_name        text        not null,
  submitter_email       text,
  submitter_phone       text,
  submitter_organisation text,
  -- Conference attended.
  conference_id         uuid        references public.conferences(id) on delete set null,
  conference_name       text        not null,
  conference_start_date date,
  conference_end_date   date,
  conference_location   text,
  -- Attendance details.
  role_at_conference    text        not null default 'attendee'
    check (role_at_conference in ('attendee', 'speaker', 'panelist', 'organizer', 'other')),
  notes                 text,
  -- Review workflow.
  status                text        not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by           uuid        references auth.users(id) on delete set null,
  reviewed_at           timestamptz,
  review_notes          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.conference_guest_submissions is
  'Staging table for guest form submissions. Coordinator reviews before merging into CRM.';

create index if not exists idx_conf_guest_submissions_token
  on public.conference_guest_submissions(token_id, created_at desc);

create index if not exists idx_conf_guest_submissions_status
  on public.conference_guest_submissions(status, created_at desc);

create index if not exists idx_conf_guest_submissions_conference
  on public.conference_guest_submissions(conference_id)
  where conference_id is not null;

drop trigger if exists conf_guest_submissions_set_updated_at on public.conference_guest_submissions;
create trigger conf_guest_submissions_set_updated_at
  before update on public.conference_guest_submissions
  for each row execute function public.set_updated_at();

-- RLS: comms team / PlatformAdmin can read and manage all.
alter table public.conference_guest_submissions enable row level security;

drop policy if exists conf_guest_submissions_comms on public.conference_guest_submissions;
create policy conf_guest_submissions_comms on public.conference_guest_submissions
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── Public RPC: validate a guest token ───────────────────────────────────────
-- Called by the API route (/api/congress-guest/validate) with the raw token.
-- Returns prefill data if the token is valid; empty if expired/revoked/not found.
-- SECURITY DEFINER so anon callers can read token prefill without table access.

create or replace function public.validate_conference_guest_token(
  raw_token text
)
returns table (
  token_id        uuid,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  conference_id   uuid,
  conference_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  -- SHA-256 hex digest of the raw token.
  v_hash := encode(digest(raw_token, 'sha256'), 'hex');

  return query
  select
    t.id                                    as token_id,
    t.contact_name                          as contact_name,
    t.contact_email                         as contact_email,
    t.contact_phone                         as contact_phone,
    t.conference_id                         as conference_id,
    c.name                                  as conference_name
  from public.conference_guest_tokens t
  left join public.conferences c on c.id = t.conference_id
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now()
  limit 1;
end;
$$;

revoke all on function public.validate_conference_guest_token(text) from public;
grant execute on function public.validate_conference_guest_token(text) to anon;
grant execute on function public.validate_conference_guest_token(text) to authenticated;

-- ── Public RPC: submit a guest attendance form ────────────────────────────────
-- Inserts into the staging table and increments used_count on the token.
-- Validates the token again inside the transaction for safety.

create or replace function public.submit_conference_guest_form(
  p_raw_token           text,
  p_submitter_name      text,
  p_submitter_email     text,
  p_submitter_phone     text,
  p_submitter_org       text,
  p_conference_id       uuid,
  p_conference_name     text,
  p_conference_start    date,
  p_conference_end      date,
  p_conference_location text,
  p_role                text,
  p_notes               text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash        text;
  v_token_id    uuid;
  v_sub_id      uuid;
begin
  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select id into v_token_id
  from public.conference_guest_tokens
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now();

  if v_token_id is null then
    raise exception 'invalid_token';
  end if;

  insert into public.conference_guest_submissions (
    token_id, submitter_name, submitter_email, submitter_phone,
    submitter_organisation, conference_id, conference_name,
    conference_start_date, conference_end_date, conference_location,
    role_at_conference, notes
  ) values (
    v_token_id, p_submitter_name, p_submitter_email, p_submitter_phone,
    p_submitter_org, p_conference_id, p_conference_name,
    p_conference_start, p_conference_end, p_conference_location,
    p_role, p_notes
  )
  returning id into v_sub_id;

  update public.conference_guest_tokens
  set used_count = used_count + 1
  where id = v_token_id;

  return v_sub_id;
end;
$$;

revoke all on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) from public;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) to anon;
grant execute on function public.submit_conference_guest_form(text,text,text,text,text,uuid,text,date,date,text,text,text) to authenticated;

-- ── Public conference search ──────────────────────────────────────────────────
-- Lets the guest form's typeahead search conferences without authentication.
-- Returns only id + name + location + start_date for autocomplete.

create or replace function public.search_conferences_public(
  query text,
  max_results int default 10
)
returns table (
  id          uuid,
  name        text,
  location    text,
  start_date  date,
  end_date    date
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.id,
    c.name,
    c.location,
    c.start_date,
    c.end_date
  from public.conferences c
  where c.name ilike '%' || query || '%'
  order by
    -- Exact-prefix matches first.
    (c.name ilike query || '%') desc,
    c.start_date desc nulls last
  limit greatest(1, least(max_results, 25));
$$;

revoke all on function public.search_conferences_public(text, int) from public;
grant execute on function public.search_conferences_public(text, int) to anon;
grant execute on function public.search_conferences_public(text, int) to authenticated;

notify pgrst, 'reload schema';
