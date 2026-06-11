/**
 * lib/comms-dashboard-data.ts
 *
 * Server-side data loading for the Communications team dashboard.
 * Assembles the four content blocks (WhatsApp channels, events, weekly
 * agenda, update feed) team-wide (not scoped to the current user).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCommsEventPipelineData, type EventScopeFilter } from '@/lib/comms-event-pipeline'
import {
  normalizeAgendaStatus,
  normalizeCalendarStatus,
  normalizeEventStage,
  normalizeTaskStatus,
  type UnifiedStatus,
} from '@/lib/comms-status'
import { groupAgendaByMeeting, type AgendaItemRecord, type AgendaMeetingGroup } from '@/lib/comms-agenda'

export type ChannelKey = 'campus' | 'communications'

export type ChannelSignal = {
  id: string
  senderName: string
  summary: string
  capturedAt: string
}

export type ChannelCard = {
  key: ChannelKey
  label: string
  waitingCount: number
  recent: ChannelSignal[]
}

export type FeedKind = 'content' | 'event' | 'task' | 'campus' | 'crm' | 'agenda'

export type FeedEntry = {
  id: string
  kind: FeedKind
  kindLabel: string
  title: string
  ownerId: string | null
  ownerLabel: string | null
  ownerRole: string | null
  status: UnifiedStatus
  date: string | null
  href: string
}

export type TeamMemberOption = {
  id: string
  label: string
  role: string | null
}

export type TeamDashboardData = {
  channels: ChannelCard[]
  events: Awaited<ReturnType<typeof loadCommsEventPipelineData>>['events']
  agendaGroups: AgendaMeetingGroup[]
  feed: FeedEntry[]
  owners: TeamMemberOption[]
}

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  campus: 'Campus',
  communications: 'Communications',
}

function summarize(raw: string, max = 120) {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1).trimEnd()}…`
}

// intake_items.channel may be null on legacy rows; fall back to the
// original World Campus Channel source.
function resolveChannel(value: string | null | undefined): ChannelKey {
  return value === 'communications' ? 'communications' : 'campus'
}

export async function loadCommsTeamDashboardData(
  supabase: SupabaseClient,
  { scopeFilter = 'all' }: { scopeFilter?: EventScopeFilter } = {}
): Promise<TeamDashboardData> {
  // Loosely-typed handle for tables not yet in the generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [
    { data: profilesData },
    { data: intakeData },
    { data: contentData },
    { data: taskData },
    { data: campusData },
    { data: crmData },
    { data: agendaData },
    eventPipeline,
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role').order('name'),
    supabase
      .from('intake_items')
      .select('id, sender_name, raw_content, channel, status, captured_at')
      .neq('status', 'dismissed')
      .order('captured_at', { ascending: false })
      .limit(200),
    supabase
      .from('content_calendar')
      .select('id, title, status, scheduled_at, author_id')
      .neq('status', 'archived')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from('tasks')
      .select('id, title, status, due_date, initiative_id, assignee_id')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary')
      .order('session_date', { ascending: false })
      .limit(20),
    db
      .from('comms_crm_contacts')
      .select('id, full_name, lifecycle_stage, next_follow_up_at, relationship_owner_id')
      .not('next_follow_up_at', 'is', null)
      .order('next_follow_up_at', { ascending: true })
      .limit(100),
    db
      .from('comms_weekly_agenda_items')
      .select('id, meeting_date, title, summary, owner_id, status, created_at')
      .order('meeting_date', { ascending: false })
      .limit(200),
    loadCommsEventPipelineData({ scopeFilter }),
  ])

  type ProfileRow = { id: string; name: string | null; email: string | null; role: string | null }
  const profiles = (profilesData ?? []) as ProfileRow[]
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const labelFor = (id: string | null | undefined) => {
    if (!id) return null
    const p = profileMap.get(id)
    return p ? p.name ?? p.email ?? 'Unknown' : null
  }
  const roleFor = (id: string | null | undefined) => (id ? profileMap.get(id)?.role ?? null : null)

  // ── WhatsApp channels ──────────────────────────────────────────────
  const channels: ChannelCard[] = (['campus', 'communications'] as ChannelKey[]).map((key) => {
    const items = ((intakeData ?? []) as Array<{
      id: string
      sender_name: string
      raw_content: string
      channel: string | null
      status: string
      captured_at: string
    }>).filter((item) => resolveChannel(item.channel) === key)
    return {
      key,
      label: CHANNEL_LABELS[key],
      waitingCount: items.filter((item) => item.status === 'unreviewed').length,
      recent: items.slice(0, 3).map((item) => ({
        id: item.id,
        senderName: item.sender_name,
        summary: summarize(item.raw_content),
        capturedAt: item.captured_at,
      })),
    }
  })

  // ── Weekly agenda ──────────────────────────────────────────────────
  const agendaItems: AgendaItemRecord[] = ((agendaData ?? []) as Array<{
    id: string
    meeting_date: string
    title: string
    summary: string | null
    owner_id: string | null
    status: string
    created_at: string
  }>).map((row) => ({
    id: row.id,
    meetingDate: row.meeting_date,
    title: row.title,
    summary: row.summary,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    status: normalizeAgendaStatus(row.status),
    createdAt: row.created_at,
  }))
  const agendaGroups = groupAgendaByMeeting(agendaItems)

  // ── Update feed ────────────────────────────────────────────────────
  const feed: FeedEntry[] = []

  for (const row of (contentData ?? []) as Array<{
    id: string
    title: string
    status: string
    scheduled_at: string | null
    author_id: string | null
  }>) {
    feed.push({
      id: `content-${row.id}`,
      kind: 'content',
      kindLabel: 'Content',
      title: row.title,
      ownerId: row.author_id,
      ownerLabel: labelFor(row.author_id),
      ownerRole: roleFor(row.author_id),
      status: normalizeCalendarStatus(row.status),
      date: row.scheduled_at,
      href: '/app/comms/planner',
    })
  }

  for (const row of (taskData ?? []) as Array<{
    id: string
    title: string
    status: string
    due_date: string | null
    initiative_id: string | null
    assignee_id: string | null
  }>) {
    feed.push({
      id: `task-${row.id}`,
      kind: 'task',
      kindLabel: 'Task',
      title: row.title,
      ownerId: row.assignee_id,
      ownerLabel: labelFor(row.assignee_id),
      ownerRole: roleFor(row.assignee_id),
      status: normalizeTaskStatus(row.status),
      date: row.due_date,
      href: row.initiative_id ? `/app/initiatives/${row.initiative_id}/tasks` : '/app/tasks',
    })
  }

  for (const event of eventPipeline.events) {
    feed.push({
      id: `event-${event.id}`,
      kind: 'event',
      kindLabel: 'Event',
      title: event.name,
      ownerId: event.owner_id,
      ownerLabel: event.ownerLabel,
      ownerRole: roleFor(event.owner_id),
      status: normalizeEventStage(event.stage),
      date: event.start_date,
      href: `/app/comms/events/${event.id}`,
    })
  }

  for (const row of (campusData ?? []) as Array<{
    id: string
    session_date: string
    theme: string | null
    summary: string | null
  }>) {
    const d = new Date(`${row.session_date}T00:00:00Z`)
    feed.push({
      id: `campus-${row.id}`,
      kind: 'campus',
      kindLabel: 'Campus',
      title: row.theme || row.summary || 'Campus session',
      ownerId: null,
      ownerLabel: 'Communications team',
      ownerRole: 'Comms',
      // Campus sessions in the past are records of done work.
      status: d < new Date() ? 'completed' : 'in_progress',
      date: row.session_date,
      href: `/app/comms/campus/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`,
    })
  }

  for (const row of (crmData ?? []) as Array<{
    id: string
    full_name: string
    lifecycle_stage: string | null
    next_follow_up_at: string | null
    relationship_owner_id: string | null
  }>) {
    feed.push({
      id: `crm-${row.id}`,
      kind: 'crm',
      kindLabel: 'CRM follow-up',
      title: `Follow up with ${row.full_name}`,
      ownerId: row.relationship_owner_id,
      ownerLabel: labelFor(row.relationship_owner_id) ?? 'Communications team',
      ownerRole: roleFor(row.relationship_owner_id),
      status: row.lifecycle_stage === 'archived' ? 'completed' : 'in_progress',
      date: row.next_follow_up_at,
      href: '/app/comms/crm',
    })
  }

  for (const item of agendaItems) {
    feed.push({
      id: `agenda-${item.id}`,
      kind: 'agenda',
      kindLabel: 'Agenda item',
      title: item.title,
      ownerId: item.ownerId,
      ownerLabel: item.ownerLabel,
      ownerRole: item.ownerRole,
      status: item.status,
      date: item.meetingDate,
      href: '/app/comms/dashboard?view=team',
    })
  }

  // Deadline-aware sort: items with a date first (earliest), then undated.
  feed.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Owners present in the feed, for the owner filter.
  const ownerIds = new Set<string>()
  for (const entry of feed) if (entry.ownerId) ownerIds.add(entry.ownerId)
  const owners: TeamMemberOption[] = Array.from(ownerIds)
    .map((id) => ({ id, label: labelFor(id) ?? 'Unknown', role: roleFor(id) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return { channels, events: eventPipeline.events, agendaGroups, feed, owners }
}
