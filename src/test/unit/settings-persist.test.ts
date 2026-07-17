import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { persistPanelValues } from '@/kernel/settings/persist'
import type { SettingsPanel } from '@/kernel/settings/types'

function fakeSupabase() {
  const inserted: Array<Record<string, unknown>> = []
  const deleted: Array<[string, unknown]> = []

  const filter = {
    error: null,
    eq(column: string, value: unknown) {
      deleted.push([column, value])
      return this
    },
    is(column: string, value: unknown) {
      deleted.push([column, value])
      return this
    },
  }

  const client = {
    from(table: string) {
      expect(table).toBe('platform_settings')
      return {
        delete() {
          return filter
        },
        async insert(payload: Record<string, unknown>) {
          inserted.push(payload)
          return { error: null }
        },
      }
    },
  } as unknown as SupabaseClient

  return { client, inserted, deleted }
}

const panel: SettingsPanel = {
  id: 'component:events',
  scope: 'component',
  componentId: 'events',
  title: 'Events & Conferences',
  fields: [{
    key: 'discoveryMaxLanesPerRegion',
    type: 'number',
    label: 'Source lenses per region',
    default: 6,
    min: 1,
    max: 6,
    step: 1,
  }],
}

const designPanel: SettingsPanel = {
  id: 'kernel:design-system',
  scope: 'kernel',
  componentId: null,
  title: 'Design & Component Library',
  fields: [
    {
      key: 'dashboardDensity',
      type: 'enum',
      label: 'Default dashboard density',
      options: ['comfortable', 'compact'],
      default: 'comfortable',
    },
    {
      key: 'dashboardDefaultSplitRatio',
      type: 'number',
      label: 'Default primary-column share',
      min: 0.42,
      max: 0.78,
      step: 0.01,
      default: 0.64,
    },
  ],
}

describe('persistPanelValues numeric constraints', () => {
  it('coerces and saves a valid bounded number', async () => {
    const db = fakeSupabase()
    const result = await persistPanelValues(db.client, panel, { discoveryMaxLanesPerRegion: '4' }, 'user-1')

    expect(result).toEqual({ ok: true, saved: 1 })
    expect(db.inserted).toHaveLength(1)
    expect(db.inserted[0]).toMatchObject({
      scope: 'component',
      component_id: 'events',
      key: 'discoveryMaxLanesPerRegion',
      value: 4,
      updated_by: 'user-1',
    })
  })

  it('persists kernel design settings with a nullable component id', async () => {
    const db = fakeSupabase()
    const result = await persistPanelValues(db.client, designPanel, { dashboardDensity: 'compact' }, 'admin-1')

    expect(result).toEqual({ ok: true, saved: 1 })
    expect(db.inserted[0]).toMatchObject({
      scope: 'kernel',
      component_id: null,
      key: 'dashboardDensity',
      value: 'compact',
      updated_by: 'admin-1',
    })
    expect(db.deleted).toContainEqual(['component_id', null])
  })

  it('rejects a number above the declared maximum without writing', async () => {
    const db = fakeSupabase()
    const result = await persistPanelValues(db.client, panel, { discoveryMaxLanesPerRegion: 7 }, 'user-1')

    expect(result).toEqual({ ok: false, error: 'Source lenses per region must be no more than 6.' })
    expect(db.inserted).toHaveLength(0)
    expect(db.deleted).toHaveLength(0)
  })

  it('validates the entire panel before writing any earlier valid field', async () => {
    const db = fakeSupabase()
    const result = await persistPanelValues(db.client, designPanel, {
      dashboardDensity: 'compact',
      dashboardDefaultSplitRatio: 0.9,
    }, 'admin-1')

    expect(result).toEqual({ ok: false, error: 'Default primary-column share must be no more than 0.78.' })
    expect(db.inserted).toHaveLength(0)
    expect(db.deleted).toHaveLength(0)
  })

  it('rejects values that do not follow the declared step', async () => {
    const db = fakeSupabase()
    const result = await persistPanelValues(db.client, panel, { discoveryMaxLanesPerRegion: 2.5 }, 'user-1')

    expect(result).toEqual({ ok: false, error: 'Source lenses per region must use increments of 1.' })
    expect(db.inserted).toHaveLength(0)
  })
})
