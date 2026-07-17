import type {
  DashboardDefinition,
  DashboardDensity,
  DashboardLayoutState,
  DashboardPreset,
  DashboardTileSize,
  DashboardWidgetLayout,
  DashboardZone,
} from './types'

const MIN_SPLIT = 0.42
const MAX_SPLIT = 0.78

export function clampDashboardSplit(value: number): number {
  if (!Number.isFinite(value)) return 0.64
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value))
}

export function buildDefaultDashboardLayout(
  definition: DashboardDefinition,
  options?: { preset?: DashboardPreset; splitRatio?: number; density?: DashboardDensity },
): DashboardLayoutState {
  const preset = options?.preset ?? 'balanced'
  const density = options?.density ?? 'comfortable'
  const splitRatio = clampDashboardSplit(options?.splitRatio ?? definition.defaultSplitRatio)
  const byZone: Record<DashboardZone, number> = { primary: 0, supporting: 0 }

  return {
    version: definition.version,
    splitRatio,
    preset,
    density,
    widgets: definition.widgets.map((widget) => ({
      id: widget.id,
      zone: widget.defaultZone,
      order: byZone[widget.defaultZone]++,
      size: widget.defaultSize,
      visible: true,
      collapsed: Boolean(widget.defaultCollapsed),
    })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isZone(value: unknown): value is DashboardZone {
  return value === 'primary' || value === 'supporting'
}

function isSize(value: unknown): value is DashboardTileSize {
  return value === 'compact' || value === 'standard' || value === 'wide'
}

function isPreset(value: unknown): value is DashboardPreset {
  return value === 'balanced' || value === 'focus' || value === 'overview'
}

function isDensity(value: unknown): value is DashboardDensity {
  return value === 'comfortable' || value === 'compact'
}

function normalizeOrders(widgets: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
  const result: DashboardWidgetLayout[] = []
  for (const zone of ['primary', 'supporting'] as const) {
    widgets
      .filter((widget) => widget.zone === zone)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .forEach((widget, order) => result.push({ ...widget, order }))
  }
  return result
}

/**
 * Merge an untrusted stored layout with the current dashboard definition.
 * Unknown/duplicate widgets are discarded, new widgets are appended, and all
 * role/default constraints remain authoritative.
 */
export function sanitizeDashboardLayout(
  definition: DashboardDefinition,
  input: unknown,
  fallbackOptions?: { preset?: DashboardPreset; splitRatio?: number; density?: DashboardDensity },
): DashboardLayoutState {
  const fallback = buildDefaultDashboardLayout(definition, fallbackOptions)
  if (!isRecord(input)) return fallback

  const known = new Map(definition.widgets.map((widget) => [widget.id, widget]))
  const seen = new Set<string>()
  const incomingWidgets = Array.isArray(input.widgets) ? input.widgets : []
  const widgets: DashboardWidgetLayout[] = []

  for (const raw of incomingWidgets) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || seen.has(raw.id)) continue
    const definitionWidget = known.get(raw.id)
    if (!definitionWidget) continue
    seen.add(raw.id)

    const size = isSize(raw.size) && definitionWidget.allowedSizes.includes(raw.size)
      ? raw.size
      : definitionWidget.defaultSize
    widgets.push({
      id: raw.id,
      zone: isZone(raw.zone) ? raw.zone : definitionWidget.defaultZone,
      order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? Math.max(0, Math.floor(raw.order)) : 999,
      size,
      visible: definitionWidget.required ? true : raw.visible !== false,
      collapsed: raw.collapsed === true,
    })
  }

  for (const definitionWidget of definition.widgets) {
    if (seen.has(definitionWidget.id)) continue
    widgets.push({
      id: definitionWidget.id,
      zone: definitionWidget.defaultZone,
      order: 999,
      size: definitionWidget.defaultSize,
      visible: true,
      collapsed: Boolean(definitionWidget.defaultCollapsed),
    })
  }

  return {
    version: definition.version,
    splitRatio: clampDashboardSplit(typeof input.splitRatio === 'number' ? input.splitRatio : fallback.splitRatio),
    preset: isPreset(input.preset) ? input.preset : fallback.preset,
    density: isDensity(input.density) ? input.density : fallback.density,
    widgets: normalizeOrders(widgets),
  }
}

export function moveDashboardWidget(
  layout: DashboardLayoutState,
  widgetId: string,
  zone: DashboardZone,
  targetIndex: number,
): DashboardLayoutState {
  const source = layout.widgets.find((widget) => widget.id === widgetId)
  if (!source) return layout

  const other = layout.widgets.filter((widget) => widget.id !== widgetId)
  const zoneWidgets = other
    .filter((widget) => widget.zone === zone)
    .sort((a, b) => a.order - b.order)
  const index = Math.max(0, Math.min(targetIndex, zoneWidgets.length))
  zoneWidgets.splice(index, 0, { ...source, zone })

  const updated = other.filter((widget) => widget.zone !== zone)
  return { ...layout, widgets: normalizeOrders([...updated, ...zoneWidgets]) }
}

export function updateDashboardWidget(
  definition: DashboardDefinition,
  layout: DashboardLayoutState,
  widgetId: string,
  patch: Partial<Pick<DashboardWidgetLayout, 'size' | 'visible' | 'collapsed'>>,
): DashboardLayoutState {
  const widgetDefinition = definition.widgets.find((widget) => widget.id === widgetId)
  if (!widgetDefinition) return layout

  return {
    ...layout,
    widgets: layout.widgets.map((widget) => {
      if (widget.id !== widgetId) return widget
      const size = patch.size && widgetDefinition.allowedSizes.includes(patch.size) ? patch.size : widget.size
      return {
        ...widget,
        size,
        visible: widgetDefinition.required ? true : patch.visible ?? widget.visible,
        collapsed: patch.collapsed ?? widget.collapsed,
      }
    }),
  }
}

export function applyDashboardPreset(
  definition: DashboardDefinition,
  layout: DashboardLayoutState,
  preset: DashboardPreset,
): DashboardLayoutState {
  const splitRatio = preset === 'focus' ? 0.74 : preset === 'overview' ? 0.55 : definition.defaultSplitRatio
  const density: DashboardDensity = preset === 'overview' ? 'compact' : 'comfortable'
  return {
    ...layout,
    preset,
    density,
    splitRatio: clampDashboardSplit(splitRatio),
    widgets: layout.widgets.map((widget) => {
      const def = definition.widgets.find((item) => item.id === widget.id)
      const compactAllowed = Boolean(def?.allowedSizes.includes('compact'))
      return {
        ...widget,
        size: preset === 'overview' && compactAllowed ? 'compact' : def?.defaultSize ?? widget.size,
      }
    }),
  }
}

export function dashboardLayoutsEqual(a: DashboardLayoutState, b: DashboardLayoutState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function validateDashboardLayout(definition: DashboardDefinition, value: unknown):
  | { ok: true; layout: DashboardLayoutState }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Layout must be an object.' }
  if (!Array.isArray(value.widgets)) return { ok: false, error: 'Layout widgets must be an array.' }
  if (value.widgets.length > definition.widgets.length) return { ok: false, error: 'Layout contains too many widgets.' }

  const ids = value.widgets
    .filter(isRecord)
    .map((widget) => widget.id)
    .filter((id): id is string => typeof id === 'string')
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'A widget cannot appear more than once.' }

  const unknown = ids.find((id) => !definition.widgets.some((widget) => widget.id === id))
  if (unknown) return { ok: false, error: `Unknown widget: ${unknown}` }

  const split = value.splitRatio
  if (typeof split !== 'number' || !Number.isFinite(split) || split < MIN_SPLIT || split > MAX_SPLIT) {
    return { ok: false, error: `Split ratio must be between ${MIN_SPLIT} and ${MAX_SPLIT}.` }
  }

  return { ok: true, layout: sanitizeDashboardLayout(definition, value) }
}
