/**
 * podcast-planning/ui/onboarding-tour-fixture.ts — the worked example the tour walks through.
 *
 * One question ("why is a proven diagnostic still unreimbursed…") with eight
 * people around it at different stages, so the tour can show the *real* Board,
 * Questions screen and candidate drawer rather than a drawing of them. Every
 * derived number — waiting days, the readiness chips, the score and its
 * breakdown — comes from the same pure functions the live screens use, so the
 * example cannot say something the product would not.
 *
 * All people and organisations here are invented. Dates are relative to now, so
 * "waiting 9 days" stays true whenever somebody watches.
 *
 * A second, deliberately unfinished question sits alongside it: a tour that only
 * ever shows the happy path teaches nothing about the gate.
 */

import type { NamedRoute, NetworkPerson } from '@/modules/network'
import type { RadarProposal, RadarRunStatus } from '@/modules/podcast-planning/domain/radar-types'
import type { ProposalEvidence } from '@/modules/podcast-planning/ui/proposal-card'
import type { RadarReviewItem } from '@/modules/podcast-planning/ui/radar-screen'
import { DEFAULT_PLANNING_CONFIG } from '@/modules/podcast-planning/domain/types'
import type {
  CandidateStage,
  Invitation,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import { scoreCandidate } from '@/modules/podcast-planning/domain/scoring'
import { waitingState } from '@/modules/podcast-planning/domain/stages'
import { summariseQuestions } from '@/modules/podcast-planning/domain/question-summary'
import type { QuestionSummary } from '@/modules/podcast-planning/domain/question-summary'
import type { BoardCard, BoardView } from '@/modules/podcast-planning/domain/repository'

export const TOUR_CONFIG: PlanningConfig = DEFAULT_PLANNING_CONFIG

const DAY = 86_400_000
const NOW = Date.now()

const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString()
const dateAhead = (n: number) => new Date(NOW + n * DAY).toISOString().slice(0, 10)
const dateAgo = (n: number) => new Date(NOW - n * DAY).toISOString().slice(0, 10)

// ─── People ───────────────────────────────────────────────────────────────────

function person(seed: Partial<NetworkPerson> & { id: string; fullName: string }): NetworkPerson {
  return {
    roleTitle: null,
    organisation: null,
    country: null,
    languages: ['English'],
    topicTags: [],
    whatTheyCanSay: null,
    publicProfileUrls: [],
    audienceIndicators: {},
    sharesOwnAppearances: null,
    appearances: [],
    institutionalFriction: 'none',
    industryRelationship: null,
    origin: 'external',
    crmContactId: null,
    profileId: null,
    sourceAttribution: {},
    lastReviewedAt: null,
    ...seed,
  }
}

const PEOPLE: NetworkPerson[] = [
  person({
    id: 'tour-person-bergmann',
    fullName: 'Anna Bergmann',
    roleTitle: 'Clinical geneticist',
    organisation: 'University Medical Centre',
    country: 'Netherlands',
    topicTags: ['diagnostics', 'reimbursement'],
    whatTheyCanSay:
      'Sat on the assessment panel that rejected the test twice, and has said publicly that the evidence bar was applied inconsistently.',
    appearances: [{ show: 'Health Policy Weekly', publishedAt: dateAgo(120) }],
    sharesOwnAppearances: true,
    origin: 'external',
  }),
  person({
    id: 'tour-person-oduya',
    fullName: 'Ruben Oduya',
    roleTitle: 'Health economist',
    organisation: 'National Institute for Care Assessment',
    country: 'Netherlands',
    topicTags: ['HTA', 'reimbursement'],
    whatTheyCanSay: 'Wrote the cost-effectiveness model the decision leaned on.',
    institutionalFriction: 'civil_service',
    origin: 'external',
  }),
  person({
    id: 'tour-person-willems',
    fullName: 'Sanne Willems',
    roleTitle: 'Patient advocate',
    organisation: 'Regional Cancer Network',
    country: 'Netherlands',
    origin: 'crm_contact',
  }),
  person({
    id: 'tour-person-aalders',
    fullName: 'Femke Aalders',
    roleTitle: 'Molecular pathologist',
    organisation: 'University Medical Centre',
    country: 'Netherlands',
    origin: 'external',
  }),
  person({
    id: 'tour-person-meijer',
    fullName: 'Jonas Meijer',
    roleTitle: 'Former committee chair',
    organisation: 'National Institute for Care Assessment',
    country: 'Netherlands',
    origin: 'past_guest',
    sharesOwnAppearances: true,
  }),
  person({
    id: 'tour-person-mensah',
    fullName: 'Kwame Mensah',
    roleTitle: 'Hub coordinator',
    organisation: 'Inspire2Live Ghana',
    country: 'Ghana',
    origin: 'member',
    sharesOwnAppearances: true,
  }),
  person({
    id: 'tour-person-nowak',
    fullName: 'Eva Nowak',
    roleTitle: 'Oncologist',
    organisation: 'Regional Cancer Network',
    country: 'Poland',
    origin: 'external',
  }),
  person({
    id: 'tour-person-haddad',
    fullName: 'Yusuf Haddad',
    roleTitle: 'Trial coordinator',
    organisation: 'University Medical Centre',
    country: 'Netherlands',
    origin: 'external',
  }),
  person({
    id: 'tour-person-silva',
    fullName: 'Marta Silva',
    roleTitle: 'Nurse practitioner',
    organisation: 'Regional Cancer Network',
    country: 'Portugal',
    origin: 'crm_contact',
  }),
]

const PERSON_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]))

