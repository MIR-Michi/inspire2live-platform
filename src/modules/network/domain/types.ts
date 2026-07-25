/**
 * network/domain/types.ts — the relationship-graph vocabulary.
 *
 * Deliberately free of any podcast (or Inspire2Live) vocabulary: this component
 * is the reusable half of the Opportunity Engine and must stay liftable into a
 * second platform (ADR-0013 §1).
 */

// ─── People ───────────────────────────────────────────────────────────────────

/** Where a person record came from. Drives filtering and the "already known" route. */
export type PersonOrigin = 'past_guest' | 'member' | 'crm_contact' | 'external'

/** Approval overhead that lengthens or kills an approach. */
export type InstitutionalFriction =
  | 'none'
  | 'pharmaceutical'
  | 'regulator'
  | 'civil_service'
  | 'press_office'

export const FRICTION_META: Record<InstitutionalFriction, { label: string; note: string }> = {
  none: { label: 'None', note: 'No institutional approval needed.' },
  pharmaceutical: { label: 'Pharma media approval', note: 'Company communications sign-off.' },
  regulator: { label: 'Regulator', note: 'Active regulators speak under a media policy.' },
  civil_service: { label: 'Civil service', note: 'Civil-service rules on public comment.' },
  press_office: { label: 'Press office', note: 'All access runs through institutional media approval.' },
}

export const ORIGIN_META: Record<PersonOrigin, { label: string; note: string }> = {
  past_guest: { label: 'Past guest', note: 'Proven willingness and a live relationship.' },
  member: { label: 'Member', note: 'Inside the organisation — available at short notice.' },
  crm_contact: { label: 'CRM contact', note: 'An existing relationship, usually dormant.' },
  external: { label: 'External', note: 'Worth reaching but not yet reachable.' },
}

/** A public appearance, used by the strongest single predictor in the model. */
export type PublicAppearance = {
  show: string
  url?: string | null
  publishedAt?: string | null
}

export type NetworkPerson = {
  id: string
  fullName: string
  roleTitle: string | null
  organisation: string | null
  country: string | null
  languages: string[]
  topicTags: string[]
  whatTheyCanSay: string | null
  publicProfileUrls: Array<{ label?: string; url: string }>
  audienceIndicators: Record<string, unknown>
  sharesOwnAppearances: boolean | null
  appearances: PublicAppearance[]
  institutionalFriction: InstitutionalFriction
  industryRelationship: string | null
  origin: PersonOrigin
  crmContactId: string | null
  profileId: string | null
  /** Per-field provenance. A field with no source is unverified (concept §16). */
  sourceAttribution: Record<string, string>
  lastReviewedAt: string | null
}

// ─── Affiliations ─────────────────────────────────────────────────────────────

export type AffiliationKind =
  | 'institution'
  | 'society'
  | 'congress'
  | 'board'
  | 'university'
  | 'disease_area'
  | 'country'

export const AFFILIATION_KIND_META: Record<AffiliationKind, { label: string; help: string }> = {
  institution: { label: 'Institutions worked at', help: 'Hospitals, universities, companies — roughly which years.' },
  society: { label: 'Professional societies', help: 'Societies and working groups you belong to.' },
  congress: { label: 'Congresses attended', help: 'Congresses you go to regularly.' },
  board: { label: 'Boards & committees', help: 'Boards, committees and advisory panels.' },
  university: { label: 'Universities attended', help: 'Where you studied.' },
  disease_area: { label: 'Disease areas', help: 'The areas you work in.' },
  country: { label: 'Countries', help: 'Where you work.' },
}

export type Affiliation = {
  kind: AffiliationKind
  name: string
  fromYear: number | null
  toYear: number | null
}

export type PersonAffiliation = Affiliation & {
  id: string
  personId: string
  sourceUrl: string | null
}

/** A member's declaration. `private` = declared but not to be used for routing. */
export type MemberAffiliation = Affiliation & {
  id: string
  profileId: string
  visibility: 'network' | 'private'
}

// ─── The graph ────────────────────────────────────────────────────────────────

export type ConnectionType =
  | 'knows_well'
  | 'published_together'
  | 'knows_a_little'
  | 'shared_board'
  | 'shared_congress_session'
  | 'shared_institution'
  | 'shared_society'
  | 'shared_country'

