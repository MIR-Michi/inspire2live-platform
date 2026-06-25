/**
 * lib/comms-dashboard-data.ts
 *
 * Server-side data loading for the Communications team dashboard.
 * Assembles the four content blocks (WhatsApp channels, events, weekly
 * agenda, update feed) team-wide (not scoped to the current user).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCommsEventPipelineData, type EventScopeFilter } from '@/lib/comms-event-pipeline'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  normalizeCalendarStatus,
  normalizeEventStage,
  normalizeTaskStatus,
  type UnifiedStatus,
} from '@/lib/comms-status'
import { groupAgendaByMeeting, type AgendaItemRecord, type AgendaMeetingGroup } from '@/lib/comms-agenda'
import { normalizeCommsTaskStatus, type CommsTaskRecord } from '@/lib/comms-tasks'
import { loadNewMembers, type NewMemberRecord } from '@/lib/member-onboarding'

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

export type AgendaItemOption = {
  id: string
  label: string
  meetingDate: string
}

export type TeamDashboardData = {
  channels: ChannelCard[]
  events: Awaited<ReturnType<typeof loadCommsEventPipelineData>>['events']
  agendaGroups: AgendaMeetingGroup[]
  agendaItems: AgendaItemOption[]
  tasks: CommsTaskRecord[]
  teamMembers: TeamMemberOption[]
  newMembers: NewMemberRecord[]
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
    { data: commsTaskData },
    eventPipeline,
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role, avatar_url').order('name'),
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
      .select('id, meeting_date, title, summary, meeting_notes, owner_id, position, created_at')
      .is('campus_session_id', null)
      .order('meeting_date', { ascending: false })
      .limit(200),
    db
      .from('comms_tasks')
      .select('id, title, description, owner_id, due_date, status, agenda_item_id')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(200),
    loadCommsEventPipelineData({ scopeFilter }),
  ])

  type ProfileRow = { id: string; name: string | null; email: string | null; role: string | null; avatar_url?: string | null }
  const profiles = (profilesData ?? []) as ProfileRow[]
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const labelFor = (id: string | null | undefined) => {
    if (!id) return null
    const p = profileMap.get(id)
    return p ? p.name ?? p.email ?? 'Unknown' : null
  }
  const roleFor = (id: string | null | undefined) => (id ? profileMap.get(id)?.role ?? null : null)
  const avatarFor = (id: string | null | undefined) => (id ? profileMap.get(id)?.avatar_url ?? null : null)

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

  const agendaRows = (agendaData ?? []) as Array<{
    id: string
    meeting_date: string
    title: string
    summary: string | null
    meeting_notes: string | null
    owner_id: string | null
    position: number | null
    created_at: string
  }>
  const agendaTitleById = new Map(agendaRows.map((row) => [row.id, row.title]))

  // ── Person-owned comms tasks ───────────────────────────────────────
  const tasks: CommsTaskRecord[] = ((commsTaskData ?? []) as Array<{
    id: string
    title: string
    description: string | null
    owner_id: string | null
    due_date: string | null
    status: string
    agenda_item_id: string | null
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    dueDate: row.due_date,
    status: normalizeCommsTaskStatus(row.status),
    agendaItemId: row.agenda_item_id,
    agendaItemTitle: row.agenda_item_id ? agendaTitleById.get(row.agenda_item_id) ?? null : null,
  }))

  const linkedTasksByAgenda = new Map<string, CommsTaskRecord[]>()
  for (const task of tasks) {
    if (!task.agendaItemId) continue
    const list = linkedTasksByAgenda.get(task.agendaItemId) ?? []
    list.push(task)
    linkedTasksByAgenda.set(task.agendaItemId, list)
  }

  // ── Weekly agenda ──────────────────────────────────────────────────
  const agendaItems: AgendaItemRecord[] = agendaRows.map((row) => ({
    id: row.id,
    meetingDate: row.meeting_date,
    title: row.title,
    summary: row.summary,
    meetingNotes: row.meeting_notes,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    ownerAvatarUrl: avatarFor(row.owner_id),
    position: row.position ?? 0,
    createdAt: row.created_at,
    linkedTasks: linkedTasksByAgenda.get(row.id) ?? [],
  }))
  const agendaGroups = groupAgendaByMeeting(agendaItems)
  const agendaOptions: AgendaItemOption[] = agendaItems
    .map((item) => ({ id: item.id, label: item.title, meetingDate: item.meetingDate }))
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || a.label.localeCompare(b.label))

  // Comms-workspace members, for assigning task owners.
  const teamMembers: TeamMemberOption[] = profiles
    .filter((p) => canAccessCommsWorkspace(p.role))
    .map((p) => ({ id: p.id, label: p.name ?? p.email ?? 'Unknown', role: p.role }))
    .sort((a, b) => a.label.localeCompare(b.label))

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

  for (const task of tasks) {
    feed.push({
      id: `comms-task-${task.id}`,
      kind: 'task',
      kindLabel: task.agendaItemId ? 'Action item' : 'Task',
      title: task.title,
      ownerId: task.ownerId,
      ownerLabel: task.ownerLabel,
      ownerRole: task.ownerRole,
      status: task.status,
      date: task.dueDate,
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

  const newMembers = await loadNewMembers(supabase)

  return { channels, events: eventPipeline.events, agendaGroups, agendaItems: agendaOptions, tasks, teamMembers, newMembers, feed, owners }
}

/**
 * Focused loader for just the weekly meeting agenda groups (profiles for owner
 * labels, agenda items, and their linked comms tasks). Used by the standalone
 * "all meetings" screen, which doesn't need the full dashboard payload.
 */
