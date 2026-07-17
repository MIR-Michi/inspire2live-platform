import { describe, it, expect } from 'vitest'
import { resolvePanel, resolveSetting } from '@/kernel/settings/resolver'
import { persistPanelValues } from '@/kernel/settings/persist'
import type { SettingsPanel } from '@/kernel/settings/types'

/* ─── Minimal fake Supabase for the platform_settings table ──────────────── */

type Row = { scope: string; component_id: string | null; key: string; value: unknown }

function fakeSupabase(rows: Row[] = [], insertError: string | null = null) {
  const inserts: Record<string, unknown>[] = []
  const deletes: Array<[string, unknown]>[] = []

  const deleteChain = (filters: Array<[string, unknown]>): Record<string, unknown> => ({
    eq(col: string, val: unknown) { filters.push([col, val]); return deleteChain(filters) },
    is(col: string, val: unknown) { filters.push([col, val]); return Promise.resolve({ error: null }) },
    then(resolve: (v: { error: null }) => void) { resolve({ error: null }) },
  })

  const client = {
    from() {
      return {
        select: () => Promise.resolve({ data: rows }),
        delete() { const f: Array<[string, unknown]> = []; deletes.push(f); return deleteChain(f) },
        insert(payload: Record<string, unknown>) {
          inserts.push(payload)
          return Promise.resolve({ error: insertError ? { message: insertError } : null })
        },
      }
    },
    inserts,
    deletes,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}

const kernelPanel: SettingsPanel = {
  id: 'kernel:demo',
  scope: 'kernel',
  componentId: null,
  title: 'Demo',
  fields: [
    { key: 'displayName', type: 'string', default: 'Inspire2Live' },
    { key: 'mode', type: 'enum', options: ['a', 'b'], default: 'a' },
    { key: 'enabled', type: 'boolean', default: true },
    { key: 'threshold', type: 'number', default: 10 },
    { key: 'apiKey', type: 'secret', secretRef: 'DEMO_SECRET' },
  ],
}

const componentPanel: SettingsPanel = {
  id: 'component:intake',
  scope: 'component',
  componentId: 'intake',
  title: 'Intake',
  fields: [{ key: 'classifier', type: 'enum', options: ['rules', 'ai'], default: 'ai' }],
}

/* ─── resolvePanel / resolveSetting ──────────────────────────────────────── */

describe('resolvePanel', () => {
  it('prefers a persisted DB value over the default', async () => {
    const supabase = fakeSupabase([{ scope: 'kernel', component_id: null, key: 'displayName', value: 'Custom' }])
    const fields = await resolvePanel(supabase, kernelPanel)
    const name = fields.find((f) => f.key === 'displayName')!
    expect(name.value).toBe('Custom')
    expect(name.source).toBe('db')
  })

  it('falls back to the declared default when no DB row exists', async () => {
    const fields = await resolvePanel(fakeSupabase(), kernelPanel)
    const mode = fields.find((f) => f.key === 'mode')!
    expect(mode.value).toBe('a')
    expect(mode.source).toBe('default')
  })

  it('never reads a secret from the DB — masks when env is set, unset otherwise', async () => {
    process.env.DEMO_SECRET = 'super-secret'
    const set = await resolvePanel(fakeSupabase(), kernelPanel)
    const secretSet = set.find((f) => f.key === 'apiKey')!
    expect(secretSet.source).toBe('env')
    expect(secretSet.value).not.toContain('super-secret')

    delete process.env.DEMO_SECRET
    const unset = await resolvePanel(fakeSupabase(), kernelPanel)
    expect(unset.find((f) => f.key === 'apiKey')!.source).toBe('unset')
  })

  it('keys DB lookups by scope + component', async () => {
    const supabase = fakeSupabase([{ scope: 'component', component_id: 'intake', key: 'classifier', value: 'rules' }])
    const fields = await resolvePanel(supabase, componentPanel)
    expect(fields[0].value).toBe('rules')
    expect(fields[0].source).toBe('db')
  })
})

describe('resolveSetting', () => {
  it('returns the effective value for a known field', async () => {
    const supabase = fakeSupabase([{ scope: 'kernel', component_id: null, key: 'threshold', value: 42 }])
    expect(await resolveSetting(supabase, kernelPanel, 'threshold')).toBe(42)
  })

  it('returns undefined for an unknown or secret field', async () => {
    expect(await resolveSetting(fakeSupabase(), kernelPanel, 'nope')).toBeUndefined()
    expect(await resolveSetting(fakeSupabase(), kernelPanel, 'apiKey')).toBeUndefined()
  })
})

/* ─── persistPanelValues ─────────────────────────────────────────────────── */

describe('persistPanelValues', () => {
  const USER = 'user-1'

  it('coerces values to their declared types', async () => {
    const supabase = fakeSupabase()
    const result = await persistPanelValues(supabase, kernelPanel, {
      displayName: 'Hello',
      enabled: 'on',
      threshold: '25',
      mode: 'b',
    }, USER)
    expect(result).toEqual({ ok: true, saved: 4 })
    const byKey = Object.fromEntries(supabase.inserts.map((r: Record<string, unknown>) => [r.key, r.value]))
    expect(byKey.displayName).toBe('Hello')
    expect(byKey.enabled).toBe(true)
    expect(byKey.threshold).toBe(25)
    expect(byKey.mode).toBe('b')
  })

  it('never persists a secret field (secret guard)', async () => {
    const supabase = fakeSupabase()
    const result = await persistPanelValues(supabase, kernelPanel, { apiKey: 'leak-me' }, USER)
    expect(result).toEqual({ ok: true, saved: 0 })
    expect(supabase.inserts).toHaveLength(0)
  })

  it('skips keys absent from the payload and invalid coercions', async () => {
    const supabase = fakeSupabase()
    const result = await persistPanelValues(supabase, kernelPanel, { threshold: 'not-a-number', mode: 'invalid' }, USER)
    expect(result).toEqual({ ok: true, saved: 0 })
    expect(supabase.inserts).toHaveLength(0)
  })

  it('scopes the replace by component_id for a component panel', async () => {
    const supabase = fakeSupabase()
    await persistPanelValues(supabase, componentPanel, { classifier: 'rules' }, USER)
    const filters = supabase.deletes[0]
    expect(filters).toContainEqual(['component_id', 'intake'])
    expect(supabase.inserts[0]).toMatchObject({ scope: 'component', component_id: 'intake', key: 'classifier', value: 'rules' })
  })

  it('surfaces an actionable insert error with the affected field', async () => {
    const supabase = fakeSupabase([], 'db exploded')
    const result = await persistPanelValues(supabase, kernelPanel, { displayName: 'X' }, USER)
    expect(result).toEqual({ ok: false, error: 'displayName could not be saved: db exploded' })
  })
})