/** The People screen's list — past guests, members, CRM contacts and externals. */
export const TOUR_PEOPLE: NetworkPerson[] = PEOPLE

// ─── Questions ────────────────────────────────────────────────────────────────

const REIMBURSEMENT: PodcastQuestion = {
  id: 'tour-question-reimbursement',
  question:
    'Why is a proven molecular diagnostic still unreimbursed three years after parliament heard the case?',
  whyNow:
    'The national assessment reopened last month and the public consultation closes in six weeks.',
  whyNowSourceUrls: ['https://example.org/assessment-reopened'],
  whyNowAt: daysAgo(24),
  anchorDate: dateAhead(42),
  independentSources: 3,
  askType: 'policy_response',
  askDestinationUrl: 'https://example.org/consultation-response',
  askVerifiedAt: daysAgo(6),
  format: 'how_it_works',
  topicTags: ['reimbursement', 'diagnostics'],
  initiativeId: 'tour-initiative',
  onAdvocacyAgenda: true,
  patientRelevance: 'patients',
  questionPull: 6,
  askConversionPrior: 4,
  amplification: 4,
  ownerId: null,
  status: 'live',
  updatedAt: daysAgo(2),
}

/** Deliberately incomplete: no format, no destination for the listener action. */
const TRIALS: PodcastQuestion = {
  id: 'tour-question-trials',
  question:
    'Why do so few patients in regional hospitals hear about a trial they would qualify for?',
  whyNow: 'Two national registries published recruitment gaps within a fortnight of each other.',
  whyNowSourceUrls: [],
  whyNowAt: daysAgo(9),
  anchorDate: null,
  independentSources: 2,
  askType: 'join_initiative',
  askDestinationUrl: null,
  askVerifiedAt: null,
  format: null,
  topicTags: ['trials', 'access'],
  initiativeId: null,
  onAdvocacyAgenda: true,
  patientRelevance: 'both',
  questionPull: 4,
  askConversionPrior: 2,
  amplification: 3,
  ownerId: null,
  status: 'live',
  updatedAt: daysAgo(4),
}

const QUESTIONS: PodcastQuestion[] = [REIMBURSEMENT, TRIALS]

// ─── Candidates ───────────────────────────────────────────────────────────────

function candidate(
  seed: Partial<QuestionCandidate> & {
    id: string
    questionId: string
    personId: string
    stage: CandidateStage
    daysInStage: number
  }
): QuestionCandidate {
  const { daysInStage, ...rest } = seed
  return {
    angle: null,
    stageEnteredAt: daysAgo(daysInStage),
    isAnchor: false,
    route: null,
    recentAppearance: 'none',
    goodMoment: 0,
    practicalities: 2,
    priorRefusal: 'none',
    priorRefusalAt: null,
    guestAudience: 3,
    chanceOfYes: null,
    scoreTotal: null,
    scoredAt: null,
    wakeDate: null,
    closedReason: null,
    closedNote: null,
    overrideBy: null,
    overrideReason: null,
    overrideAt: null,
    recordingDate: null,
    consentConfirmed: false,
    seatsFilled: false,
    willShare: null,
    contentCalendarId: null,
    ...rest,
  }
}

/** The card the drawer opens on: researched, asked, and waiting past the nudge. */
const BERGMANN = candidate({
  id: 'tour-card-bergmann',
  questionId: REIMBURSEMENT.id,
  personId: 'tour-person-bergmann',
  stage: 'ask',
  daysInStage: 9,
  isAnchor: true,
  angle:
    'She sat on the panel that rejected the test twice and will say on the record that the evidence bar moved between assessments.',
  route: 'one_introduction',
  recentAppearance: 'within_12_months',
  goodMoment: 3,
  practicalities: 3,
  guestAudience: 5,
})

