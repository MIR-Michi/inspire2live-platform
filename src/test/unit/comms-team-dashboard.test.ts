import { describe, expect, it } from 'vitest'
import {
  normalizeCalendarStatus,
  normalizeEventStage,
  normalizeTaskStatus,
  normalizeAgendaStatus,
  UNIFIED_STATUS_META,
} from '@/lib/comms-status'
import { getNextMeetingDate, groupAgendaByMeeting, type AgendaItemRecord } from '@/lib/comms-agenda'

describe('unified status normaliser', () => {
  it('maps calendar statuses to the shared taxonomy', () => {
    expect(normalizeCalendarStatus('draft')).toBe('not_started')
    expect(normalizeCalendarStatus('in_review')).toBe('in_progress')
    expect(normalizeCalendarStatus('scheduled')).toBe('in_progress')
    expect(normalizeCalendarStatus('published')).toBe('completed')
    expect(normalizeCalendarStatus('archived')).toBe('skipped')
    expect(normalizeCalendarStatus(null)).toBe('not_started')
  })

  it('maps event stages to the shared taxonomy', () => {
    expect(normalizeEventStage('announced')).toBe('not_started')
    expect(normalizeEventStage('attending')).toBe('in_progress')
    expect(normalizeEventStage('in_progress')).toBe('in_progress')
    expect(normalizeEventStage('post_event')).toBe('completed')
    expect(normalizeEventStage('archived')).toBe('skipped')
  })

  it('maps task and agenda statuses', () => {
    expect(normalizeTaskStatus('done')).toBe('completed')
    expect(normalizeTaskStatus('todo')).toBe('not_started')
    expect(normalizeTaskStatus('cancelled')).toBe('skipped')
    expect(normalizeAgendaStatus('in_progress')).toBe('in_progress')
    expect(normalizeAgendaStatus('nonsense')).toBe('not_started')
  })

  it('distinguishes completed (tick) from skipped (dash)', () => {
    expect(UNIFIED_STATUS_META.completed.marker).toBe('✓')
    expect(UNIFIED_STATUS_META.skipped.marker).toBe('–')
  })
})

describe('weekly agenda helpers', () => {
  it('returns a Monday as the next meeting date', () => {
    // 2026-06-07 is a Sunday → next Monday is 2026-06-08.
    expect(getNextMeetingDate(new Date('2026-06-07T12:00:00Z'))).toBe('2026-06-08')
    // On the Monday itself it stays the same day.
    expect(getNextMeetingDate(new Date('2026-06-08T09:00:00Z'))).toBe('2026-06-08')
  })

  it('groups items by meeting and always surfaces the upcoming meeting', () => {
    const now = new Date('2026-06-07T12:00:00Z')
    const items: AgendaItemRecord[] = [
      {
        id: '1',
        meetingDate: '2026-06-01',
        title: 'Past topic',
        summary: null,
        ownerId: 'a',
        ownerLabel: 'Ana',
        ownerRole: 'Comms',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ]
    const groups = groupAgendaByMeeting(items, now)
    // Upcoming meeting (2026-06-08) is present even with no items.
    const upcoming = groups.find((g) => g.isUpcoming)
    expect(upcoming?.meetingDate).toBe('2026-06-08')
    expect(upcoming?.items).toHaveLength(0)
    // Newest meeting first.
    expect(groups[0].meetingDate).toBe('2026-06-08')
    expect(groups.some((g) => g.meetingDate === '2026-06-01')).toBe(true)
  })
})
