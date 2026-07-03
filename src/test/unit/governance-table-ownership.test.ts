/**
 * Governance check #2 — table-ownership reconciliation (ADR-0009 §10).
 *
 * Asserts that the three sets stay reconciled: every live table (from the
 * migration history) is claimed exactly once by either a component manifest, the
 * kernel, the Stage-1 pending-ownership bootstrap, or the (empty) quarantine —
 * and no manifest claims a table that doesn't exist. A retired-space table can
 * therefore never linger silently, and a manifest can't drift from the schema.
 */

import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { readMigrationTables } from '@/kernel/db/live-tables'
import { componentManifests } from '@/modules/registry'
import { KERNEL_TABLES, PENDING_OWNERSHIP, QUARANTINE } from '@/kernel/db/ownership'
import { validateManifest } from '@/kernel/manifest'

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations')

describe('table-ownership reconciliation', () => {
  const { live } = readMigrationTables(MIGRATIONS_DIR)

  const componentClaims = new Map<string, string[]>() // table -> owning component ids
  for (const m of componentManifests) {
    for (const t of m.data.tables) {
      componentClaims.set(t, [...(componentClaims.get(t) ?? []), m.id])
    }
  }

  const claimed = new Set<string>([
    ...componentClaims.keys(),
    ...KERNEL_TABLES,
    ...PENDING_OWNERSHIP.map((p) => p.table),
    ...QUARANTINE.map((q) => q.table),
  ])

  it('every live table is claimed by exactly one owner', () => {
    const unclaimed = [...live].filter((t) => !claimed.has(t)).sort()
    expect(unclaimed, `unclaimed live tables (add to a manifest, kernel, or pending-ownership):\n${unclaimed.join('\n')}`).toEqual([])
  })

  it('no table is claimed by two components', () => {
    const doubled = [...componentClaims.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([t, owners]) => `${t} -> ${owners.join(', ')}`)
    expect(doubled, `tables claimed by multiple components:\n${doubled.join('\n')}`).toEqual([])
  })

  it('no manifest claims a table that does not exist (no stale/phantom claims)', () => {
    const phantom = [...componentClaims.keys()].filter((t) => !live.has(t)).sort()
    expect(phantom, `manifests claim non-existent tables (schema drift):\n${phantom.join('\n')}`).toEqual([])
  })

  it('kernel / pending / quarantine tables all exist', () => {
    const nonComponent = [
      ...KERNEL_TABLES,
      ...PENDING_OWNERSHIP.map((p) => p.table),
      ...QUARANTINE.map((q) => q.table),
    ]
    const phantom = nonComponent.filter((t) => !live.has(t)).sort()
    expect(phantom, `non-component ownership lists reference non-existent tables:\n${phantom.join('\n')}`).toEqual([])
  })

  it('quarantine starts empty (Sprint 15 dropped the residual orphans)', () => {
    expect(QUARANTINE).toEqual([])
  })

  it('every component manifest is schema-valid', () => {
    for (const m of componentManifests) {
      const r = validateManifest(m)
      expect(r.ok, r.ok ? '' : `${m.id}:\n  - ${(r as { errors: string[] }).errors.join('\n  - ')}`).toBe(true)
    }
  })
})