const RAW_CANDIDATES: QuestionCandidate[] = [
  BERGMANN,
  candidate({
    id: 'tour-card-oduya',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-oduya',
    stage: 'research',
    daysInStage: 3,
    angle: 'Built the cost-effectiveness model, and can explain which assumption decided it.',
    route: 'two_steps',
    recentAppearance: 'older',
    goodMoment: 2,
    guestAudience: 3,
  }),
  candidate({
    id: 'tour-card-willems',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-willems',
    stage: 'wishlist',
    daysInStage: 11,
  }),
  candidate({
    id: 'tour-card-aalders',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-aalders',
    stage: 'wishlist',
    daysInStage: 11,
  }),
  candidate({
    id: 'tour-card-meijer',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-meijer',
    stage: 'planning',
    daysInStage: 24,
    angle: 'Chaired the committee when the first rejection was written.',
    route: 'already_known',
    recentAppearance: 'within_12_months',
    goodMoment: 2,
    practicalities: 3,
    guestAudience: 4,
  }),
  candidate({
    id: 'tour-card-mensah',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-mensah',
    stage: 'recorded',
    daysInStage: 6,
    angle: 'What happens to the same test where there is no reimbursement system at all.',
    route: 'already_known',
    recentAppearance: 'within_12_months',
    goodMoment: 2,
    practicalities: 3,
    guestAudience: 4,
    recordingDate: dateAgo(6),
    consentConfirmed: true,
    seatsFilled: true,
    willShare: true,
  }),
  candidate({
    id: 'tour-card-nowak',
    questionId: REIMBURSEMENT.id,
    personId: 'tour-person-nowak',
    stage: 'not_now',
    daysInStage: 30,
    angle: 'Treats patients who cross a border to get the test done privately.',
    route: 'cold_hook',
    priorRefusal: 'not_now',
    priorRefusalAt: dateAgo(30),
    wakeDate: dateAgo(1),
    guestAudience: 2,
  }),
  candidate({
    id: 'tour-card-haddad',
    questionId: TRIALS.id,
    personId: 'tour-person-haddad',
    stage: 'ask',
    daysInStage: 5,
    angle: 'Runs recruitment for four regional sites and can say why referrals stop.',
    route: 'one_introduction',
    recentAppearance: 'none',
    goodMoment: 2,
    guestAudience: 2,
  }),
  candidate({
    id: 'tour-card-silva',
    questionId: TRIALS.id,
    personId: 'tour-person-silva',
    stage: 'ask',
    daysInStage: 2,
    angle: 'Is the person patients actually ask about trials.',
    route: 'two_steps',
    goodMoment: 1,
    guestAudience: 2,
  }),
]

const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))

/**
 * Score every card that has been researched, using the real function — so the
 * dots on the board and the breakdown in the drawer are the same arithmetic the
 * product would do. A wishlist card stays unscored on purpose.
 */
const CANDIDATES: QuestionCandidate[] = RAW_CANDIDATES.map((card) => {
  if (card.stage === 'wishlist') return card
  const question = QUESTION_BY_ID.get(card.questionId)!
  const who = PERSON_BY_ID.get(card.personId) ?? null
  const score = scoreCandidate(card, question, {
    institutionalFriction: who?.institutionalFriction ?? 'none',
    sharesOwnAppearances: who?.sharesOwnAppearances ?? null,
    config: TOUR_CONFIG,
  })
  return {
    ...card,
    chanceOfYes: score.breakdown.chanceOfYes.points,
    scoreTotal: score.total,
    scoredAt: daysAgo(1),
  }
})

// ─── What the screens receive ─────────────────────────────────────────────────

const CARDS: BoardCard[] = CANDIDATES.map((candidateRow) => ({
  candidate: candidateRow,
  person: PERSON_BY_ID.get(candidateRow.personId) ?? null,
  question: QUESTION_BY_ID.get(candidateRow.questionId)!,
  waiting: waitingState(candidateRow, { config: TOUR_CONFIG }),
}))

export const TOUR_BOARD: BoardView = {
  questions: QUESTIONS,
  cards: CARDS,
  openAskCount: CANDIDATES.filter((c) => c.stage === 'ask').length,
  orphanedCards: 0,
}

export const TOUR_SUMMARIES: QuestionSummary[] = summariseQuestions(QUESTIONS, CANDIDATES)

export const TOUR_OWNERS: Array<{ id: string; label: string }> = [
  { id: 'tour-owner', label: 'Amit' },
]

