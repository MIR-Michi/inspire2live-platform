import { describe, it, expect } from 'vitest'
import { validateManifest, assertManifest } from '@/kernel/manifest/validate'
import { defineManifest } from '@/kernel/manifest/types'
import type { ComponentManifest } from '@/kernel/manifest/types'

const valid: ComponentManifest = defineManifest({
  id: 'intake',
  version: '1.0.0',
  title: 'Channel Intake',
  summary: 'Ingests channel messages and triages signal vs noise.',
  surface: 'internal',
  data: {
    schema: 'intake',
    tablePrefix: 'intake_',
    tables: ['intake_items', 'intake_classifier_rules'],
    readViews: ['intake_items_public'],
    migrations: ['00028', '00077'],
  },
  provides: { api: ['loadIntakeQueue'], events: ['intake.item.promoted'], ui: ['IntakeQueue'] },
  dependsOn: { kernel: ['identity', 'rbac'], components: ['contacts@^1'] },
  featureFlag: 'intake_enabled',
  config: { classifier: 'hybrid' },
  personas: ['communications-coordinator'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: ['REQ-COMMS-INTAKE-001'],
  operations: ['classify-inbound'],
})

describe('validateManifest', () => {
  it('accepts a fully-populated valid manifest', () => {
    const r = validateManifest(valid)
    expect(r.ok).toBe(true)
  })

  it('accepts a minimal valid manifest (only required fields)', () => {
    const r = validateManifest({
      id: 'feedback',
      version: '1.0.0',
      title: 'Feedback',
      summary: 'In-app feedback capture.',
      surface: 'internal',
      data: { schema: 'feedback', tables: ['feedback_items'] },
    })
    expect(r.ok).toBe(true)
  })

  it('rejects a non-object', () => {
    expect(validateManifest(null).ok).toBe(false)
    expect(validateManifest('x').ok).toBe(false)
  })

  it('rejects a non-kebab-case id', () => {
    const r = validateManifest({ ...valid, id: 'Intake_Queue' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('`id`'))).toBe(true)
  })

  it('rejects a non-semver version', () => {
    const r = validateManifest({ ...valid, version: 'v1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('`version`'))).toBe(true)
  })

  it('rejects an unknown surface', () => {
    const r = validateManifest({ ...valid, surface: 'sidebar' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('`surface`'))).toBe(true)
  })

  it('requires data.tables to be a string array', () => {
    const r = validateManifest({ ...valid, data: { schema: 'intake', tables: 'nope' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('`data.tables`'))).toBe(true)
  })

  it('rejects duplicate tables', () => {
    const r = validateManifest({
      ...valid,
      data: { schema: 'intake', tables: ['a', 'a'] },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('duplicates'))).toBe(true)
  })

  it('rejects a wrong-typed provides.api', () => {
    const r = validateManifest({ ...valid, provides: { api: [1, 2] } })
    expect(r.ok).toBe(false)
  })

  it('allows featureFlag null', () => {
    const r = validateManifest({ ...valid, featureFlag: null })
    expect(r.ok).toBe(true)
  })

  it('collects multiple errors in one pass', () => {
    const r = validateManifest({ id: 'Bad', version: 'x', title: '', summary: '', surface: 'z', data: {} })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(3)
  })
})

describe('assertManifest', () => {
  it('returns the manifest when valid', () => {
    expect(assertManifest(valid).id).toBe('intake')
  })
  it('throws with a joined message when invalid', () => {
    expect(() => assertManifest({ id: 'X' })).toThrow(/Invalid component manifest/)
  })
})