export async function loadCommsAgendaGroups(supabase: SupabaseClient): Promise<AgendaMeetingGroup[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: profilesData }, { data: agendaData }, { data: commsTaskData }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role, avatar_url'),
    db
      .from('comms_weekly_agenda_items')
      .select('id, meeting_date, title, summary, meeting_notes, owner_id, position, created_at')
      .is('campus_session_id', null)
      .order('meeting_date', { ascending: false })
      .limit(500),
    db.from('comms_tasks').select('id, title, description, owner_id, due_date, status, agenda_item_id').limit(500),
  ])

  const profiles = (profilesData ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null; avatar_url?: string | null }>
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const labelFor = (id: string | null) =>
    id ? profileMap.get(id)?.name ?? profileMap.get(id)?.email ?? 'Unknown' : null
  const roleFor = (id: string | null) => (id ? profileMap.get(id)?.role ?? null : null)
  const avatarFor = (id: string | null) => (id ? profileMap.get(id)?.avatar_url ?? null : null)

  const agendaRows = (agendaData ?? []) as Array<{
    id: string
    meeting_date: string
    title: string
    summary: string | null
    meeting_notes: string | null
    owner_id: string | null
    position: number | null
    created_at: string
  }>
  const agendaTitleById = new Map(agendaRows.map((r) => [r.id, r.title]))

  const tasks: CommsTaskRecord[] = ((commsTaskData ?? []) as Array<{
    id: string
    title: string
    description: string | null
    owner_id: string | null
    due_date: string | null
    status: string
    agenda_item_id: string | null
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    dueDate: row.due_date,
    status: normalizeCommsTaskStatus(row.status),
    agendaItemId: row.agenda_item_id,
    agendaItemTitle: row.agenda_item_id ? agendaTitleById.get(row.agenda_item_id) ?? null : null,
  }))

  const linkedTasksByAgenda = new Map<string, CommsTaskRecord[]>()
  for (const task of tasks) {
    if (!task.agendaItemId) continue
    const list = linkedTasksByAgenda.get(task.agendaItemId) ?? []
    list.push(task)
    linkedTasksByAgenda.set(task.agendaItemId, list)
  }

  const agendaItems: AgendaItemRecord[] = agendaRows.map((row) => ({
    id: row.id,
    meetingDate: row.meeting_date,
    title: row.title,
    summary: row.summary,
    meetingNotes: row.meeting_notes,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    ownerAvatarUrl: avatarFor(row.owner_id),
    position: row.position ?? 0,
    createdAt: row.created_at,
    linkedTasks: linkedTasksByAgenda.get(row.id) ?? [],
  }))

  return groupAgendaByMeeting(agendaItems)
}

/**
 * Loads the structured agenda for a single monthly Campus meeting (the items
 * tied to one campus session, plus their linked comms tasks). The monthly
 * campus meeting reuses the same agenda framework as the weekly comms meeting,
 * so this mirrors `loadCommsAgendaGroups` but is scoped to one session and
 * returns a flat, position-ordered list (a campus session is a single meeting).
 */
