/**
 * Comms team & personal dashboard data loaders — unit tests
 *
 * Verifies that the loaders assemble channels, feed entries, project
 * summaries and decisions correctly from mocked Supabase query results.
 * No real DB connection; all `.from()` calls resolve canned rows.
 */
import { describe, it, expect, vi } from 'vitest'
import { loadCommsTeamDashboardData } from '@/lib/comms-dashboard-data'
import { loadCommsPersonalDashboardData } from '@/lib/comms-personal-dashboard-data'

// ─── Shared mock query builder ───────────────────────────────────────────────

function queryBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'not', 'order', 'limit', 'gte', 'lt']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.then = (onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
  return builder
}

function buildSupabase(tables: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => queryBuilder(tables[table] ?? [])),
  }
}

vi.mock('@/lib/comms-event-pipeline', () => ({
  loadCommsEventPipelineData: vi.fn().mockResolvedValue({
    events: [
      {
        id: 'ev1',
        name: 'Big Conference',
        owner_id: 'u1',
        ownerLabel: 'Ana',
        stage: 'attending',
        start_date: '2026-06-15',
      },
    ],
  }),
}))

// ─── loadCommsTeamDashboardData ──────────────────────────────────────────────

describe('loadCommsTeamDashboardData', () => {
  const profiles = [
    { id: 'u1', name: 'Ana', email: 'ana@x.com', user_type: 'comms' },
    { id: 'u2', name: null, email: 'bob@x.com', user_type: 'comms' },
  ]
  const intakeItems = [
    { id: 'i1', sender_name: 'Alice', raw_content: 'Hello   world\n\nthis is a message', channel: 'campus', status: 'unreviewed', captured_at: '2026-06-01T10:00:00Z' },
    { id: 'i2', sender_name: 'Bob', raw_content: 'A'.repeat(200), channel: 'communications', status: 'unreviewed', captured_at: '2026-06-02T10:00:00Z' },
    { id: 'i3', sender_name: 'Carl', raw_content: 'Reviewed already', channel: null, status: 'reviewed', captured_at: '2026-06-03T10:00:00Z' },
  ]
  const contentRows = [
    { id: 'c1', title: 'Blog post', status: 'scheduled', scheduled_at: '2026-06-10', author_id: 'u1' },
  ]
  const taskRows = [
    { id: 't1', title: 'Write report', status: 'todo', due_date: '2026-06-05', initiative_id: 'init1', assignee_id: 'u2' },
  ]
  const campusRows = [
    { id: 'cs1', session_date: '2024-01-01', theme: 'Old session', summary: null },
  ]
  const crmRows = [
    { id: 'cr1', full_name: 'Donor Dana', lifecycle_stage: 'engaged', next_follow_up_at: '2026-06-20', relationship_owner_id: 'u1' },
  ]
  const agendaRows = [
    { id: 'ag1', meeting_date: '2026-06-08', title: 'Plan launch', summary: 'Discuss launch plan', owner_id: 'u1', status: 'in_progress', created_at: '2026-06-01T09:00:00Z' },
  ]

  const supabase = buildSupabase({
    profiles,
    intake_items: intakeItems,
    content_calendar: contentRows,
    tasks: taskRows,
    campus_sessions: campusRows,
    comms_crm_contacts: crmRows,
    comms_weekly_agenda_items: agendaRows,
  })

  it('groups WhatsApp intake items by channel and summarises long messages', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsTeamDashboardData(supabase as any)

    const campus = data.channels.find((c) => c.key === 'campus')
    const communications = data.channels.find((c) => c.key === 'communications')

    // i1 (channel: 'campus') and i3 (channel: null → falls back to 'campus').
    expect(campus?.recent.map((r) => r.id)).toEqual(['i1', 'i3'])
    // Only i1 is still 'unreviewed' (i3 has been reviewed).
    expect(campus?.waitingCount).toBe(1)

    // i2 is the sole 'communications' item, and is still unreviewed.
    expect(communications?.recent.map((r) => r.id)).toEqual(['i2'])
    expect(communications?.waitingCount).toBe(1)
    // Long raw_content is collapsed and truncated with an ellipsis at 120 chars.
    expect(communications?.recent[0].summary).toBe(`${'A'.repeat(119)}…`)
    // Whitespace in short messages is collapsed to single spaces.
    expect(campus?.recent[0].summary).toBe('Hello world this is a message')
  })

  it('builds a deadline-sorted feed spanning content, tasks, events, campus, CRM and agenda', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsTeamDashboardData(supabase as any)

    // Sorted ascending by date: campus (2024) < task (06-05) < agenda (06-08)
    // < content (06-10) < event (06-15) < CRM (06-20).
    expect(data.feed.map((entry) => entry.id)).toEqual([
      'campus-cs1',
      'task-t1',
      'agenda-ag1',
      'content-c1',
      'event-ev1',
      'crm-cr1',
    ])

    const content = data.feed.find((e) => e.id === 'content-c1')
    expect(content).toMatchObject({
      kind: 'content',
      title: 'Blog post',
      ownerLabel: 'Ana',
      ownerUserType: 'comms',
      status: 'in_progress',
      href: '/app/comms/planner',
    })

    const task = data.feed.find((e) => e.id === 'task-t1')
    expect(task).toMatchObject({
      kind: 'task',
      ownerLabel: 'bob@x.com', // profile has no `name`, falls back to email
      status: 'not_started',
      href: '/app/initiatives/init1/tasks',
    })

    const event = data.feed.find((e) => e.id === 'event-ev1')
    expect(event).toMatchObject({
      kind: 'event',
      title: 'Big Conference',
      ownerLabel: 'Ana',
      status: 'in_progress',
      href: '/app/comms/events/ev1',
    })

    // Past campus session is rendered as completed work.
    const campus = data.feed.find((e) => e.id === 'campus-cs1')
    expect(campus).toMatchObject({
      kind: 'campus',
      title: 'Old session',
      status: 'completed',
      href: '/app/comms/campus/2024/1',
    })

    const crm = data.feed.find((e) => e.id === 'crm-cr1')
    expect(crm).toMatchObject({
      kind: 'crm',
      title: 'Follow up with Donor Dana',
      ownerLabel: 'Ana',
      status: 'in_progress',
      href: '/app/comms/crm',
    })
  })

  it('groups weekly agenda items and surfaces them in the feed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsTeamDashboardData(supabase as any)

    const agendaEntry = data.feed.find((e) => e.id === 'agenda-ag1')
    expect(agendaEntry).toMatchObject({
      kind: 'agenda',
      title: 'Plan launch',
      ownerLabel: 'Ana',
      status: 'in_progress',
      href: '/app/comms/dashboard?view=team',
    })

    const group = data.agendaGroups.find((g) => g.items.some((item) => item.id === 'ag1'))
    expect(group?.items[0]).toMatchObject({ title: 'Plan launch', summary: 'Discuss launch plan', ownerLabel: 'Ana' })
  })

  it('collects unique feed owners sorted by label', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsTeamDashboardData(supabase as any)

    expect(data.owners).toEqual([
      { id: 'u1', label: 'Ana', userType: 'comms' },
      { id: 'u2', label: 'bob@x.com', userType: 'comms' },
    ])
  })
})

