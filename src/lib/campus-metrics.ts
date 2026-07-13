import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { deriveMeetingWindow } from '@/modules/ai-features/domain/whatsapp-feed-categorization'

type AppSupabaseClient = SupabaseClient<Database>

export type MeetingWindow = { start: string | null; end: string }

/**
 * Canonical "campus incoming" definition, in one place so the nav badge, the
 * Campus overview cards, and the month-detail header can never drift again:
 * unreviewed intake on the `campus` channel, within a meeting's window.
 */

/** Convert a `{start,end}` date window into the ISO bounds used for counting. */
export function campusWindowIso(window: MeetingWindow): { startIso?: string; endIso: string } {
  return {
    startIso: window.start ? `${window.start}T00:00:00.000Z` : undefined,
    endIso: `${window.end}T23:59:59.999Z`,
  }
}

/** True when `capturedAt` falls in the window (start inclusive, end-of-day inclusive). */
export function isWithinWindow(capturedAt: string, window: MeetingWindow): boolean {
  const t = new Date(capturedAt).getTime()
  if (Number.isNaN(t)) return false
  const end = new Date(`${window.end}T23:59:59.999Z`).getTime()
  if (t > end) return false
  if (window.start) return t >= new Date(`${window.start}T00:00:00.000Z`).getTime()
  return true
}

/**
 * The meeting whose window is currently "open": the earliest session on/after
 * today (the upcoming/current meeting), or the most recent past one if none is
 * upcoming. Pure — unit-tested.
 */
export function resolveCurrentMeetingDate(sessionDates: Array<string | null | undefined>, today: Date = new Date()): string | null {
  const valid = sessionDates
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter((d) => d.length > 0 && !Number.isNaN(new Date(d).getTime()))
  if (valid.length === 0) return null
  // Compare by calendar day (ISO date strings sort lexically) so a meeting
  // scheduled *today* counts as current even though its stored time is midnight.
  const todayStr = today.toISOString().slice(0, 10)
  const dayOf = (d: string) => d.slice(0, 10)
  const upcoming = valid.filter((d) => dayOf(d) >= todayStr).sort((a, b) => dayOf(a).localeCompare(dayOf(b)))
  if (upcoming.length > 0) return upcoming[0]
  return valid.sort((a, b) => dayOf(b).localeCompare(dayOf(a)))[0]
}

/** Exact count of unreviewed campus-channel intake within an ISO window. No cap. */
export async function countCampusIncoming(
  supabase: AppSupabaseClient,
  iso: { startIso?: string; endIso: string }
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('intake_items')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'campus')
    .eq('status', 'unreviewed')
    .lt('captured_at', iso.endIso)
  if (iso.startIso) query = query.gte('captured_at', iso.startIso)
  const { count } = await query
  return count ?? 0
}

/**
 * Incoming count for the current/next campus meeting — the number the nav badge
 * shows. Resolves the open meeting, derives its window, and counts. Returns 0
 * when there is no meeting.
 */
export async function countCurrentCampusIncoming(supabase: AppSupabaseClient): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('campus_sessions')
    .select('session_date')
    .order('session_date', { ascending: false })
    .limit(24)
  const dates = ((data ?? []) as Array<{ session_date: string | null }>).map((r) => r.session_date)
  const meetingDate = resolveCurrentMeetingDate(dates)
  if (!meetingDate) return 0
  const window = deriveMeetingWindow(dates, meetingDate)
  if (!window) return 0
  return countCampusIncoming(supabase, campusWindowIso(window))
}
