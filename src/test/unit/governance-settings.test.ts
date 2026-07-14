/**
 * Governance check #4 — settings reconciliation (ADR-0010 §6).
 *
 * Extends the ADR-0009 §10 "exists = owned = reachable" invariant to
 * configuration: every typed config field is owned by exactly one panel,
 * `provides.settingsPanel` agrees with `config` (no orphan config, no zombie
 * panel), no two panels claim the same storage slot, and secrets are referenced
 * (never embedded). A failure here fails the build, so configuration cannot
 * silently re-scatter into the pre-ADR-0010 junk-drawer state.
 */

import { describe, it, expect } from 'vitest'
import { defineManifest } from '@/kernel/manifest/types'
import { validateManifest } from '@/kernel/manifest'
import { componentPanel, reconcileSettings } from '@/kernel/settings/registry'
import { allSettingsPanels } from '@/modules/settings-registry'
import { componentManifests } from '@/modules/registry'
import { SETTINGS_SECTIONS } from '@/kernel/shell/settings-nav'

describe('settings reconciliation', () => {
  it('the live settings surface reconciles cleanly', () => {
    const { orphanConfigs, zombiePanels, duplicateKeys } = reconcileSettings(componentManifests)
    expect(orphanConfigs, `orphan config (typed fields, no settingsPanel): ${orphanConfigs.join(', ')}`).toEqual([])
    expect(zombiePanels, `zombie panels (settingsPanel, no typed config): ${zombiePanels.join(', ')}`).toEqual([])
    expect(duplicateKeys, `duplicate storage slots:\n${duplicateKeys.join('\n')}`).toEqual([])
  })

  it('flags a component with typed config but no settingsPanel (orphan)', () => {
    const orphan = defineManifest({
      id: 'orphan-x', version: '1.0.0', title: 'Orphan', summary: 'x', surface: 'internal',
      data: { schema: 'orphan', tables: [] },
      config: { mode: { type: 'enum', options: ['a', 'b'], default: 'a' } },
    })
    expect(validateManifest(orphan).ok).toBe(false)
    expect(reconcileSettings([orphan]).orphanConfigs).toContain('orphan-x')
  })

  it('flags a settingsPanel with no typed config (zombie)', () => {
    const zombie = defineManifest({
      id: 'zombie-x', version: '1.0.0', title: 'Zombie', summary: 'x', surface: 'internal',
      data: { schema: 'zombie', tables: [] },
      provides: { settingsPanel: true },
    })
    expect(validateManifest(zombie).ok).toBe(false)
    expect(reconcileSettings([zombie]).zombiePanels).toContain('zombie-x')
  })

  it('every component config panel is reachable in the settings registry', () => {
    const registered = new Set(allSettingsPanels().map((p) => p.id))
    const missing = componentManifests
      .map((m) => componentPanel(m))
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .filter((p) => !registered.has(p.id))
      .map((p) => p.id)
    expect(missing, `component panels not in the registry: ${missing.join(', ')}`).toEqual([])
  })

  it('every settings sub-nav component link points at a real config panel', () => {
    const panelIds = new Set(componentManifests.map((m) => componentPanel(m)).filter(Boolean).map((p) => p!.componentId))
    const broken = SETTINGS_SECTIONS.flatMap((s) => s.items)
      .filter((i) => !i.planned && i.href.startsWith('/app/settings/components/'))
      .map((i) => i.href.split('/').pop()!)
      .filter((id) => !panelIds.has(id))
    expect(broken, `sub-nav links to components without a config panel: ${broken.join(', ')}`).toEqual([])
  })

  it('secret fields are referenced (secretRef), never embedded (ADR-0010 §6)', () => {
    const embedded = allSettingsPanels().flatMap((p) =>
      p.fields.filter((f) => f.type === 'secret' && !f.secretRef).map((f) => `${p.id}.${f.key}`),
    )
    expect(embedded, `secret fields missing a secretRef: ${embedded.join(', ')}`).toEqual([])
  })
})
