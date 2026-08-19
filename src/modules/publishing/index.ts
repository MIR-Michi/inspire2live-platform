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
  PostImageRef,
  PostStatus,
  PublishingConfig,
  PublishingDraft,
  PublishingPost,
} from '@/modules/publishing/domain/types'
export {
  DEFAULT_PUBLISHING_CONFIG,
  DRAFT_STATUS_META,
  POST_STATUS_META,
  POST_STATUSES,
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
  rightsAllowHandover,
  rightsBlockReason,
} from '@/modules/publishing/domain/rights'
export {
  canEditPost,
  canTransitionPost,
  nextPostStatuses,
  postDisplayTitle,
  postTransitionBlockReason,
} from '@/modules/publishing/domain/post-status'

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
export {
  loadDraft,
  loadDrafts,
  loadPost,
  loadPostOwnerOptions,
  loadPosts,
  loadPostsForDrafts,
  loadRecentDrafts,
  signPostImages,
} from '@/modules/publishing/domain/repository'

// ─── drafting + lifecycle (server) ────────────────────────────────────────────
export { generateDrafts } from '@/modules/publishing/domain/drafting'
export {
  approveDraft,
  dismissDraft,
  editDraft,
} from '@/modules/publishing/domain/lifecycle'

// ─── saved posts (server) ─────────────────────────────────────────────────────
export {
  attachPostImage,
  deletePost,
  handOverPost,
  postRights,
  removePostImage,
  savePostFromDraft,
  setPostOwner,
  setPostStatus,
  updatePost,
} from '@/modules/publishing/domain/posts'

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
export { PostBoard } from '@/modules/publishing/ui/post-board'
export type { PostBoardProps } from '@/modules/publishing/ui/post-board'
export { PostEditor } from '@/modules/publishing/ui/post-editor'
export type { PostEditorActions, PostEditorProps } from '@/modules/publishing/ui/post-editor'
