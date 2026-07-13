-- ============================================================
-- MIGRATION 00157: WHATSAPP FEED AI CATEGORIZATION
--
-- WhatsApp analogue of meeting_summaries (00078). For a time window
-- (default: previous campus meeting → current campus meeting), Claude
-- summarizes the WhatsApp community feed and classifies salient messages
-- into categories, each of which routes to a reviewable downstream proposal
-- (birthday → content_calendar, new member → member_onboarding, event →
-- optional content_calendar). A human confirms every proposal before the
-- downstream record is created.
--
-- Sensitive community content ⇒ comms-team / PlatformAdmin only
-- (is_comms_team_or_admin), mirroring meeting_summaries.
--
--   whatsapp_feed_summaries: one reviewable run over a window (tldr, optional
--     monthly publication summary, model/effort provenance, status).
--   whatsapp_feed_items: the categorized items for a run, each carrying the
--     source intake_items id(s) that ground it (traceability) and a proposal
--     lifecycle once acted on.
-- ============================================================

-- ── whatsapp_feed_summaries ────────────────────────────────
create table if not exists public.whatsapp_feed_summaries (
  id uuid primary key default gen_random_uuid(),
  -- Window bounds (inclusive start, exclusive end handled in query layer).
  window_start timestamptz not null,
  window_end timestamptz not null,
  -- True for the "WhatsApp summary of the month" rollup run.
  monthly boolean not null default false,
  tldr text not null,
  monthly_summary text,
  -- Count of source messages considered, for reviewer context.
  message_count integer not null default 0,
  -- Optional link to the campus session that closed the window.
  campus_session_id uuid references public.campus_sessions(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'saved', 'discarded', 'superseded')),
  model text,
  effort text,
  raw_response jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  saved_by uuid references public.profiles(id) on delete set null,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whatsapp_feed_summaries is 'Reviewable AI categorization run over the WhatsApp community feed for a time window. Human confirms downstream proposals before anything is created. Comms-only RLS.';

create index if not exists idx_whatsapp_feed_summaries_window
  on public.whatsapp_feed_summaries(window_end desc);
create index if not exists idx_whatsapp_feed_summaries_campus_session
  on public.whatsapp_feed_summaries(campus_session_id)
  where campus_session_id is not null;

-- At most one pending draft per (window, monthly) so re-running supersedes.
create unique index if not exists idx_whatsapp_feed_summaries_one_pending
  on public.whatsapp_feed_summaries(window_start, window_end, monthly)
  where status = 'pending';

alter table public.whatsapp_feed_summaries enable row level security;

drop policy if exists whatsapp_feed_summaries_comms_access on public.whatsapp_feed_summaries;
create policy whatsapp_feed_summaries_comms_access
  on public.whatsapp_feed_summaries
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists whatsapp_feed_summaries_set_updated_at on public.whatsapp_feed_summaries;
create trigger whatsapp_feed_summaries_set_updated_at
  before update on public.whatsapp_feed_summaries
  for each row execute function public.set_updated_at();

-- ── whatsapp_feed_items ────────────────────────────────────
create table if not exists public.whatsapp_feed_items (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.whatsapp_feed_summaries(id) on delete cascade,
  category text not null check (
    category in ('birthday', 'new_member', 'event', 'question', 'news', 'i2l_initiative', 'other')
  ),
  title text not null,
  person text,
  -- ISO date or a natural-language hint (kept as text on purpose).
  item_date text,
  detail text,
  -- Source intake_items id(s) that ground this item — drives left→right
  -- highlight in the review UI. Never empty (enforced in the domain layer).
  source_message_ids uuid[] not null default '{}'::uuid[],
  -- Proposal lifecycle for the routed categories.
  proposal_status text not null default 'none'
    check (proposal_status in ('none', 'proposed', 'confirmed', 'dismissed')),
  -- Downstream record created on confirm (e.g. content_calendar / member_onboarding).
  linked_type text,
  linked_id uuid,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whatsapp_feed_items is 'One categorized WhatsApp feed item. source_message_ids reference intake_items for traceability; proposal_status/linked_* track the reviewable downstream action.';

create index if not exists idx_whatsapp_feed_items_summary
  on public.whatsapp_feed_items(summary_id);
create index if not exists idx_whatsapp_feed_items_category
  on public.whatsapp_feed_items(category);

alter table public.whatsapp_feed_items enable row level security;

drop policy if exists whatsapp_feed_items_comms_access on public.whatsapp_feed_items;
create policy whatsapp_feed_items_comms_access
  on public.whatsapp_feed_items
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists whatsapp_feed_items_set_updated_at on public.whatsapp_feed_items;
create trigger whatsapp_feed_items_set_updated_at
  before update on public.whatsapp_feed_items
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
