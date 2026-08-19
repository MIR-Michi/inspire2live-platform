/**
 * Governance check — source reconciliation (ADR-0014 §4, in the spirit of
 * ADR-0009 §10). The publishing extension point stays coherent: every
 * registered provider is declared by exactly the manifest that owns it, and
 * every declared `provides.sources` entry has a registered provider.
 *
 * Includes fixtures proving the rule catches all three failure modes:
 * a declared-but-unregistered source, an unregistered-but-declared provider,
 * and a provider claiming the wrong owner.
 */

import { describe, it, expect } from 'vitest'

import { reconcileSources, indexProviders } from '@/kernel/publishing'
import type { SourceProvider } from '@/kernel/publishing'
import type { ComponentManifest } from '@/kernel/manifest'
import { sourceReconciliation } from '@/modules/publishing-registry'

function manifestWith(id: string, sources?: string[]): ComponentManifest {
  return {
    id,
    version: '1.0.0',
    title: id,
    summary: id,
    surface: 'internal',
    data: { schema: id, tables: [] },
    provides: sources ? { sources } : {},
  }
}

function providerFor(sourceType: string, ownedBy: string): SourceProvider {
  return {
    sourceType,
    label: sourceType,
    ownedBy,
    async load() {
      return null
    },
  }
}

describe('publishing source reconciliation (live registry)', () => {
  it('declared provides.sources ↔ registered providers ↔ ownedBy are coherent', () => {
    const result = sourceReconciliation()
    const message = [
      ...result.undeclaredProviders.map((entry) => `undeclared provider: ${entry}`),
      ...result.unregisteredDeclarations.map((entry) => `unregistered declaration: ${entry}`),
      ...result.ownershipMismatches.map((entry) => `ownership mismatch: ${entry}`),
    ].join('\n')
    expect(result.undeclaredProviders, message).toEqual([])
    expect(result.unregisteredDeclarations, message).toEqual([])
    expect(result.ownershipMismatches, message).toEqual([])
  })
})

describe('reconcileSources fixtures (the rule catches each failure mode)', () => {
  it('flags a declared source nobody registered a provider for', () => {
    const result = reconcileSources([manifestWith('events', ['campus_session'])], [])
    expect(result.unregisteredDeclarations).toHaveLength(1)
    expect(result.unregisteredDeclarations[0]).toContain('campus_session')
  })

  it('flags a registered provider nobody declared', () => {
    const result = reconcileSources(
      [manifestWith('events')],
      [providerFor('campus_session', 'events')],
    )
    expect(result.undeclaredProviders).toHaveLength(1)
    expect(result.undeclaredProviders[0]).toContain('campus_session')
  })

  it('flags a provider claiming the wrong owning component', () => {
    const result = reconcileSources(
      [manifestWith('events', ['campus_session']), manifestWith('publishing')],
      [providerFor('campus_session', 'publishing')],
    )
    expect(result.ownershipMismatches).toHaveLength(1)
    expect(result.ownershipMismatches[0]).toContain("provider claims 'publishing'")
  })

  it('passes when all three sets agree', () => {
    const result = reconcileSources(
      [manifestWith('events', ['campus_session'])],
      [providerFor('campus_session', 'events')],
    )
    expect(result).toEqual({ undeclaredProviders: [], unregisteredDeclarations: [], ownershipMismatches: [] })
  })
})

describe('indexProviders', () => {
  it('indexes providers by source type and rejects duplicates', () => {
    const a = providerFor('adhoc', 'publishing')
    const index = indexProviders([a, providerFor('campus_session', 'events')])
    expect(index.get('adhoc')).toBe(a)
    expect(() => indexProviders([a, providerFor('adhoc', 'publishing')])).toThrow(/Duplicate/)
  })
})