// ─── loadCommsPersonalDashboardData ──────────────────────────────────────────

describe('loadCommsPersonalDashboardData', () => {
  const campusRows = [
    {
      id: 'cs1',
      session_date: '2026-05-01',
      theme: 'May session',
      summary: 'Notes',
      decisions_for_publication: ['Decision: Launch campaign | Owner: Ana', 'Just a note without owner'],
    },
  ]
  const eventRows = [
    { id: 'ev1', name: 'Networking night', start_date: '2026-06-20', location_city: 'Berlin', location_country: 'Germany', notes: null },
  ]
  const taskRows = [
    { id: 't1', title: 'Draft post', status: 'todo', priority: 'high', due_date: '2026-06-10', initiative_id: 'init1' },
  ]
  const contentRows = [
    { id: 'c1', title: 'Newsletter', status: 'draft', scheduled_at: '2026-06-12', source_link: null },
  ]
  const incomingRows = [
    { id: 'i1', sender_name: 'Eve', content_type: 'whatsapp', raw_content: 'msg', source_url: null, captured_at: '2026-06-01T08:00:00Z' },
  ]

  const supabase = buildSupabase({
    tasks: taskRows,
    content_calendar: contentRows,
    intake_items: incomingRows,
    campus_sessions: campusRows,
    events: eventRows,
  })

  it('passes through assignee-scoped tasks, content and incoming items as-is', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsPersonalDashboardData(supabase as any, 'user-1')

    expect(data.tasks).toEqual(taskRows)
    expect(data.contentItems).toEqual(contentRows)
    expect(data.incomingItems).toEqual(incomingRows)
  })

  it('builds project summaries from campus sessions and upcoming events', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsPersonalDashboardData(supabase as any, 'user-1')

    const campusDate = new Date('2026-05-01')
    const campusHref = `/app/comms/campus/${campusDate.getFullYear()}/${campusDate.getMonth() + 1}`

    expect(data.projectSummaries).toEqual([
      { id: 'campus-cs1', title: 'May session', summary: 'Notes', href: campusHref, label: 'Campus' },
      {
        id: 'event-ev1',
        title: 'Networking night',
        summary: 'Berlin, Germany',
        href: '/app/comms/events/ev1',
        label: 'Event',
      },
    ])
  })

  it('parses campus decisions into decision/owner pairs, defaulting to Unassigned', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await loadCommsPersonalDashboardData(supabase as any, 'user-1')

    const campusDate = new Date('2026-05-01')
    const campusHref = `/app/comms/campus/${campusDate.getFullYear()}/${campusDate.getMonth() + 1}`

    expect(data.decisions).toEqual([
      { id: 'cs1-0', decision: 'Launch campaign', owner: 'Ana', href: campusHref, meeting: 'May session' },
      { id: 'cs1-1', decision: 'Just a note without owner', owner: 'Unassigned', href: campusHref, meeting: 'May session' },
    ])
  })
})