export type NodeType = 'profile' | 'person'

export type ConnectionStatus = 'suggested' | 'confirmed' | 'rejected'

export type ConnectionEvidence = {
  kind: string
  detail: string
  sourceUrl?: string | null
}

export type Connection = {
  id: string
  fromType: NodeType
  fromId: string
  toType: NodeType
  toId: string
  connectionType: ConnectionType
  strength: number
  evidence: ConnectionEvidence[]
  status: ConnectionStatus
  confirmedBy: string | null
  confirmedAt: string | null
}

// ─── The map question ─────────────────────────────────────────────────────────

/**
 * The five answers. `rather_not` is a first-class answer and is never rendered
 * as a failure — somebody's relationships are theirs to spend.
 */
export type ConnectionCheckAnswer =
  | 'knows_well'
  | 'knows_a_little'
  | 'knows_someone'
  | 'no'
  | 'rather_not'

export const CHECK_ANSWER_META: Record<ConnectionCheckAnswer, { label: string; tone: 'yes' | 'maybe' | 'no' | 'neutral' }> = {
  knows_well: { label: 'Yes, well', tone: 'yes' },
  knows_a_little: { label: 'Yes, a little', tone: 'maybe' },
  knows_someone: { label: 'No, but I know someone who does', tone: 'maybe' },
  no: { label: 'No', tone: 'no' },
  rather_not: { label: 'I would rather not ask', tone: 'neutral' },
}

export type ConnectionCheck = {
  id: string
  profileId: string
  personId: string
  contextNote: string | null
  askedAt: string
  answer: ConnectionCheckAnswer | null
  answerNote: string | null
  answeredAt: string | null
}

// ─── The favour ───────────────────────────────────────────────────────────────

/** `use_my_name` = "write to them yourself and say I sent you". */
export type IntroductionResponse = 'yes' | 'use_my_name' | 'declined' | 'no_reply'

export type IntroductionOutcome = 'guest_accepted' | 'guest_declined' | 'no_reply' | 'not_pursued'

export type IntroductionRequest = {
  id: string
  contextType: string
  contextId: string | null
  contextSummary: string | null
  introducerProfileId: string
  personId: string
  connectionId: string | null
  requestedAt: string
  response: IntroductionResponse | null
  respondedAt: string | null
  introSentAt: string | null
  outcome: IntroductionOutcome | null
  notes: string | null
}

// ─── Write shapes ─────────────────────────────────────────────────────────────
//
// Declared here rather than next to the actions because a `'use server'` file
// may only export async functions.

/** The result every write action returns, so callers never have to guess. */
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

/** What a caller may set on a person. Professional information only (§16). */
export type PersonInput = {
  fullName: string
  roleTitle?: string | null
  organisation?: string | null
  country?: string | null
  languages?: string[]
  topicTags?: string[]
  whatTheyCanSay?: string | null
  publicProfileUrls?: Array<{ label?: string; url: string }>
  sharesOwnAppearances?: boolean | null
  appearances?: PublicAppearance[]
  institutionalFriction?: string
  industryRelationship?: string | null
  origin?: PersonOrigin
  crmContactId?: string | null
  profileId?: string | null
  /** Per-field provenance. A field with no source stays out of scoring (§16). */
  sourceAttribution?: Record<string, string>
  notes?: string | null
}

// ─── Component configuration ──────────────────────────────────────────────────

/**
 * Every threshold the concept names, in one injectable shape. Sourced from the
 * manifest `config` (and therefore editable in Platform Settings) rather than
 * hardcoded, which is what "tenant-aware from the start" means here — see
 * ADR-0013 §3.
 */
export type NetworkConfig = {
  /** Routes weaker than this are never offered; a weak route wastes goodwill. */
  minRouteStrength: number
  /** How many routes to show on a card. */
  maxRoutesShown: number
  /** Multiplier applied to a two-step route (0.85 = the 15 % discount). */
  twoStepDiscount: number
  /** Nobody receives more than one favour request per this many days. */
  introducerCooldownDays: number
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  minRouteStrength: 0.2,
  maxRoutesShown: 3,
  twoStepDiscount: 0.85,
  introducerCooldownDays: 14,
}
