/**
 * podcast-planning/domain/types.ts — the editorial vocabulary.
 *
 * Three nested levels (concept §2): a **question** the podcast is asking, a
 * **candidate** (one person on one question — the card that moves), and an
 * **invitation** (one attempt to reach one person by one route).
 */

// ─── Episode formats (concept §9) ────────────────────────────────────────────

export type EpisodeFormat =
  | 'advocate_meets_expert'
  | 'the_disagreement'
  | 'how_it_works'
  | 'hub_story'
  | 'congress_episode'
  | 'initiative_update'

export const FORMAT_META: Record<
  EpisodeFormat,
  {
    label: string
    shape: string
    bestFor: string
    reach: string
    /** How many guests must be secured before the card can leave Planning. */
    guestSeats: number
    /** True when the format also needs an advocate alongside the guest. */
    needsAdvocate: boolean
  }
> = {
  advocate_meets_expert: {
    label: 'Advocate meets expert',
    shape: 'A patient advocate puts the constituency’s question to an authority.',
    bestFor: 'Researchers, clinicians, new evidence',
    reach: 'Steady. The signature format and the easiest yes.',
    guestSeats: 1,
    needsAdvocate: true,
  },
  the_disagreement: {
    label: 'The disagreement',
    shape: 'Two people who genuinely differ, with an advocate holding the frame.',
    bestFor: 'Contested topics: access, pricing, screening thresholds',
    reach: 'Highest peaks, hardest to produce. Needs a real disagreement.',
    guestSeats: 2,
    needsAdvocate: true,
  },
  how_it_works: {
    label: 'How it actually works',
    shape: 'One guest walks through a mechanism and where it fails.',
    bestFor: 'Reimbursement, HTA, regulatory pathways, trial design',
    reach: 'Lower peak, long tail, best follow-up conversion.',
    guestSeats: 1,
    needsAdvocate: false,
  },
  hub_story: {
    label: 'Hub story',
    shape: 'A regional coordinator and a local expert on a problem invisible from Europe.',
    bestFor: 'Regional hubs',
    reach: 'Nobody else is making these, which is the argument for making them.',
    guestSeats: 1,
    needsAdvocate: true,
  },
  congress_episode: {
    label: 'Congress episode',
    shape: 'Recorded around a congress.',
    bestFor: 'Keynote speakers, session chairs',
    reach: 'A burst of episodes, and the most efficient booking there is.',
    guestSeats: 1,
    needsAdvocate: false,
  },
  initiative_update: {
    label: 'Initiative update',
    shape: 'Progress and obstacles on a live initiative.',
    bestFor: 'Initiative leads and their institutional counterparts',
    reach: 'Modest reach, high conversion, builds institutional memory.',
    guestSeats: 1,
    needsAdvocate: false,
  },
}

// ─── The listener action (concept §11) ───────────────────────────────────────

export type AskType =
  | 'join_initiative'
  | 'register_congress'
  | 'submit_story'
  | 'join_hub'
  | 'subscribe'
  | 'policy_response'

export const ASK_META: Record<AskType, { label: string; pointsAt: string; worksWith: EpisodeFormat[] }> = {
  join_initiative: {
    label: 'Join an initiative',
    pointsAt: 'Initiative workspace signup',
    worksWith: ['initiative_update', 'how_it_works'],
  },
  register_congress: {
    label: 'Register for the Annual Congress',
    pointsAt: 'Congress registration',
    worksWith: ['congress_episode', 'the_disagreement'],
  },
  submit_story: {
    label: 'Submit a patient story',
    pointsAt: 'Patient story intake',
    worksWith: ['advocate_meets_expert', 'hub_story'],
  },
  join_hub: { label: 'Join a hub or World Campus', pointsAt: 'Hub signup', worksWith: ['hub_story'] },
  subscribe: {
    label: 'Subscribe',
    pointsAt: 'Newsletter',
    worksWith: [
      'advocate_meets_expert',
      'the_disagreement',
      'how_it_works',
      'hub_story',
      'congress_episode',
      'initiative_update',
    ],
  },
  policy_response: {
    label: 'Respond to a policy moment',
    pointsAt: 'Consultation response or open letter',
    worksWith: ['how_it_works', 'the_disagreement'],
  },
}

// ─── The question ────────────────────────────────────────────────────────────

export type QuestionStatus = 'draft' | 'live' | 'retired'

export type PodcastQuestion = {
  id: string
  question: string
  whyNow: string | null
  whyNowSourceUrls: string[]
  whyNowAt: string | null
  anchorDate: string | null
  independentSources: number
  askType: AskType | null
  askDestinationUrl: string | null
  askVerifiedAt: string | null
  format: EpisodeFormat | null
  topicTags: string[]
  initiativeId: string | null
  onAdvocacyAgenda: boolean
  patientRelevance: 'patients' | 'both' | 'field'
  questionPull: number
  askConversionPrior: number
  amplification: number
  ownerId: string | null
  status: QuestionStatus
  updatedAt: string
}

// ─── The card that moves ─────────────────────────────────────────────────────

export type CandidateStage =
  | 'wishlist'
  | 'research'
  | 'ask'
  | 'planning'
  | 'booked'
  | 'recorded'
  | 'not_now'
  | 'closed'

