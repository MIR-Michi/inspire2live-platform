/**
 * network — public API (the ONLY import surface for other modules and app routes).
 *
 * The reusable half of the Podcast Opportunity Engine (ADR-0013). Everything
 * exported here is deliberately free of podcast vocabulary: `podcast-planning`
 * consumes this contract, and so could any other component that has to reach
 * people it does not yet know.
 *
 * Note what is *not* exported: the row shapes in `domain/schema.ts` and the
 * typed client. Another component reads people through `loadPeopleByIds`, never
 * by querying `network_people` itself (ADR-0009 §9 rules 2–3).
 */

export { manifest } from '@/modules/network/manifest'

// ─── domain vocabulary ───────────────────────────────────────────────────────
export type {
  ActionResult,
  Affiliation,
  AffiliationKind,
  Connection,
  ConnectionCheck,
  ConnectionCheckAnswer,
  ConnectionEvidence,
  ConnectionStatus,
  ConnectionType,
  InstitutionalFriction,
  IntroductionOutcome,
  IntroductionRequest,
  IntroductionResponse,
  MemberAffiliation,
  NetworkConfig,
  NetworkPerson,
  NodeType,
  PersonAffiliation,
  PersonInput,
  PersonOrigin,
  PublicAppearance,
} from '@/modules/network/domain/types'
export {
  AFFILIATION_KIND_META,
  CHECK_ANSWER_META,
  DEFAULT_NETWORK_CONFIG,
  FRICTION_META,
  ORIGIN_META,
} from '@/modules/network/domain/types'

// ─── the route model (pure) ──────────────────────────────────────────────────
export {
  CONNECTION_STRENGTH,
  CONNECTION_TYPE_META,
  connectionTypeForAnswer,
  describeRoute,
  findRoutes,
  rankRoutes,
  routeCategory,
  routeStrength,
  strengthFor,
} from '@/modules/network/domain/connection-strength'
export type { Route, RouteHop } from '@/modules/network/domain/connection-strength'

export {
  normaliseAffiliationName,
  suggestConnections,
  yearsOverlap,
} from '@/modules/network/domain/affiliation-overlap'
export type { SuggestedConnection } from '@/modules/network/domain/affiliation-overlap'

export {
  canRequestIntroduction,
  daysBetween,
  summariseIntroducerLoad,
} from '@/modules/network/domain/fatigue'
export type { FatigueVerdict, IntroducerLoad } from '@/modules/network/domain/fatigue'

// ─── configuration ───────────────────────────────────────────────────────────
export { resolveNetworkConfig } from '@/modules/network/domain/config'

// ─── reads ───────────────────────────────────────────────────────────────────
export {
  countMembersWithAffiliations,
  loadConnectionChecks,
  loadIntroducerHistory,
  loadIntroductionRequests,
  loadMemberAffiliations,
  loadMyOpenChecks,
  loadPeople,
  loadPeopleByIds,
  loadPerson,
  loadPersonAffiliations,
} from '@/modules/network/domain/repository'
export type { PeopleFilter } from '@/modules/network/domain/repository'

export { loadRoutesForPerson } from '@/modules/network/domain/routes'
export type { NamedRoute } from '@/modules/network/domain/routes'

// ─── writes (server actions) ─────────────────────────────────────────────────
export {
  answerConnectionCheck,
  askConnectionCheck,
  buildIntroducerPackage,
  createPerson,
  declareMemberAffiliation,
  deletePerson,
  recordIntroductionOutcome,
  recordIntroductionSent,
  recordObjection,
  refreshSuggestedConnections,
  requestIntroduction,
  respondToIntroduction,
  revokeMemberAffiliation,
  setMemberAffiliationVisibility,
  updatePerson,
  upsertPeopleByName,
} from '@/modules/network/domain/actions'

// ─── ui ──────────────────────────────────────────────────────────────────────
export { PeopleDirectory } from '@/modules/network/ui/people-directory'
export { IntroductionsBoard } from '@/modules/network/ui/introductions-board'
export { RouteExplorer } from '@/modules/network/ui/route-explorer'
export { AffiliationProfileForm } from '@/modules/network/ui/affiliation-profile-form'
export { ConnectionCheckPanel } from '@/modules/network/ui/connection-check-panel'
