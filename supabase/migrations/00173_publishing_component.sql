-- ============================================================
-- MIGRATION 00173: PUBLISHING COMPONENT (Sprint 21, ADR-0014)
--
-- The Publishing space: turn a platform record or an uploaded screenshot into
-- channel-ready copy, drafted by the platform's AI layer and approved by a
-- human before it can hand over to the content calendar.
--
-- - publishing_sources: ad-hoc sources (screenshot + one line of context +
--   a rights answer) — the material with no owning platform record.
-- - publishing_drafts: one row per generated variant, for any source kind.
--   `source_id` deliberately carries no FK: it points at whichever component
--   owns the source (ADR-0009 §9 rule 4 / ADR-0014 §7). FKs into the identity
--   spine (profiles) stay normal FKs.
-- - publishing-uploads storage bucket: private, image-only, comms-gated.
-- - comms_integration_intents.entity_type gains 'publishing_drafts' so a
--   delivery intent can point at the draft it came from (the table stays
--   content-owned).
--
-- Access: comms team / admins only (is_comms_team_or_admin), enforced by RLS
-- on both tables and the storage policies — never by the UI alone.
-- ============================================================

-- ── publishing_sources (ad-hoc uploads) ─────────────────────
create table if not exists public.publishing_sources (
  id uuid primary key default gen_random_uuid(),
  title text,                                   -- optional; derived from the description if absent
  description text not null,                    -- the one line of context the user typed
  images jsonb not null default '[]'::jsonb,    -- [{ bucket, storagePath, mediaType, alt, bytes }]
  -- The rights answer captured at upload (media-library vocabulary, reused).
  -- Anything other than approved_for_publication can be drafted from but can
  -- never hand over to the calendar (gate in the domain layer + unit-tested).
  rights_status text not null default 'internal_only' check (
    rights_status in ('internal_only', 'approved_for_publication', 'needs_clearance')
  ),
  occurred_at date,
  public_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.publishing_sources is 'Ad-hoc publishing sources: an uploaded screenshot plus a one-line description and a rights answer. Served to the drafter by the same SourceProvider contract as linked sources (ADR-0014 §3).';

create index if not exists idx_publishing_sources_created_at
  on public.publishing_sources(created_at desc);

alter table public.publishing_sources enable row level security;

drop policy if exists publishing_sources_comms on public.publishing_sources;
create policy publishing_sources_comms on public.publishing_sources
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

-- ── publishing_drafts (one row per variant) ─────────────────
create table if not exists public.publishing_drafts (
  id uuid primary key default gen_random_uuid(),

  -- Soft reference to the source: no FK across component boundaries.
  -- 'adhoc' points at publishing_sources.id; 'campus_session' at campus_sessions.id.
  source_type        text not null,
  source_id          uuid not null,
  source_fingerprint text not null,
  source_fields      jsonb not null default '[]'::jsonb,  -- exactly what was sent to the model

  channel text not null,                        -- content channel vocabulary (CalendarChannel)
  run_id  uuid not null,                        -- groups the variants of one generation
  variant_index int not null default 0,         -- 0..n-1 within a run (backs the one-live-run index)
  angle   text,

  body     text not null,                       -- current text; human edits land here
  ai_body  text not null,                       -- untouched model output, kept for calibration
  hashtags text[] not null default '{}',
  claims   jsonb not null default '[]'::jsonb,  -- [{ text, sourceFieldKey }]
  image_ref jsonb,                              -- the image accompanying the post, when there is one
  image_description text,                       -- the model's own reading of the image (ad-hoc review)
  omitted  text[] not null default '{}',        -- material the model deliberately left out

  status text not null default 'pending' check (
    status in ('pending', 'approved', 'dismissed', 'superseded', 'published')
  ),

  workload text,
  model text,
  effort text,
  prompt_version text,
  raw_response jsonb,

  content_calendar_id uuid,                     -- soft link, set at handover
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.publishing_drafts is 'Channel-post drafts, one row per variant (ADR-0014). body carries human edits; ai_body is never overwritten. status published means handed over — the publishing lifecycle itself lives in content_calendar.';

create index if not exists idx_publishing_drafts_source
  on public.publishing_drafts(source_type, source_id, channel, created_at desc);
create index if not exists idx_publishing_drafts_status
  on public.publishing_drafts(status);

-- At most one live pending run per (source_type, source_id, channel):
-- variants inside one run occupy distinct variant_index slots, so a second
-- pending run collides on variant_index 0. Regeneration supersedes first.
create unique index if not exists idx_publishing_drafts_one_pending_run
  on public.publishing_drafts(source_type, source_id, channel, variant_index)
  where status = 'pending';

alter table public.publishing_drafts enable row level security;

drop policy if exists publishing_drafts_comms on public.publishing_drafts;
create policy publishing_drafts_comms on public.publishing_drafts
  for all using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists publishing_drafts_set_updated_at on public.publishing_drafts;
create trigger publishing_drafts_set_updated_at
  before update on public.publishing_drafts
  for each row execute function public.set_updated_at();

-- ── Storage bucket for ad-hoc image uploads ─────────────────
-- Private; reads go through signed URLs (like whatsapp-inbound-media) or a
-- server-side download for the model call. The 25MB bucket limit is the hard
-- ceiling; the operator-tunable maxUploadMegabytes config enforces the real
-- (lower) limit in the domain layer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publishing-uploads',
  'publishing-uploads',
  false, -- private: may contain unconsented people / uncleared material
  26214400, -- 25MB hard ceiling
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "publishing_uploads_storage_read" on storage.objects;
create policy "publishing_uploads_storage_read" on storage.objects
  for select using (
    bucket_id = 'publishing-uploads' and public.is_comms_team_or_admin()
  );

drop policy if exists "publishing_uploads_storage_write" on storage.objects;
create policy "publishing_uploads_storage_write" on storage.objects
  for insert with check (
    bucket_id = 'publishing-uploads' and public.is_comms_team_or_admin()
  );

drop policy if exists "publishing_uploads_storage_delete" on storage.objects;
create policy "publishing_uploads_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'publishing-uploads' and public.is_comms_team_or_admin()
  );

-- ── comms_integration_intents: allow intents to point at a draft ──
-- The inline check constraint from 00037 gets Postgres' generated name.
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
      'publishing_drafts'
    )
  );

notify pgrst, 'reload schema';
