import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { HEARTBEAT_SECONDS } from '@/lib/activity-spaces'
import { createAdminClient } from '@/lib/supabase/admin'

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
  // Backfilled from data that predates activity tracking.
  loginCount: number
  lastLogin: string | null
  actionCount: number
  lastAction: string | null
}

export type UserActivityResult = {
  users: UserActivity[]
  windowDays: number
  tracking: boolean
  totalActiveMinutes: number
  totalPageviews: number
  totalLogins: number
  totalActions: number
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

  // ── Backfill: logins (auth audit log) + actions (existing activity logs) ──
  // These predate activity tracking, so they give the view real history now.
  const loginByUser = new Map<string, { count: number; last: string | null }>()
  try {
    // RPC runs as the calling admin (auth.uid()), enforced inside the function.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: loginRows } = await (supabase as any).rpc('admin_user_login_stats', { since })
    for (const row of (loginRows ?? []) as Array<{ user_id: string; login_count: number; last_login: string | null }>) {
      if (!row.user_id) continue
      loginByUser.set(row.user_id, { count: Number(row.login_count) || 0, last: row.last_login ?? null })
    }
  } catch {
    // function not present yet (migration 00107) — degrade silently
  }

  const actionByUser = new Map<string, { count: number; last: string | null }>()
  try {
    const admin = createAdminClient() // service role: bypasses RLS to see all logs
    const addActions = (rows: Array<{ actor_id: string | null; created_at: string }> | null | undefined) => {
      for (const row of rows ?? []) {
        if (!row.actor_id) continue
        const cur = actionByUser.get(row.actor_id) ?? { count: 0, last: null }
        cur.count += 1
        if (!cur.last || row.created_at > cur.last) cur.last = row.created_at
        actionByUser.set(row.actor_id, cur)
      }
    }
    const [initiativeActions, congressActions] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('activity_log').select('actor_id, created_at').gte('created_at', since).limit(100_000),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from('congress_activity_log').select('actor_id, created_at').gte('created_at', since).limit(100_000),
    ])
    addActions(initiativeActions.data)
    addActions(congressActions.data)
  } catch {
    // service role not configured / tables absent — degrade silently
  }

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

    const login = loginByUser.get(profile.id)
    const action = actionByUser.get(profile.id)

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
      loginCount: login?.count ?? 0,
      lastLogin: login?.last ?? null,
      actionCount: action?.count ?? 0,
      lastAction: action?.last ?? null,
    }
  })

  // Most recently engaged first (login, in-app presence, or a recorded action).
  const lastEngagedMs = (u: UserActivity) =>
    Math.max(
      u.lastLogin ? Date.parse(u.lastLogin) : 0,
      u.lastSeen ? Date.parse(u.lastSeen) : 0,
      u.lastAction ? Date.parse(u.lastAction) : 0
    )
  users.sort((a, b) => lastEngagedMs(b) - lastEngagedMs(a))

  return {
    users,
    windowDays: sinceDays,
    tracking,
    totalActiveMinutes: users.reduce((sum, u) => sum + u.activeMinutes, 0),
    totalPageviews: users.reduce((sum, u) => sum + u.pageviews, 0),
    totalLogins: users.reduce((sum, u) => sum + u.loginCount, 0),
    totalActions: users.reduce((sum, u) => sum + u.actionCount, 0),
  }
}
