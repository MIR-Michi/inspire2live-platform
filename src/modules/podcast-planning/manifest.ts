/**
 * podcast-planning — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * The editorial half of the Podcast Opportunity Engine (ADR-0013): the questions
 * the podcast is asking, one card per person per question moving through six
 * stages, versioned score snapshots, and every invitation sent.
 *
 * It depends on `network@^1` for people and routes, and reads that contract
 * through `@/modules/network` only — never its tables. That is why
 * `podcast_question_candidates.person_id` carries no foreign key.
 *
 * Not part of `events`: the podcast *episode* stays there, and a Recorded card
 * hands over to the content calendar rather than duplicating it.
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: 'podcast-planning',
  version: '1.0.0',
  title: 'Podcast Planning & Strategy',
  summary:
    'Decides what the podcast should ask next, keeps a ranked wishlist of people who could answer each question, and tracks every invitation from first idea to booked recording.',
  surface: 'internal',
  data: {
    schema: 'podcast_planning',
    tablePrefix: 'podcast_',
    tables: [
      'podcast_questions',
      'podcast_question_candidates',
      'podcast_candidate_scores',
      'podcast_invitations',
    ],
    migrations: ['00172'],
  },
  provides: {
    api: [
      // questions
      'loadQuestions',
      'loadQuestion',
      'summariseQuestions',
      'questionReadiness',
      'createQuestion',
      'updateQuestion',
      'verifyAskDestination',
      'retireQuestion',
      // the board
      'loadBoard',
      'loadCandidates',
      'addCandidate',
      'recordResearch',
      'moveCandidate',
      'setAnchor',
      'overrideRanking',
      'rescoreCandidate',
      // scoring (pure)
      'scoreCandidate',
      'chanceOfYes',
      'bandFor',
      'rankCandidates',
      'summariseScore',
      // stages (pure)
      'canAdvance',
      'waitingState',
      'boardAgenda',
      'countOpenAsks',
      'dueToWake',
      // invitations
      'loadInvitations',
      'recordInvitation',
      'nudgeInvitation',
      'recordInvitationResponse',
      // handover + import
      'handOverToContentCalendar',
      'importPastGuests',
      'loadScoreHistory',
    ],
    events: ['podcast.candidate.booked', 'podcast.candidate.recorded'],
    ui: ['PlanningStrategyShell', 'OpportunityBoard', 'QuestionsScreen', 'CandidateDrawer'],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'data', 'settings'],
    // People and routes come from `network`'s published contract; the content
    // calendar handover goes through `content`'s.
    components: ['network@^1', 'content@^1', 'events@^1'],
  },
  // The concept is explicit that these are *starting values to be calibrated
  // against real outcomes*, so they are settings rather than constants
  // (ADR-0013 §3). Scoring weights are deliberately not here: they are versioned
  // in `podcast_candidate_scores`, so changing one stays auditable.
  config: {
    openAskLimit: {
      type: 'number',
      label: 'Open asks at once',
      description:
        'Cards allowed in Ask across all questions. Every open request needs following up and every introducer request spends somebody’s goodwill — so chasing is capped while research is not.',
      default: 6,
      min: 1,
      max: 50,
      step: 1,
    },
    liveQuestionLimit: {
      type: 'number',
      label: 'Live questions at once',
      description:
        'How many questions may be live. If there is less planning time than assumed, cut this rather than skipping Research — skipping Research is what produces cold pitches that fail.',
      default: 4,
      min: 1,
      max: 20,
      step: 1,
    },
    nudgeAfterDays: {
      type: 'number',
      label: 'Nudge after (days)',
      description: 'One nudge once a request has been waiting this long.',
      default: 7,
      min: 1,
      max: 60,
      step: 1,
    },
    silenceIsNoAfterDays: {
      type: 'number',
      label: 'Silence is a no after (days)',
      description:
        'Past this, the card returns to Research for a different route, or to the wishlist for a different person.',
      default: 14,
      min: 2,
      max: 120,
      step: 1,
    },
    planningStallDays: {
      type: 'number',
      label: 'Planning stall flag (days)',
      description:
        'A card sitting in Planning this long is flagged. This is where bookings quietly die, almost always because a date drifted.',
      default: 21,
      min: 3,
      max: 120,
      step: 1,
    },
    timelinessHalfLifeDays: {
      type: 'number',
      label: 'Timeliness half-life (days)',
      description:
        'How fast the timeliness part of the score decays, so wishlists clean themselves and stale names sink without anyone pruning.',
      default: 60,
      min: 7,
      max: 365,
      step: 1,
    },
  },
  featureFlag: 'comms_team',
  personas: ['communications-coordinator'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: ['REQ-POD-001', 'REQ-POD-002', 'REQ-POD-003', 'REQ-POD-004'],
  operations: [],
})

export default manifest
