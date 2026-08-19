/**
 * modules/publishing-registry.ts
 *
 * Binds the publishing extension point to the live component catalog
 * (ADR-0014 §4). Like `registry.ts` and `settings-registry.ts`, this is a
 * top-level `src/modules/*` file — the one place allowed to import both the
 * kernel contract and every component's public API. `publishing` receives an
 * already-resolved plain-data payload and imports no source owner; `events`
 * imports nothing from `publishing`.
 *
 * Adding a source costs three lines: a provider in its owning component, one
 * `provides.sources` manifest entry, and one import here. The
 * source-reconciliation governance gate keeps the three in sync.
 */

import {
  indexProviders,
  reconcileSources,
  type PublishableSource,
  type SourceCandidate,
  type SourceContext,
  type SourceProvider,
  type SourceReconciliation,
} from '@/kernel/publishing'
import { componentManifests } from '@/modules/registry'
import { adhocSourceProvider } from '@/modules/publishing'
import { campusSessionSourceProvider } from '@/modules/events'

const PROVIDERS: readonly SourceProvider[] = [adhocSourceProvider, campusSessionSourceProvider]

/** Every registered provider, indexed by source type. */
export function allSourceProviders(): Map<string, SourceProvider> {
  return indexProviders(PROVIDERS)
}

/** Resolve one source type to its provider (null when nothing is registered). */
export function sourceProviderFor(sourceType: string): SourceProvider | null {
  return allSourceProviders().get(sourceType) ?? null
}

/** Declared `provides.sources` ↔ registered providers ↔ `ownedBy` (governance gate). */
export function sourceReconciliation(): SourceReconciliation {
  return reconcileSources(componentManifests, PROVIDERS)
}

/** Resolve a source to the curated payload its owner publishes. */
export async function resolveSource(
  ctx: SourceContext,
  sourceType: string,
  sourceId: string,
): Promise<PublishableSource | null> {
  const provider = sourceProviderFor(sourceType)
  if (!provider) return null
  return provider.load(ctx, sourceId)
}

/** Recent candidates from every provider, newest first — the picker's list. */
export async function listRecentSourceCandidates(
  ctx: SourceContext,
  limitPerProvider = 8,
): Promise<Array<SourceCandidate & { providerLabel: string }>> {
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      if (!provider.listRecent) return []
      try {
        const candidates = await provider.listRecent(ctx, limitPerProvider)
        return candidates.map((candidate) => ({ ...candidate, providerLabel: provider.label }))
      } catch (error) {
        console.error(`[publishing-registry] listRecent failed for '${provider.sourceType}'`, error)
        return []
      }
    }),
  )
  return results
    .flat()
    .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
}

/** The provenance hook for one source, when its provider declares one. */
export function onPublishedHook(
  ctx: SourceContext,
  sourceType: string,
  sourceId: string,
): ((calendarEntryId: string) => Promise<void>) | undefined {
  const provider = sourceProviderFor(sourceType)
  if (!provider?.onPublished) return undefined
  return (calendarEntryId: string) => provider.onPublished!(ctx, sourceId, calendarEntryId)
}
