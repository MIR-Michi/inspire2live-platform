import { describe, expect, it } from 'vitest'
import {
  applyDashboardPreset,
  buildDefaultDashboardLayout,
  getDashboardDefinition,
  moveDashboardWidget,
  sanitizeDashboardLayout,
  updateDashboardWidget,
  validateDashboardLayout,
} from '@/kernel/dashboard'

describe('adaptive dashboard layout domain', () => {
  const definition = getDashboardDefinition('comms-personal')

  it('builds role defaults with stable zone order and required visibility', () => {
    const layout = buildDefaultDashboardLayout(definition)

    expect(layout.version).toBe(definition.version)
    expect(layout.splitRatio).toBe(definition.defaultSplitRatio)
    expect(layout.widgets.map((widget) => widget.id)).toEqual(definition.widgets.map((widget) => widget.id))
    expect(layout.widgets.find((widget) => widget.id === 'my-tasks')).toMatchObject({
      zone: 'primary',
      visible: true,
      size: 'wide',
    })
  })

  it('sanitizes unknown and duplicate widgets, enforces required tiles, and appends new defaults', () => {
    const layout = sanitizeDashboardLayout(definition, {
      version: 0,
      splitRatio: 0.7,
      preset: 'focus',
      density: 'compact',
      widgets: [
        { id: 'my-tasks', zone: 'supporting', order: 8, size: 'compact', visible: false, collapsed: true },
        { id: 'my-tasks', zone: 'primary', order: 0, size: 'standard', visible: true, collapsed: false },
        { id: 'legacy-widget', zone: 'primary', order: 1, size: 'standard', visible: true, collapsed: false },
      ],
    })

    expect(layout.widgets.filter((widget) => widget.id === 'my-tasks')).toHaveLength(1)
    expect(layout.widgets.find((widget) => widget.id === 'my-tasks')).toMatchObject({
      visible: true,
      size: 'wide',
      zone: 'supporting',
    })
    expect(layout.widgets.some((widget) => widget.id === 'legacy-widget')).toBe(false)
    expect(layout.widgets.map((widget) => widget.id).sort()).toEqual(definition.widgets.map((widget) => widget.id).sort())
  })

  it('moves a widget across zones and normalizes both zone orders', () => {
    const original = buildDefaultDashboardLayout(definition)
    const moved = moveDashboardWidget(original, 'incoming-review', 'supporting', 0)

    expect(moved.widgets.find((widget) => widget.id === 'incoming-review')).toMatchObject({ zone: 'supporting', order: 0 })
    const supportingOrders = moved.widgets
      .filter((widget) => widget.zone === 'supporting')
      .map((widget) => widget.order)
      .sort((a, b) => a - b)
    expect(supportingOrders).toEqual(supportingOrders.map((_, index) => index))
  })

  it('honors size constraints and required visibility when updating a widget', () => {
    const original = buildDefaultDashboardLayout(definition)
    const invalidSize = updateDashboardWidget(definition, original, 'my-tasks', { size: 'compact', visible: false })
    expect(invalidSize.widgets.find((widget) => widget.id === 'my-tasks')).toMatchObject({ size: 'wide', visible: true })

    const hidden = updateDashboardWidget(definition, original, 'incoming-review', { visible: false, size: 'compact' })
    expect(hidden.widgets.find((widget) => widget.id === 'incoming-review')).toMatchObject({ visible: false, size: 'compact' })
  })

  it('applies overview and focus presets without violating allowed sizes', () => {
    const original = buildDefaultDashboardLayout(definition)
    const overview = applyDashboardPreset(definition, original, 'overview')
    const focus = applyDashboardPreset(definition, original, 'focus')

    expect(overview).toMatchObject({ preset: 'overview', density: 'compact', splitRatio: 0.55 })
    expect(overview.widgets.find((widget) => widget.id === 'incoming-review')?.size).toBe('compact')
    expect(overview.widgets.find((widget) => widget.id === 'my-tasks')?.size).toBe('wide')
    expect(focus).toMatchObject({ preset: 'focus', density: 'comfortable', splitRatio: 0.74 })
  })

  it('rejects unknown widgets, duplicate widgets, and unsafe split ratios', () => {
    const valid = buildDefaultDashboardLayout(definition)

    expect(validateDashboardLayout(definition, { ...valid, splitRatio: 0.2 })).toEqual({
      ok: false,
      error: 'Split ratio must be between 0.42 and 0.78.',
    })
    expect(validateDashboardLayout(definition, {
      ...valid,
      widgets: [...valid.widgets, { ...valid.widgets[0] }],
    })).toEqual({ ok: false, error: 'Layout contains too many widgets.' })
    expect(validateDashboardLayout(definition, {
      ...valid,
      widgets: [{ ...valid.widgets[0], id: 'unknown' }],
    })).toEqual({ ok: false, error: 'Unknown widget: unknown' })
  })
})