/** The introducer route behind the anchor card — one confirmed hop, not a guess. */
const BERGMANN_ROUTES: NamedRoute[] = [
  {
    introducerProfileId: 'tour-member-vos',
    hops: [
      {
        fromType: 'profile',
        fromId: 'tour-member-vos',
        toType: 'person',
        toId: 'tour-person-bergmann',
        connectionType: 'shared_board',
        strength: 0.6,
        confirmed: true,
        evidenceSummary: 'Same national advisory board, 2023–2025 — confirmed by Lina.',
      },
    ],
    steps: 1,
    strength: 0.6,
    confirmed: true,
    connectionId: 'tour-connection-vos-bergmann',
    names: {
      'profile:tour-member-vos': 'Lina Vos',
      'person:tour-person-bergmann': 'Anna Bergmann',
    },
    introducerName: 'Lina Vos',
  },
  {
    introducerProfileId: 'tour-member-jansen',
    hops: [
      {
        fromType: 'profile',
        fromId: 'tour-member-jansen',
        toType: 'person',
        toId: 'tour-person-bergmann',
        connectionType: 'shared_congress_session',
        strength: 0.45,
        confirmed: false,
        evidenceSummary: 'Both spoke in the same congress session last autumn.',
      },
    ],
    steps: 1,
    strength: 0.45,
    confirmed: false,
    connectionId: 'tour-connection-jansen-bergmann',
    names: {
      'profile:tour-member-jansen': 'Pieter Jansen',
      'person:tour-person-bergmann': 'Anna Bergmann',
    },
    introducerName: 'Pieter Jansen',
  },
]

const BERGMANN_INVITATIONS: Invitation[] = [
  {
    id: 'tour-invitation-bergmann',
    candidateId: BERGMANN.id,
    kind: 'introduction',
    introductionRequestId: 'tour-introduction',
    sentBy: 'tour-member-vos',
    sentAt: daysAgo(9),
    messageText: null,
    nudgedAt: null,
    response: null,
    respondedAt: null,
    recallDate: null,
    notes: null,
  },
]

export const TOUR_DRAWER = {
  candidate: CANDIDATES.find((c) => c.id === BERGMANN.id)!,
  question: REIMBURSEMENT,
  person: PERSON_BY_ID.get('tour-person-bergmann') ?? null,
  routes: BERGMANN_ROUTES,
  invitations: BERGMANN_INVITATIONS,
  openAskCount: TOUR_BOARD.openAskCount,
}

// ─── Radar ────────────────────────────────────────────────────────────────────

/**
 * Two papers, from the two catalogues Radar actually reads. Both are needed:
 * the two-source floor is the rule the tour is about to explain, and a
 * one-source example would contradict it on screen.
 */
const RADAR_EVIDENCE: ProposalEvidence[] = [
  {
    id: 'tour-signal-consensus',
    title:
      'Inconsistent evidence thresholds in national reimbursement decisions for molecular diagnostics',
    url: 'https://example.org/records/thresholds',
    publishedAt: dateAgo(11),
    source: 'openalex',
  },
  {
    id: 'tour-signal-registry',
    title: 'Access to molecular testing across four European health systems: a registry analysis',
    url: 'https://example.org/records/access',
    publishedAt: dateAgo(26),
    source: 'europepmc',
  },
]

/**
 * A proposal Radar would produce for a question that does **not** exist yet —
 * the ambient case, which is the one worth showing, because the reader has to
 * understand that accepting opens a draft question rather than filing a name.
 *
 * The angles are written the way the grounding rule forces them to be: about
 * what the paper shows, attributable to the record beside it.
 */
const RADAR_PROPOSAL: RadarProposal = {
  id: 'tour-proposal',
  questionId: null,
  mode: 'topic',
  proposedQuestion:
    'Should a diagnostic be reimbursed on the same evidence in one country and refused in another?',
  whyNow:
    'Two independent groups published inside a fortnight — one showing national thresholds diverging, one measuring what that costs patients.',
  whyNowAt: dateAgo(11),
  signalIds: RADAR_EVIDENCE.map((item) => item.id),
  names: [
    {
      name: 'Clara Vasseur',
      role: 'First author',
      organisation: 'Institut Curie',
      country: 'FR',
      angle:
        'Measured the thresholds diverging, so can say whether it is evidence or appetite that differs.',
      signalId: 'tour-signal-consensus',
      url: 'https://example.org/records/thresholds',
      sourceCount: 2,
    },
    {
      name: 'Nora Roessler',
      role: 'Senior author',
      organisation: 'Charité — Universitätsmedizin Berlin',
      country: 'DE',
      angle: 'Ran the registry analysis and can say what the delay does to the people waiting.',
      signalId: 'tour-signal-registry',
      url: 'https://example.org/records/access',
      sourceCount: 1,
    },
  ],
  status: 'pending',
  dismissedReason: null,
  decidedAt: null,
  openedQuestionId: null,
  openedCandidates: 0,
  createdAt: daysAgo(1),
}

export const TOUR_RADAR: { items: RadarReviewItem[]; status: RadarRunStatus } = {
  items: [{ proposal: RADAR_PROPOSAL, evidence: RADAR_EVIDENCE, questionLabel: null }],
  status: {
    status: 'success',
    message: null,
    startedAt: daysAgo(1),
    finishedAt: daysAgo(1),
    inserted: 1,
  },
}
