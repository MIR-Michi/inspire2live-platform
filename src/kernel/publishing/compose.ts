/**
 * kernel/publishing/compose.ts
 *
 * Pure composition + reconciliation helpers for the source-provider extension
 * point (ADR-0014 §4). `indexProviders` is what the registry uses to resolve a
 * `sourceType`; `reconcileSources` is the governance check that keeps three
 * sets honest: declared `provides.sources`, registered providers, and each
 * provider's `ownedBy`. No DB, no component import — testable with fixtures.
 */

import type { ComponentManifest } from '@/kernel/manifest'
import type { SourceProvider } from '@/kernel/publishing/types'

/** Index providers by source type. Throws on a duplicate — an authoring error. */
export function indexProviders(providers: readonly SourceProvider[]): Map<string, SourceProvider> {
  const index = new Map<string, SourceProvider>()
  for (const provider of providers) {
    if (index.has(provider.sourceType)) {
      throw new Error(`Duplicate source provider for '${provider.sourceType}'`)
    }
    index.set(provider.sourceType, provider)
  }
  return index
}

export type SourceReconciliation = {
  /** A registered provider whose `sourceType` no manifest declares in `provides.sources`. */
  undeclaredProviders: string[]
  /** A declared `provides.sources` entry with no registered provider. */
  unregisteredDeclarations: string[]
  /** A provider whose `ownedBy` is not the component that declares its source type. */
  ownershipMismatches: string[]
}

/**
 * Reconcile declared sources ↔ registered providers ↔ `ownedBy`. All three
 * arrays empty means the extension point is coherent (governance gate).
 */
export function reconcileSources(
  manifests: readonly ComponentManifest[],
  providers: readonly SourceProvider[],
): SourceReconciliation {
  const declaredBy = new Map<string, string[]>() // sourceType -> component ids declaring it
  for (const manifest of manifests) {
    for (const sourceType of manifest.provides?.sources ?? []) {
      declaredBy.set(sourceType, [...(declaredBy.get(sourceType) ?? []), manifest.id])
    }
  }

  const registered = new Map<string, SourceProvider>()
  for (const provider of providers) registered.set(provider.sourceType, provider)

  const undeclaredProviders = [...registered.keys()]
    .filter((sourceType) => !declaredBy.has(sourceType))
    .sort()
    .map((sourceType) => `${sourceType} (registered by '${registered.get(sourceType)?.ownedBy}')`)

  const unregisteredDeclarations = [...declaredBy.entries()]
    .filter(([sourceType]) => !registered.has(sourceType))
    .map(([sourceType, owners]) => `${sourceType} (declared by '${owners.join("', '")}')`)
    .sort()

  const ownershipMismatches: string[] = []
  for (const [sourceType, provider] of registered) {
    const declarers = declaredBy.get(sourceType)
    if (!declarers) continue // already reported as undeclared
    if (!declarers.includes(provider.ownedBy)) {
      ownershipMismatches.push(
        `${sourceType}: provider claims '${provider.ownedBy}' but is declared by '${declarers.join("', '")}'`,
      )
    }
  }
  ownershipMismatches.sort()

  return { undeclaredProviders, unregisteredDeclarations, ownershipMismatches }
}
