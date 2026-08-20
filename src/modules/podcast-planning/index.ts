/**
 * podcast-planning — public API (the ONLY import surface for other modules and
 * app routes).
 *
 * The editorial half of the Podcast Opportunity Engine (ADR-0013). It consumes
 * `@/modules/network` for people and routes and exposes the planner to the thin
 * `/app/comms/podcast` route.
 */

export { manifest } from '@/modules/podcast-planning/manifest'

// ─── domain vocabulary ───────────────────────────────────────────────────────
export type {
  ActionResult,
  AskType,
  CandidateRoute,
  CandidateStage,
  ClosedReason,
  EpisodeFormat,
  Invitation,
  InvitationKind,
  InvitationResponse,
  PlanningConfig,
  PodcastQuestion,
  PriorRefusal,
  QuestionCandidate,
  QuestionInput,
  QuestionStatus,
  RecentAppearance,
  ResearchInput,
} from '@/modules/podcast-planning/domain/types'
export {
  ASK_META,
  CLOSED_REASON_META,
  DEFAULT_PLANNING_CONFIG,
  FORMAT_META,
  ROUTE_META,
} from '@/modules/podcast-planning/domain/types'

// ─── stages (pure) ───────────────────────────────────────────────────────────
export {
  BOARD_STAGES,
  boardAgenda,
  canAdvance,
  countOpenAsks,
  dueToWake,
  isWaitingStage,
  questionReadiness,
  STAGE_META,
  waitingState,
} from '@/modules/podcast-planning/domain/stages'
export type {
  QuestionReadiness,
  TransitionContext,
  TransitionVerdict,
  WaitingState,
} from '@/modules/podcast-planning/domain/stages'

// ─── scoring (pure) ──────────────────────────────────────────────────────────
export {
  BAND_META,
  PART_LABELS,
  SCORE_PARTS,
  WEIGHTS_VERSION,
  bandFor,
  chanceOfYes,
  decayFactor,
  followupScore,
  formatScore,
  missionScore,
  rankCandidates,
  reachScore,
  scoreCandidate,
  summariseScore,
  timelinessScore,
} from '@/modules/podcast-planning/domain/scoring'
export type {
  CandidateScore,
  PartScore,
  ScoreBand,
  ScoreLine,
  ScorePart,
} from '@/modules/podcast-planning/domain/scoring'

// ─── the Guests-tab migration (pure) ─────────────────────────────────────────
export {
  extractPastGuests,
  guestToPersonInput,
} from '@/modules/podcast-planning/domain/guest-import'
export type {
  EpisodeGuestSource,
  ImportableGuest,
} from '@/modules/podcast-planning/domain/guest-import'

// ─── configuration ───────────────────────────────────────────────────────────
export { resolvePlanningConfig } from '@/modules/podcast-planning/domain/config'

// ─── reads ───────────────────────────────────────────────────────────────────
export {
  loadBoard,
  loadCandidates,
  loadInvitations,
  loadQuestion,
  loadQuestions,
  loadScoreHistory,
} from '@/modules/podcast-planning/domain/repository'
export type {
  BoardCard,
  BoardView,
  ScoreSnapshot,
} from '@/modules/podcast-planning/domain/repository'
export { summariseQuestions } from '@/modules/podcast-planning/domain/question-summary'
export type { QuestionSummary } from '@/modules/podcast-planning/domain/question-summary'

// ─── writes (server actions) ─────────────────────────────────────────────────
export {
  addCandidate,
  createQuestion,
  handOverToContentCalendar,
  importPastGuests,
  moveCandidate,
  nudgeInvitation,
  overrideRanking,
  recordInvitation,
  recordInvitationResponse,
  recordResearch,
  rescoreCandidate,
  retireQuestion,
  setAnchor,
  updateQuestion,
  verifyAskDestination,
} from '@/modules/podcast-planning/domain/actions'

// ─── ui ──────────────────────────────────────────────────────────────────────
export { PlanningStrategyShell } from '@/modules/podcast-planning/ui/planning-strategy-shell'
export type { PlanningScreen } from '@/modules/podcast-planning/ui/planning-strategy-shell'
export { OpportunityBoard } from '@/modules/podcast-planning/ui/opportunity-board'
export { QuestionsScreen } from '@/modules/podcast-planning/ui/questions-screen'
export { CandidateDrawer } from '@/modules/podcast-planning/ui/candidate-drawer'
export { PodcastOnboardingTour } from '@/modules/podcast-planning/ui/onboarding-tour-screens'
