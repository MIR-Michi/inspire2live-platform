/**
 * Shared activity-tracking constants and path → space mapping. Used by the
 * client tracker (to label events) and the admin aggregation (to group them).
 */

/** Heartbeat cadence; also the seconds of "active time" each heartbeat represents. */
export const HEARTBEAT_SECONDS = 20

export const ACTIVITY_KINDS = ['pageview', 'heartbeat'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

const SPACE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  comms: 'Communications',
  congress: 'Congress',
  initiatives: 'Initiatives',
  conferences: 'Conferences',
  podcast: 'Podcast',
  events: 'Events',
  network: 'Network',
  board: 'Board',
  tasks: 'Tasks',
  partners: 'Partners',
  resources: 'Resources',
  library: 'Library',
  notifications: 'Notifications',
  profile: 'Profile',
  admin: 'Admin',
}

/** Maps an app pathname to a coarse, human-readable "space" label. */
export function spaceFromPath(path: string): string {
  const clean = (path || '').split('?')[0].split('#')[0]
  const segments = clean.split('/').filter(Boolean) // e.g. ['app', 'comms', 'campus']
  if (segments[0] !== 'app') return 'Other'
  const key = segments[1]
  if (!key) return 'Dashboard'
  return SPACE_LABELS[key] ?? `${key.charAt(0).toUpperCase()}${key.slice(1)}`
}
