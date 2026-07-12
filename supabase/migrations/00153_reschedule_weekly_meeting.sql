-- ============================================================
-- MIGRATION 00153: Manually reschedule a weekly comms meeting
--
-- The bi-weekly comms meeting is a virtual grouping — every agenda item (and
-- any uploaded transcript / summary) shares a `meeting_date`, and that date is
-- what identifies the meeting. To let the team move a meeting to a different
-- day (a previous one that landed on the wrong date, or an upcoming one that
-- needs shifting) we rewrite the `meeting_date` on every row of the meeting.
--
-- Rescheduling is a collaborative action: a meeting's agenda items belong to
-- several owners, but any comms member may move the whole meeting. The
-- row-level update policy on comms_weekly_agenda_items is owner-scoped ("you
-- proposed it, you own it") and would otherwise move only the caller's own
-- items, splitting the meeting in two. So — like reorder_agenda_items — this
-- runs through a SECURITY DEFINER function guarded by is_comms_team_or_admin().
--
-- Only weekly (non-campus) rows are touched; campus meetings are dated by their
-- session, not by meeting_date.
-- ============================================================

create or replace function public.reschedule_weekly_meeting(
  p_current_date date,
  p_new_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_comms_team_or_admin() then
    raise exception 'Not authorized to reschedule the meeting';
  end if;

  if p_current_date is null or p_new_date is null then
    raise exception 'Both the current and new meeting dates are required';
  end if;

  if p_current_date = p_new_date then
    return;
  end if;

  update public.comms_weekly_agenda_items
  set meeting_date = p_new_date,
      updated_at = now()
  where meeting_date = p_current_date
    and campus_session_id is null;

  -- Keep any uploaded transcript + AI summary anchored to the same meeting.
  update public.meeting_transcripts
  set meeting_date = p_new_date
  where meeting_date = p_current_date
    and campus_session_id is null;

  update public.meeting_summaries
  set meeting_date = p_new_date
  where meeting_date = p_current_date;
end;
$$;

revoke all on function public.reschedule_weekly_meeting(date, date) from public;
grant execute on function public.reschedule_weekly_meeting(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
