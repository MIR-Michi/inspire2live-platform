-- MIGRATION 00046: Podcast event type and production workflow fields

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('conference', 'congress', 'workshop', 'webinar', 'symposium', 'podcast', 'other'));

alter table public.events
  add column if not exists podcast_series_name text,
  add column if not exists podcast_episode_title text,
  add column if not exists podcast_hosts text[] not null default '{}'::text[],
  add column if not exists podcast_guests text[] not null default '{}'::text[],
  add column if not exists podcast_recording_mode text not null default 'remote',
  add column if not exists podcast_distribution_channels text[] not null default '{}'::text[],
  add column if not exists podcast_recording_link text,
  add column if not exists podcast_preparation_notes text,
  add column if not exists podcast_run_of_show text,
  add column if not exists podcast_followup_notes text,
  add column if not exists podcast_guest_confirmed boolean not null default false,
  add column if not exists podcast_brief_ready boolean not null default false,
  add column if not exists podcast_release_form_ready boolean not null default false,
  add column if not exists podcast_equipment_ready boolean not null default false,
  add column if not exists podcast_recording_completed boolean not null default false,
  add column if not exists podcast_backup_completed boolean not null default false,
  add column if not exists podcast_edit_completed boolean not null default false,
  add column if not exists podcast_transcript_completed boolean not null default false,
  add column if not exists podcast_show_notes_completed boolean not null default false,
  add column if not exists podcast_published boolean not null default false,
  add column if not exists podcast_followup_completed boolean not null default false;

alter table public.events
  drop constraint if exists events_podcast_recording_mode_check;

alter table public.events
  add constraint events_podcast_recording_mode_check
  check (podcast_recording_mode in ('remote', 'in_person', 'studio', 'hybrid'));

alter table public.events
  drop constraint if exists events_podcast_distribution_channels_check;

alter table public.events
  add constraint events_podcast_distribution_channels_check
  check (
    podcast_distribution_channels <@
    array['spotify', 'apple_podcasts', 'youtube', 'website', 'linkedin', 'newsletter']::text[]
  );

notify pgrst, 'reload schema';
