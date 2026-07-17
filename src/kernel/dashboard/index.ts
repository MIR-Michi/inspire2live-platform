export type {
  DashboardId,
  DashboardZone,
  DashboardTileSize,
  DashboardPreset,
  DashboardDensity,
  DashboardWidgetDefinition,
  DashboardDefinition,
  DashboardWidgetLayout,
  DashboardLayoutState,
  DashboardWidgetContent,
  DashboardPreferenceRow,
  DashboardDesignConfig,
} from './types'
export { DEFAULT_DASHBOARD_DESIGN } from './types'
export { DASHBOARD_CATALOG, getDashboardDefinition, isDashboardId } from './catalog'
export {
  buildDefaultDashboardLayout,
  sanitizeDashboardLayout,
  validateDashboardLayout,
  moveDashboardWidget,
  resolveDashboardDropIndex,
  updateDashboardWidget,
  applyDashboardPreset,
  dashboardLayoutsEqual,
  clampDashboardSplit,
} from './layout'
export { loadDashboardLayout, saveDashboardLayout, resetDashboardLayout } from './repository'
export { resolveDashboardDesignConfig } from './design'
