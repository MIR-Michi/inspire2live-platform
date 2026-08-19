-- ============================================================
-- MIGRATION 00174: PUBLISHING POSTS (ADR-0015)
--
-- A saved post: the human-owned artifact of the Publishing space. Until now the
-- only persisted copy was `publishing_drafts`, which is the AI variant pool —
-- a draft is frozen at approval and its `ai_body` must never be overwritten,
-- because the distance between the two is the calibration signal (ADR-0014).
-- That leaves no place to park work in progress, to change the picture later,
-- or to say who owns the post.
--
-- `publishing_posts` is that place. One row per post a person decided to keep:
--   - `body`/`hashtags`/`image_ref` are the human's, editable for the life of
--     the post — the originating draft row stays untouched.
--   - `status` is the post's own three-state lifecycle: draft →
--     ready_to_publish → published. `published` is a human statement that the
--     copy went out; the platform cannot post to a channel on its own.
--   - `owner_id` is who is responsible for it and may be reassigned;
--     `created_by` records who made it and never changes.
--
-- `source_id` and `content_calendar_id` deliberately carry no FK: they point at
-- whichever component owns the record (ADR-0009 §9 rule 4). `draft_id` does get
-- a real FK — it is this component's own table.
--
-- Access: comms team / admins only (is_comms_team_or_admin), enforced by RLS —
-- never by the UI alone. Visibility is team-wide; `owner_id` names the
-- responsible person, it is not an access boundary.
-- ============================================================

create table if not exists public.publishing_posts (
  id uuid primary key default gen_random_uuid(),

  title text,                                   -- optional; derived from the first line of the body when absent

  -- Soft reference to the source this post came from (no cross-component FK).
  source_type text not null,
  source_id   uuid not null,

  -- The variant it was saved from, when it came from a generation run. Own
  -- table, so a real FK; nulled rather than cascaded so the post outlives the
  -- draft it started as.
  draft_id uuid references public.publishing_drafts(id) on delete set null,

  channel text not null,                        -- content channel vocabulary (CalendarChannel)

  body     text not null default '',
  hashtags text[] not null default '{}',
  image_ref jsonb,                              -- { bucket, storagePath, mediaType, alt } — replaceable

  status text not null default 'draft' check (
    status in ('draft', 'ready_to_publish', 'published')
  ),

  owner_id   uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),

  content_calendar_id uuid,                     -- soft link, set at handover
  published_at timestamptz,                     -- stamped when a human marks it published
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.publishing_posts is 'Saved posts: the human-owned artifact of the Publishing space (ADR-0015). Editable at any status, unlike the publishing_drafts variant it was saved from. status published is a human statement that the copy went out.';

create index if not exists idx_publishing_posts_owner
  on public.publishing_posts(owner_id, created_at desc);
create index if not exists idx_publishing_posts_status
  on public.publishing_posts(status);
create index if not exists idx_publishing_posts_created_at
  on public.publishing_posts(created_at desc);
create index if not exists idx_publishing_posts_source
  on public.publishing_posts(source_type, source_id, channel);

-- One variant saves to at most one post, so a double-click on Save cannot
-- produce two tiles of the same copy.
create unique index if not exists idx_publishing_posts_one_per_draft
  on public.publishing_posts(draft_id)
  where draft_id is not null;

alter table public.publishing_posts enable row level security;

drop policy if exists publishing_posts_comms on public.publishing_posts;
create policy publishing_posts_comms on public.publishing_posts
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists publishing_posts_set_updated_at on public.publishing_posts;
create trigger publishing_posts_set_updated_at
  before update on public.publishing_posts
  for each row execute function public.set_updated_at();

-- ── comms_integration_intents: allow intents to point at a post ──
-- Handover to the calendar now originates from the saved post rather than the
-- draft, so the delivery intent points at the post. 'publishing_drafts' stays
-- admitted for the intents already logged against it.
alter table public.comms_integration_intents
  drop constraint if exists comms_integration_intents_entity_type_check;
alter table public.comms_integration_intents
  add constraint comms_integration_intents_entity_type_check check (
    entity_type in (
      'content_calendar',
      'events',
      'campus_sessions',
      'media_assets',
      'media_recovery_requests',
      'publishing_drafts',
      'publishing_posts'
    )
  );

notify pgrst, 'reload schema';