/** The five routes the score knows about (concept §7). */
export type CandidateRoute =
  | 'already_known'
  | 'one_introduction'
  | 'two_steps'
  | 'cold_hook'
  | 'press_office'

export const ROUTE_META: Record<
  CandidateRoute,
  { label: string; meaning: string; points: number; approach: string }
> = {
  already_known: {
    label: 'Already known',
    meaning: 'Past guest, ambassador, active partner, or a founder contact.',
    points: 12,
    approach: 'Direct invitation from whoever holds the relationship. No intermediary.',
  },
  one_introduction: {
    label: 'One introduction',
    meaning: 'A named member knows them and has confirmed it.',
    points: 10,
    approach: 'Introduction request to that person.',
  },
  two_steps: {
    label: 'Two steps',
    meaning: 'A member knows somebody who knows them, or a strong shared context exists.',
    points: 7,
    approach: 'A two-step introduction, or a direct approach naming the mutual contact.',
  },
  cold_hook: {
    label: 'Cold, with a hook',
    meaning: 'No connection, but something public to hang the request on.',
    points: 4,
    approach: 'Direct approach built entirely on the hook, credentials in the first line.',
  },
  press_office: {
    label: 'Through a press office',
    meaning: 'All access runs through institutional media approval.',
    points: 1,
    approach: 'Formal request, long lead time, plan the episode around a fixed date.',
  },
}

export type RecentAppearance = 'within_12_months' | 'older' | 'none'
export type PriorRefusal = 'none' | 'not_now' | 'soft_no' | 'firm_no'

export type ClosedReason = 'declined' | 'no_reply' | 'no_route' | 'wrong_person' | 'moment_passed'

export const CLOSED_REASON_META: Record<ClosedReason, string> = {
  declined: 'Declined',
  no_reply: 'No reply',
  no_route: 'No route found',
  wrong_person: 'Wrong person after all',
  moment_passed: 'The moment passed',
}

export type QuestionCandidate = {
  id: string
  questionId: string
  /** Soft reference into the `network` component — resolved, never joined. */
  personId: string
  angle: string | null
  stage: CandidateStage
  stageEnteredAt: string
  isAnchor: boolean
  route: CandidateRoute | null
  recentAppearance: RecentAppearance
  goodMoment: number
  practicalities: number
  priorRefusal: PriorRefusal
  priorRefusalAt: string | null
  guestAudience: number
  chanceOfYes: number | null
  scoreTotal: number | null
  scoredAt: string | null
  wakeDate: string | null
  closedReason: ClosedReason | null
  closedNote: string | null
  overrideBy: string | null
  overrideReason: string | null
  overrideAt: string | null
  recordingDate: string | null
  consentConfirmed: boolean
  seatsFilled: boolean
  willShare: boolean | null
  contentCalendarId: string | null
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export type InvitationKind = 'introduction' | 'direct'
export type InvitationResponse = 'yes' | 'not_now' | 'declined' | 'no_reply'

export type Invitation = {
  id: string
  candidateId: string
  kind: InvitationKind
  introductionRequestId: string | null
  sentBy: string | null
  sentAt: string
  messageText: string | null
  nudgedAt: string | null
  response: InvitationResponse | null
  respondedAt: string | null
  recallDate: string | null
  notes: string | null
}

// ─── Write shapes ────────────────────────────────────────────────────────────
//
// Here rather than beside the actions because a `'use server'` file may only
// export async functions.

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export type QuestionInput = {
  question: string
  whyNow?: string | null
  whyNowSourceUrls?: string[]
  whyNowAt?: string | null
  anchorDate?: string | null
  independentSources?: number
  askType?: AskType | null
  askDestinationUrl?: string | null
  format?: EpisodeFormat | null
  topicTags?: string[]
  initiativeId?: string | null
  onAdvocacyAgenda?: boolean
  patientRelevance?: 'patients' | 'both' | 'field'
  questionPull?: number
  askConversionPrior?: number
  amplification?: number
  ownerId?: string | null
  status?: QuestionStatus
}

/** The four Research findings that turn a name into a scorable card. */
export type ResearchInput = {
  angle?: string | null
  route?: CandidateRoute | null
  recentAppearance?: RecentAppearance
  goodMoment?: number
  practicalities?: number
  priorRefusal?: PriorRefusal
  priorRefusalAt?: string | null
  guestAudience?: number
}

// ─── Component configuration (ADR-0013 §3) ───────────────────────────────────

export type PlanningConfig = {
  /** Cards in Ask, across all questions. The one hard ceiling in the product. */
  openAskLimit: number
  /** How many questions may be live at once. */
  liveQuestionLimit: number
  /** One nudge after this many days waiting. */
  nudgeAfterDays: number
  /** Silence past this many days is treated as a no. */
  silenceIsNoAfterDays: number
  /** A card sitting in Planning this long needs a nudge rather than patience. */
  planningStallDays: number
  /** Days over which the timeliness part of the score halves. */
  timelinessHalfLifeDays: number
}

export const DEFAULT_PLANNING_CONFIG: PlanningConfig = {
  openAskLimit: 6,
  liveQuestionLimit: 4,
  nudgeAfterDays: 7,
  silenceIsNoAfterDays: 14,
  planningStallDays: 21,
  timelinessHalfLifeDays: 60,
}
