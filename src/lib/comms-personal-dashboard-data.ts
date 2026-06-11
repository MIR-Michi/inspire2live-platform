/**
 * lib/comms-personal-dashboard-data.ts
 *
 * Loads the data for a comms user's PERSONAL dashboard panel
 * ("what needs my attention?"). Shared by the global /app/dashboard and
 * the comms /app/comms/dashboard?view=personal route.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type PersonalTask = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  initiative_id: string
}
export type PersonalContentItem = {
  id: string
  title: string
  status: string
  scheduled_at: string | null
  source_link: string | null
}
export type PersonalIncomingItem = {
  id: string
  sender_name: string
  content_type: string
  raw_content: string
  source_url: string | null
  captured_at: string
}
export type PersonalProjectSummary = { id: string; title: string; summary: string; href: string; label: string }
export type PersonalDecision = { id: string; decision: string; owner: string; href: string; meeting: string }

export type CommsPersonalDashboardData = {
  tasks: PersonalTask[]
  contentItems: PersonalContentItem[]
  incomingItems: PersonalIncomingItem[]
  projectSummaries: PersonalProjectSummary[]
  decisions: PersonalDecision[]
}

function formatShortDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function parseCampusDecision(value: string) {
  const parts = value.split('|').map((part) => part.trim())
  return {
    decision: parts[0]?.replace(/^Decision:\s*/i, '').trim() || value,
    owner: parts.find((part) => /^Owner:/i.test(part))?.replace(/^Owner:\s*/i, '').trim() || 'Unassigned',
  }
}

export async function loadCommsPersonalDashboardData(
  supabase: SupabaseClient,
  userId: string
): Promise<CommsPersonalDashboardData> {
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()).toISOString()

  const [
    { data: personalTaskRows },
    { data: contentRows },
    { data: incomingRows },
    { data: campusRows },
    { data: eventRows },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, initiative_id')
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('content_calendar')
      .select('id, title, status, scheduled_at, source_link')
      .eq('author_id', userId)
      .neq('status', 'archived')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('intake_items')
      .select('id, sender_name, content_type, raw_content, source_url, captured_at')
      .eq('status', 'unreviewed')
      .order('captured_at', { ascending: false })
      .limit(6),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary, decisions_for_publication')
      .order('session_date', { ascending: false })
      .limit(4),
    supabase
      .from('events')
      .select('id, name, start_date, location_city, location_country, notes')
      .gte('start_date', today.toISOString().slice(0, 10))
      .lt('start_date', nextMonth.slice(0, 10))
      .order('start_date', { ascending: true })
      .limit(2),
  ])

  const projectSummaries: PersonalProjectSummary[] = [
    ...((campusRows ?? []) as Array<{ id: string; session_date: string; theme: string | null; summary: string | null }>).map(
      (row) => ({
        id: `campus-${row.id}`,
        title: row.theme || `Campus session ${formatShortDate(row.session_date)}`,
        summary: row.summary || 'Campus session notes and action items are ready for review.',
        href: `/app/comms/campus/${new Date(row.session_date).getFullYear()}/${new Date(row.session_date).getMonth() + 1}`,
        label: 'Campus',
      })
    ),
    ...((eventRows ?? []) as Array<{
      id: string
      name: string
      location_city: string | null
      location_country: string | null
      notes: string | null
    }>).map((row) => ({
      id: `event-${row.id}`,
      title: row.name,
      summary:
        row.notes ||
        [row.location_city, row.location_country].filter(Boolean).join(', ') ||
        'Upcoming event needs follow-up planning.',
      href: `/app/comms/events/${row.id}`,
      label: 'Event',
    })),
  ]

  const decisions: PersonalDecision[] = ((campusRows ?? []) as Array<{
    id: string
    session_date: string
    theme: string | null
    decisions_for_publication: string[] | null
  }>)
    .flatMap((row) =>
      (row.decisions_for_publication ?? []).map((decision, index) => {
        const parsed = parseCampusDecision(decision)
        return {
          id: `${row.id}-${index}`,
          decision: parsed.decision,
          owner: parsed.owner,
          href: `/app/comms/campus/${new Date(row.session_date).getFullYear()}/${new Date(row.session_date).getMonth() + 1}`,
          meeting: row.theme || `Campus ${formatShortDate(row.session_date)}`,
        }
      })
    )
    .slice(0, 4)

  return {
    tasks: (personalTaskRows ?? []) as PersonalTask[],
    contentItems: (contentRows ?? []) as PersonalContentItem[],
    incomingItems: (incomingRows ?? []) as PersonalIncomingItem[],
    projectSummaries,
    decisions,
  }
}
