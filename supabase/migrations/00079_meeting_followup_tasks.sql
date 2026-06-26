-- ============================================================
-- MIGRATION 00079: MEETING FOLLOW-UP TASK PROPOSALS
--
-- Sprint 14 Capability 3 (Follow-up tasks from the transcript):
-- the same transcript run that produces a meeting_summaries record also
-- maps its action items into draft comms_tasks. Those drafts land here as
-- reviewable proposals (Claude proposes, a human disposes) — a human
-- edits/accepts/rejects them, and only on commit is a real comms_task
-- created (ADR-0008 unified task system) and the owner notified.
-- ============================================================

create table if not exists public.meeting_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.meeting_summaries(id) on delete cascade,
  transcript_id uuid not null references public.meeting_transcripts(id) on delete cascade,
  title text not null,
  description text,
  -- Proposed owner matched against comms team members; null when unmatched.
  proposed_owner_id uuid references public.profiles(id) on delete set null,
  proposed_owner_label text,
  owner_match text not null default 'unmatched'
    check (owner_match in ('matched', 'unmatched')),
  -- Parsed ISO due date when the transcript gave one; raw_due keeps any
  -- natural-language hint ("end of next week") for the human to resolve.
  due_date date,
  raw_owner text,
  raw_due text,
  -- Where the proposal will file the committed task (inherited from the
  -- transcript's links at generation time; editable on commit).
  campus_session_id uuid references public.campus_sessions(id) on delete set null,
  agenda_item_id uuid references public.comms_weekly_agenda_items(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'committed', 'rejected', 'superseded')),
  committed_task_id uuid references public.comms_tasks(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  committed_by uuid references public.profiles(id) on delete set null,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meeting_followup_tasks is 'Reviewable draft comms_tasks proposed from a meeting summary''s action items. Human edits/accepts/rejects; committing creates the real comms_task and notifies the owner.';

create index if not exists idx_meeting_followup_tasks_summary
  on public.meeting_followup_tasks(summary_id, created_at);
create index if not exists idx_meeting_followup_tasks_transcript
  on public.meeting_followup_tasks(transcript_id, created_at);
create index if not exists idx_meeting_followup_tasks_status
  on public.meeting_followup_tasks(status);

alter table public.meeting_followup_tasks enable row level security;

drop policy if exists meeting_followup_tasks_comms_access on public.meeting_followup_tasks;
create policy meeting_followup_tasks_comms_access
  on public.meeting_followup_tasks
  for all
  using (public.is_comms_team_or_admin())
  with check (public.is_comms_team_or_admin());

drop trigger if exists meeting_followup_tasks_set_updated_at on public.meeting_followup_tasks;
create trigger meeting_followup_tasks_set_updated_at
  before update on public.meeting_followup_tasks
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
