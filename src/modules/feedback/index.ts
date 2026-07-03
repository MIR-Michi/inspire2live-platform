/**
 * feedback — public API (the ONLY import surface for other modules and app routes).
 *
 * The reference component for the modular architecture (ADR-0009): domain +
 * ui + api all live under src/modules/feedback and are exposed here. App routes
 * import from `@/modules/feedback`, never its internals.
 */

export { manifest } from '@/modules/feedback/manifest'

// domain — types + display metadata
export type { FeedbackItem, FeedbackType, FeedbackStatus } from '@/modules/feedback/domain/types'
export { FEEDBACK_TYPE_META, FEEDBACK_STATUS_META, shortUrl } from '@/modules/feedback/domain/types'

// domain — reads
export {
  loadFeedbackItems,
  loadFeedbackStatusCounts,
  requireFeedbackAdmin,
} from '@/modules/feedback/domain/repository'
export type { FeedbackStatusCounts } from '@/modules/feedback/domain/repository'

// domain — writes (server actions)
export {
  createFeedbackItem,
  updateFeedbackStatus,
  deleteFeedbackItem,
} from '@/modules/feedback/domain/actions'

// api — route handler logic
export { handleFeedbackExport } from '@/modules/feedback/api/export'

// ui
export { FeedbackOverlay } from '@/modules/feedback/ui/feedback-overlay'
export { TestModeProvider, useTestMode } from '@/modules/feedback/ui/test-mode-context'
export { FeedbackItemsList } from '@/modules/feedback/ui/feedback-items-list'