export async function loadCampusSessionAgenda(
  supabase: SupabaseClient,
  sessionId: string
): Promise<AgendaItemRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: profilesData }, { data: agendaData }, { data: commsTaskData }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role, avatar_url'),
    db
      .from('comms_weekly_agenda_items')
      .select('id, meeting_date, title, summary, meeting_notes, owner_id, position, created_at')
      .eq('campus_session_id', sessionId)
      .order('position', { ascending: true })
      .limit(500),
    db.from('comms_tasks').select('id, title, description, owner_id, due_date, status, agenda_item_id').limit(500),
  ])

  const profiles = (profilesData ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null; avatar_url?: string | null }>
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const labelFor = (id: string | null) =>
    id ? profileMap.get(id)?.name ?? profileMap.get(id)?.email ?? 'Unknown' : null
  const roleFor = (id: string | null) => (id ? profileMap.get(id)?.role ?? null : null)
  const avatarFor = (id: string | null) => (id ? profileMap.get(id)?.avatar_url ?? null : null)

  const agendaRows = (agendaData ?? []) as Array<{
    id: string
    meeting_date: string
    title: string
    summary: string | null
    meeting_notes: string | null
    owner_id: string | null
    position: number | null
    created_at: string
  }>
  const agendaTitleById = new Map(agendaRows.map((r) => [r.id, r.title]))

  const tasks: CommsTaskRecord[] = ((commsTaskData ?? []) as Array<{
    id: string
    title: string
    description: string | null
    owner_id: string | null
    due_date: string | null
    status: string
    agenda_item_id: string | null
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    dueDate: row.due_date,
    status: normalizeCommsTaskStatus(row.status),
    agendaItemId: row.agenda_item_id,
    agendaItemTitle: row.agenda_item_id ? agendaTitleById.get(row.agenda_item_id) ?? null : null,
  }))

  const linkedTasksByAgenda = new Map<string, CommsTaskRecord[]>()
  for (const task of tasks) {
    if (!task.agendaItemId) continue
    const list = linkedTasksByAgenda.get(task.agendaItemId) ?? []
    list.push(task)
    linkedTasksByAgenda.set(task.agendaItemId, list)
  }

  return agendaRows
    .map((row) => ({
      id: row.id,
      meetingDate: row.meeting_date,
      title: row.title,
      summary: row.summary,
      meetingNotes: row.meeting_notes,
      ownerId: row.owner_id,
      ownerLabel: labelFor(row.owner_id),
      ownerRole: roleFor(row.owner_id),
      ownerAvatarUrl: avatarFor(row.owner_id),
      position: row.position ?? 0,
      createdAt: row.created_at,
      linkedTasks: linkedTasksByAgenda.get(row.id) ?? [],
    }))
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

/**
 * Loads the standard checklist tasks tied to a single campus meeting (the
 * comms_tasks seeded with this session's `campus_session_id`). Returns them in
 * creation order with resolved owner labels/roles so the meeting page can show
 * status and reassign the owner.
 */
export async function loadCampusMeetingTasks(
  supabase: SupabaseClient,
  sessionId: string
): Promise<CommsTaskRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: profilesData }, { data: taskData }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role'),
    db
      .from('comms_tasks')
      .select('id, title, description, owner_id, due_date, status, agenda_item_id')
      .eq('campus_session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  const profiles = (profilesData ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const labelFor = (id: string | null) =>
    id ? profileMap.get(id)?.name ?? profileMap.get(id)?.email ?? 'Unknown' : null
  const roleFor = (id: string | null) => (id ? profileMap.get(id)?.role ?? null : null)

  return ((taskData ?? []) as Array<{
    id: string
    title: string
    description: string | null
    owner_id: string | null
    due_date: string | null
    status: string
    agenda_item_id: string | null
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerLabel: labelFor(row.owner_id),
    ownerRole: roleFor(row.owner_id),
    dueDate: row.due_date,
    status: normalizeCommsTaskStatus(row.status),
    agendaItemId: row.agenda_item_id,
    agendaItemTitle: null,
  }))
}

/**
 * Comms-workspace members, for assigning task owners outside the full team
 * dashboard load (e.g. the monthly campus meeting agenda).
 */
export async function loadCommsTeamMembers(supabase: SupabaseClient): Promise<TeamMemberOption[]> {
  const { data } = await supabase.from('profiles').select('id, name, email, role')
  const profiles = (data ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>
  return profiles
    .filter((p) => canAccessCommsWorkspace(p.role))
    .map((p) => ({ id: p.id, label: p.name ?? p.email ?? 'Unknown', role: p.role }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
