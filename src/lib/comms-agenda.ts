/**
 * lib/comms-agenda.ts
 *
 * Helpers for the weekly meeting agenda on the comms team dashboard.
 */

import type { CommsTaskRecord } from '@/lib/comms-tasks'

export type AgendaItemRecord = {
  id: string
  meetingDate: string // YYYY-MM-DD
  title: string
  summary: string | null
  meetingNotes: string | null
  ownerId: string | null
  ownerLabel: string | null
  ownerRole: string | null
  ownerAvatarUrl: string | null
  position: number
  createdAt: string
  linkedTasks: CommsTaskRecord[]
}

export type AgendaMeetingGroup = {
  meetingDate: string
  isUpcoming: boolean
  items: AgendaItemRecord[]
}

// The comms team meets weekly on Mondays. The agenda groups items by the
// meeting they belong to; new items default to the next upcoming meeting.
const MEETING_WEEKDAY = 1 // Monday (0 = Sunday)

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The date (YYYY-MM-DD) of the next upcoming weekly meeting, inclusive of today. */
export function getNextMeetingDate(from: Date = new Date()): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const day = date.getUTCDay()
  const offset = (MEETING_WEEKDAY - day + 7) % 7
  date.setUTCDate(date.getUTCDate() + offset)
  return toDateKey(date)
}

export function formatMeetingLabel(meetingDate: string): string {
  const date = new Date(`${meetingDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** Group agenda items by meeting date, newest meeting first, upcoming flagged. */
export function groupAgendaByMeeting(
  items: AgendaItemRecord[],
  now: Date = new Date()
): AgendaMeetingGroup[] {
  const upcoming = getNextMeetingDate(now)
  const byMeeting = new Map<string, AgendaItemRecord[]>()

  for (const item of items) {
    const list = byMeeting.get(item.meetingDate) ?? []
    list.push(item)
    byMeeting.set(item.meetingDate, list)
  }

  // Always show the upcoming meeting group, even if empty.
  if (!byMeeting.has(upcoming)) byMeeting.set(upcoming, [])

  return Array.from(byMeeting.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([meetingDate, groupItems]) => ({
      meetingDate,
      isUpcoming: meetingDate === upcoming,
      // Manual order (position) first; fall back to creation time for ties.
      items: groupItems.sort(
        (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
      ),
    }))
}
