/**
 * publishing — public API (the ONLY import surface for other modules and app
 * routes).
 *
 * The generic half of the Publishing space (ADR-0014): channel profiles as
 * data, the readiness/groundedness/rights gates, the drafting run, the review
 * lifecycle, the ad-hoc source and the space UI. It imports the kernel and
 * `@/modules/content` only — never a source owner; source resolution is wired
 * by `src/modules/publishing-registry.ts` and the thin route.
 */

export { manifest } from '@/modules/publishing/manifest'

// ─── vocabulary ───────────────────────────────────────────────────────────────
export type {
  ActionResult,
  DraftClaim,
  DraftStatus,
  PublishingConfig,
  PublishingDraft,
} from '@/modules/publishing/domain/types'
export {
  DEFAULT_PUBLISHING_CONFIG,
  DRAFT_STATUS_META,
  RIGHTS_META,
  RIGHTS_STATUSES,
} from '@/modules/publishing/domain/types'

// ─── channels (data, pure) ────────────────────────────────────────────────────
export {
  CHANNEL_PROFILES,
  channelBudget,
  channelProfile,
  isChannelEnabled,
} from '@/modules/publishing/domain/channels'
export type { ChannelProfile } from '@/modules/publishing/domain/channels'

// ─── gates (pure) ─────────────────────────────────────────────────────────────
export { sourceReadiness } from '@/modules/publishing/domain/readiness'
export type { SourceReadiness } from '@/modules/publishing/domain/readiness'
export {
  CHANNEL_POST_JSON_SCHEMA,
  validateChannelPostPayload,
} from '@/modules/publishing/domain/claims'
export type { ChannelPostPayload, DraftVariantPayload } from '@/modules/publishing/domain/claims'
export {
  canApproveDraft,
  canDismissDraft,
  canEditDraft,
  handoverBlockReason,
  rightsAllowHandover,
} from '@/modules/publishing/domain/rights'

// ─── configuration ────────────────────────────────────────────────────────────
export { resolvePublishingConfig } from '@/modules/publishing/domain/config'

// ─── ad-hoc source ────────────────────────────────────────────────────────────
export {
  ADHOC_SOURCE_TYPE,
  adhocSourceProvider,
  createAdhocSource,
  signAdhocImageUrl,
  validateAdhocUpload,
} from '@/modules/publishing/domain/adhoc-source'

// ─── reads ────────────────────────────────────────────────────────────────────
export { loadDraft, loadDrafts, loadRecentDrafts } from '@/modules/publishing/domain/repository'

// ─── drafting + lifecycle (server) ────────────────────────────────────────────
export { generateDrafts } from '@/modules/publishing/domain/drafting'
export {
  approveDraft,
  dismissDraft,
  editDraft,
  handOverApprovedDraft,
} from '@/modules/publishing/domain/lifecycle'

// ─── ui ───────────────────────────────────────────────────────────────────────
export { PublishingShell } from '@/modules/publishing/ui/publishing-shell'
export type {
  PublishingActionState,
  PublishingShellActions,
  PublishingShellChannel,
  PublishingShellProps,
  PublishingShellSource,
} from '@/modules/publishing/ui/publishing-shell'
export { PublishFromHere } from '@/modules/publishing/ui/publish-from-here'
