import type { ReactNode } from 'react'

export type DashboardId =
  | 'comms-personal'
  | 'comms-team'
  | 'admin'
  | 'coordinator'
  | 'advocate'
  | 'board'

export type DashboardZone = 'primary' | 'supporting'
export type DashboardTileSize = 'compact' | 'standard' | 'wide'
export type DashboardPreset = 'balanced' | 'focus' | 'overview'
export type DashboardDensity = 'comfortable' | 'compact'

export type DashboardWidgetDefinition = {
  id: string
  title: string
  defaultZone: DashboardZone
  defaultSize: DashboardTileSize
  allowedSizes: readonly DashboardTileSize[]
  required?: boolean
  defaultCollapsed?: boolean
}

export type DashboardDefinition = {
  id: DashboardId
  version: number
  title: string
  defaultSplitRatio: number
  widgets: readonly DashboardWidgetDefinition[]
}

export type DashboardWidgetLayout = {
  id: string
  zone: DashboardZone
  order: number
  size: DashboardTileSize
  visible: boolean
  collapsed: boolean
}

export type DashboardLayoutState = {
  version: number
  splitRatio: number
  preset: DashboardPreset
  density: DashboardDensity
  widgets: DashboardWidgetLayout[]
}

export type DashboardWidgetContent = {
  id: string
  content: ReactNode
  /** Optional header action rendered beside the widget title. */
  actions?: ReactNode
}

export type DashboardPreferenceRow = {
  user_id: string
  dashboard_id: string
  layout_version: number
  layout: DashboardLayoutState
  created_at: string
  updated_at: string
}

export type DashboardDesignConfig = {
  density: DashboardDensity
  radius: 'crisp' | 'rounded' | 'soft'
  elevation: 'minimal' | 'subtle' | 'layered'
  motion: 'calm' | 'balanced' | 'expressive'
  taskCelebration: boolean
  defaultPreset: DashboardPreset
  defaultSplitRatio: number
}

export const DEFAULT_DASHBOARD_DESIGN: DashboardDesignConfig = {
  density: 'comfortable',
  radius: 'rounded',
  elevation: 'subtle',
  motion: 'balanced',
  taskCelebration: true,
  defaultPreset: 'balanced',
  defaultSplitRatio: 0.64,
}
