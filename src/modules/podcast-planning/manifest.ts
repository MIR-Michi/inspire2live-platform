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
 *
 * Phase B adds Radar (ADR-0016): signals read from open scholarly APIs through
 * `@/kernel/sources`, grouped by a model into one reviewable proposal, which on
 * acceptance writes people through `network`'s API and unscored wishlist cards
 * through this component's own. Radar contributes stored fields — sources,
 * dates — and never a term in the score.
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
      'podcast_radar_signals',
      'podcast_radar_proposals',
      'podcast_radar_status',
    ],
    migrations: ['00172', '00175'],
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
      // radar (Phase B)
      'findNamesForQuestion',
      'acceptProposal',
      'dismissProposal',
      'loadProposals',
      'loadRadarStatus',
      'countPendingProposals',
      'runRadarScan',
      'radarDedupeKey',
      'anonymiseClosedCards',
    ],
    events: ['podcast.candidate.booked', 'podcast.candidate.recorded'],
    ui: [
      'PlanningStrategyShell',
      'OpportunityBoard',
      'QuestionsScreen',
      'CandidateDrawer',
      'PodcastOnboardingTour',
      'RadarScreen',
      'FindNamesButton',
    ],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'data', 'settings', 'ai-client', 'sources'],
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
    // ── Radar (Phase B). Thresholds, not constants: the ten-cards-a-fortnight
    // target is a design guess until three real reviews have been run.
    radarEnabled: {
      type: 'boolean',
      label: 'Radar scan enabled',
      description:
        'Whether the scheduled scan runs. "Find names" on a question is a person pressing a button and is never affected by this.',
      default: true,
    },
    radarIntervalDays: {
      type: 'number',
      label: 'Scan every (days)',
      description:
        'Matches the working rhythm. A scan more often than the review that clears it just builds a backlog, which is the inbox Radar exists to avoid.',
      default: 14,
      min: 1,
      max: 90,
      step: 1,
    },
    radarDomainAnchor: {
      type: 'string',
      label: 'Always search within',
      description:
        'Kept in every Radar query so a question’s leftover words cannot wander out of the field. Without it, "does earlier detection actually change outcomes" returns kidney-stone diagnostics.',
      default: 'cancer',
    },
    radarLookbackDays: {
      type: 'number',
      label: 'Look back (days)',
      description: 'How far back a scan reads the open sources for new material.',
      default: 120,
      min: 7,
      max: 730,
      step: 1,
    },
    radarMaxNames: {
      type: 'number',
      label: 'Names per proposal',
      description:
        'The most people one proposal may suggest. A shortlist somebody reads beats a list they scroll.',
      default: 6,
      min: 1,
      max: 20,
      step: 1,
    },
    radarMinSources: {
      type: 'number',
      label: 'Sources before a topic appears',
      description:
        'One paper is not a topic. Three independent sources in a fortnight is itself the reason to record now — and is where the timeliness score saturates.',
      default: 2,
      min: 1,
      max: 10,
      step: 1,
    },
    radarMaxTopicsPerRun: {
      type: 'number',
      label: 'Topics per scan',
      description:
        'Surplus is dropped, never queued. If more clear the bar than this allows, the bar is wrong.',
      default: 10,
      min: 1,
      max: 50,
      step: 1,
    },
    radarMaxSearchesPerRun: {
      type: 'number',
      label: 'Search calls per run',
      description: 'Hard ceiling on provider web searches in one run — the per-run half of the cost guard.',
      default: 8,
      min: 0,
      max: 60,
      step: 1,
    },
    radarMonthlyBudgetUsd: {
      type: 'number',
      label: 'Monthly AI budget (USD)',
      description:
        'A scheduled run checks the trailing thirty days of recorded AI spend and refuses if this is exceeded, saying so in the run status. It never blocks a person pressing a button.',
      default: 25,
      min: 1,
      max: 1000,
      step: 1,
    },
    retentionClosedCardMonths: {
      type: 'number',
      label: 'Anonymise closed cards after (months)',
      description:
        'A closed card keeps its reason — which is what the model learns from — but loses the note and the person it pointed at.',
      default: 12,
      min: 1,
      max: 120,
      step: 1,
    },
  },
  featureFlag: 'comms_team',
  personas: ['communications-coordinator'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: [
    'REQ-POD-001',
    'REQ-POD-002',
    'REQ-POD-003',
    'REQ-POD-004',
    'REQ-RAD-001',
    'REQ-RAD-002',
    'REQ-RAD-003',
    'REQ-RAD-004',
    'REQ-RAD-005',
    'REQ-RAD-006',
  ],
  operations: [],
})

export default manifest
