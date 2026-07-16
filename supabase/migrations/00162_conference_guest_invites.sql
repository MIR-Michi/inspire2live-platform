-- ============================================================
-- MIGRATION 00162: Conference guest invite log
--
-- Sprint 18. Records every guest attendance invite so the team can see
-- *who was invited, through which channels, when, and whether delivery
-- succeeded* — surfaced on the conference operating page and overview.
--
-- Previously a single invite (generateGuestToken) left no durable record;
-- only the transient `sends[]` result was returned to the browser. The
-- invite is now logged synchronously (status 'queued') and the background
-- send updates the per-channel status without blocking the coordinator.
-- ============================================================

create table if not exists public.conference_guest_invites (
  id               uuid        primary key default gen_random_uuid(),
  -- The magic-link token this invite delivered (nullable so the log survives
  -- token cleanup).
  token_id         uuid        references public.conference_guest_tokens(id) on delete set null,
  conference_id    uuid        references public.conferences(id) on delete cascade,
  contact_id       uuid        references public.comms_crm_contacts(id) on delete set null,
  -- Recipient snapshot (captured at send time; survives contact edits).
  recipient_name   text,
  recipient_email  text,
  recipient_phone  text,
  -- Channels requested for this invite, e.g. {'email','whatsapp'}.
  channels         text[]      not null default '{}',
  -- Per-channel outcome once the background send resolves.
  email_status     text        check (email_status in ('sent', 'failed')),
  whatsapp_status  text        check (whatsapp_status in ('sent', 'failed')),
  -- Rolled-up status: queued → sent | partial | failed.
  status           text        not null default 'queued'
    check (status in ('queued', 'sent', 'partial', 'failed')),
  detail           text,
  invited_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

comment on table public.conference_guest_invites is
  'Sprint 18: durable log of conference guest attendance invites (recipient, channels, delivery status). Surfaced on the operating page + overview.';

create index if not exists idx_conf_guest_invites_conference
  on public.conference_guest_invites(conference_id, created_at desc);

-- Access mirrors the rest of the Conferences space: comms team / admin.
alter table public.conference_guest_invites enable row level security;

drop policy if exists conf_guest_invites_comms on public.conference_guest_invites;
create policy conf_guest_invites_comms on public.conference_guest_invites
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

notify pgrst, 'reload schema';
