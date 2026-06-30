import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { HEARTBEAT_SECONDS } from '@/lib/activity-spaces'

export type SpaceUsage = {
  space: string
  minutes: number
  pageviews: number
}

export type UserActivity = {
  userId: string
  name: string
  email: string | null
  role: string | null
  lastSeen: string | null
  activeDays: number
  activeMinutes: number
  pageviews: number
  spacesVisited: number
  perSpace: SpaceUsage[]
}

export type UserActivityResult = {
  users: UserActivity[]
  windowDays: number
  tracking: boolean
  totalActiveMinutes: number
  totalPageviews: number
}

type EventRow = { user_id: string; kind: string; space: string; occurred_at: string }

type Agg = {
  lastSeen: string | null
  days: Set<string>
  pageviews: number
  heartbeats: number
  spaceHeartbeats: Map<string, number>
  spacePageviews: Map<string, number>
}

function heartbeatsToMinutes(count: number): number {
  return Math.round((count * HEARTBEAT_SECONDS) / 60)
}

/**
 * Aggregates per-user engagement over the last `sinceDays`. Active minutes come
 * from heartbeats (which only fire while a user is genuinely active), so idle
 * logged-in time is excluded. Pageviews and the per-space breakdown show where
 * and how actively each user works on the platform.
 *
 * Reads go through the caller's (admin) client; the RLS admin-select policy on
 * user_activity_events grants visibility. Tolerates the table not existing yet
 * (returns tracking: false).
 */
export async function loadUserActivityMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  sinceDays = 30
): Promise<UserActivityResult> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .order('name')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eventData, error } = await (supabase as any)
    .from('user_activity_events')
    .select('user_id, kind, space, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(100_000)

  const tracking = !error
  const events = (eventData ?? []) as EventRow[]

  const byUser = new Map<string, Agg>()
  const ensure = (id: string): Agg => {
    let agg = byUser.get(id)
    if (!agg) {
      agg = { lastSeen: null, days: new Set(), pageviews: 0, heartbeats: 0, spaceHeartbeats: new Map(), spacePageviews: new Map() }
      byUser.set(id, agg)
    }
    return agg
  }

  for (const row of events) {
    if (!row.user_id) continue
    const agg = ensure(row.user_id)
    if (!agg.lastSeen || row.occurred_at > agg.lastSeen) agg.lastSeen = row.occurred_at
    agg.days.add(row.occurred_at.slice(0, 10))
    const space = row.space || 'Other'
    if (row.kind === 'heartbeat') {
      agg.heartbeats += 1
      agg.spaceHeartbeats.set(space, (agg.spaceHeartbeats.get(space) ?? 0) + 1)
    } else {
      agg.pageviews += 1
      agg.spacePageviews.set(space, (agg.spacePageviews.get(space) ?? 0) + 1)
    }
  }

  const profileRows = (profiles ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>

  const users: UserActivity[] = profileRows.map((profile) => {
    const agg = byUser.get(profile.id)
    const spaces = new Set<string>([
      ...(agg ? agg.spaceHeartbeats.keys() : []),
      ...(agg ? agg.spacePageviews.keys() : []),
    ])
    const perSpace: SpaceUsage[] = [...spaces]
      .map((space) => ({
        space,
        minutes: heartbeatsToMinutes(agg?.spaceHeartbeats.get(space) ?? 0),
        pageviews: agg?.spacePageviews.get(space) ?? 0,
      }))
      .sort((a, b) => b.minutes - a.minutes || b.pageviews - a.pageviews)

    return {
      userId: profile.id,
      name: profile.name ?? profile.email ?? 'Unknown',
      email: profile.email,
      role: profile.role,
      lastSeen: agg?.lastSeen ?? null,
      activeDays: agg?.days.size ?? 0,
      activeMinutes: heartbeatsToMinutes(agg?.heartbeats ?? 0),
      pageviews: agg?.pageviews ?? 0,
      spacesVisited: spaces.size,
      perSpace,
    }
  })

  users.sort((a, b) => b.activeMinutes - a.activeMinutes || b.pageviews - a.pageviews)

  return {
    users,
    windowDays: sinceDays,
    tracking,
    totalActiveMinutes: users.reduce((sum, u) => sum + u.activeMinutes, 0),
    totalPageviews: users.reduce((sum, u) => sum + u.pageviews, 0),
  }
}
