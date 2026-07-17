import type { DashboardDefinition, DashboardId, DashboardTileSize } from './types'

const SIZES = ['compact', 'standard', 'wide'] as const satisfies readonly DashboardTileSize[]
const STANDARD_WIDE = ['standard', 'wide'] as const satisfies readonly DashboardTileSize[]

export const DASHBOARD_CATALOG: Record<DashboardId, DashboardDefinition> = {
  'comms-personal': {
    id: 'comms-personal',
    version: 1,
    title: 'My communications dashboard',
    defaultSplitRatio: 0.64,
    widgets: [
      { id: 'my-tasks', title: 'My tasks', defaultZone: 'primary', defaultSize: 'wide', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'incoming-review', title: 'Incoming for review', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: SIZES },
      { id: 'project-summaries', title: 'Project summaries', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'recent-decisions', title: 'Recent decisions', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, defaultCollapsed: true },
      { id: 'shortcuts', title: 'Shortcuts', defaultZone: 'supporting', defaultSize: 'compact', allowedSizes: SIZES },
    ],
  },
  'comms-team': {
    id: 'comms-team',
    version: 1,
    title: 'Communications team dashboard',
    defaultSplitRatio: 0.66,
    widgets: [
      { id: 'team-tasks', title: 'Team tasks', defaultZone: 'primary', defaultSize: 'wide', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'meeting-agenda', title: 'Bi-weekly meeting', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'field-newsfeed', title: 'Field Newsfeed', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'new-members', title: 'New members', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'events', title: 'Events', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, defaultCollapsed: true },
      { id: 'whatsapp-channels', title: 'WhatsApp channels', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, defaultCollapsed: true },
      { id: 'update-feed', title: 'Update feed', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, defaultCollapsed: true },
    ],
  },
  admin: {
    id: 'admin',
    version: 1,
    title: 'Admin dashboard',
    defaultSplitRatio: 0.64,
    widgets: [
      { id: 'my-tasks', title: 'My tasks', defaultZone: 'primary', defaultSize: 'wide', allowedSizes: STANDARD_WIDE },
      { id: 'needs-attention', title: 'Needs attention', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'people-access', title: 'People & access', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'activity-engagement', title: 'Activity & engagement', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, defaultCollapsed: true },
      { id: 'system-health', title: 'System health', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, required: true },
    ],
  },
  coordinator: {
    id: 'coordinator',
    version: 1,
    title: 'Coordinator dashboard',
    defaultSplitRatio: 0.7,
    widgets: [
      { id: 'initiative-health', title: 'Initiative health', defaultZone: 'primary', defaultSize: 'wide', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'inactivity-alerts', title: 'Inactivity alerts', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'portfolio-alerts', title: 'Portfolio alerts', defaultZone: 'supporting', defaultSize: 'compact', allowedSizes: SIZES },
      { id: 'field-newsfeed', title: 'Field Newsfeed', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
    ],
  },
  advocate: {
    id: 'advocate',
    version: 1,
    title: 'Dashboard',
    defaultSplitRatio: 0.64,
    widgets: [
      { id: 'my-tasks', title: 'My tasks', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'my-initiatives', title: 'My initiatives', defaultZone: 'primary', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
      { id: 'field-newsfeed', title: 'Field Newsfeed', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
    ],
  },
  board: {
    id: 'board',
    version: 1,
    title: 'Board dashboard',
    defaultSplitRatio: 0.7,
    widgets: [
      { id: 'portfolio-overview', title: 'Portfolio overview', defaultZone: 'primary', defaultSize: 'wide', allowedSizes: STANDARD_WIDE, required: true },
      { id: 'portfolio-risks', title: 'Portfolio risks', defaultZone: 'supporting', defaultSize: 'compact', allowedSizes: SIZES },
      { id: 'field-newsfeed', title: 'Field Newsfeed', defaultZone: 'supporting', defaultSize: 'standard', allowedSizes: STANDARD_WIDE },
    ],
  },
}

export function getDashboardDefinition(id: DashboardId): DashboardDefinition {
  return DASHBOARD_CATALOG[id]
}

export function isDashboardId(value: string): value is DashboardId {
  return Object.prototype.hasOwnProperty.call(DASHBOARD_CATALOG, value)
}
