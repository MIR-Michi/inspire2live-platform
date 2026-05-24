import { normalizeUserType, type UserType } from '@/lib/user-workspace'

export type DashboardQueryId =
  | 'initiative_health'
  | 'member_activity'
  | 'notifications'
  | 'comms_today'
  | 'comms_week'
  | 'comms_attention'
  | 'comms_ready'

export type DashboardBlockId =
  | 'role_summary'
  | 'notifications'
  | 'newsfeed'
  | 'whats_up_today'
  | 'this_week'
  | 'needs_attention'
  | 'content_ready'

export type DashboardConfig = {
  userType: UserType
  title: string
  subtitle: string
  blocks: DashboardBlockId[]
  queries: DashboardQueryId[]
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  userType: 'default',
  title: 'Dashboard',
  subtitle: 'Your platform overview and next actions.',
  blocks: ['role_summary', 'notifications', 'newsfeed'],
  queries: ['initiative_health', 'member_activity', 'notifications'],
}

const COMMS_DASHBOARD_CONFIG: DashboardConfig = {
  userType: 'comms',
  title: 'Comms dashboard',
  subtitle: 'Today, this week, attention queue, and content ready for review.',
  blocks: ['whats_up_today', 'this_week', 'needs_attention', 'content_ready', 'notifications'],
  queries: ['comms_today', 'comms_week', 'comms_attention', 'comms_ready', 'notifications'],
}

export function getDashboardConfig(userType: string | null | undefined): DashboardConfig {
  const normalized = normalizeUserType(userType)
  if (normalized === 'comms') return COMMS_DASHBOARD_CONFIG
  return { ...DEFAULT_DASHBOARD_CONFIG, userType: normalized }
}

