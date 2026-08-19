/**
 * kernel/publishing — the source/channel contracts for the Publishing space
 * (ADR-0014) plus pure composition, reconciliation and fingerprint helpers.
 *
 * Types and pure functions only: no provider, no channel profile, no model
 * call. Providers live in their owning components; composition lives in
 * `src/modules/publishing-registry.ts`.
 */
export type {
  ChannelConnector,
  DeliveryMeta,
  DeliveryResult,
  PublishableField,
  PublishableImage,
  PublishablePerson,
  PublishableSource,
  SourceCandidate,
  SourceContext,
  SourceProvider,
  SourceRightsStatus,
} from '@/kernel/publishing/types'
export { indexProviders, reconcileSources } from '@/kernel/publishing/compose'
export type { SourceReconciliation } from '@/kernel/publishing/compose'
export { fingerprintSource, isSourceStale } from '@/kernel/publishing/fingerprint'
