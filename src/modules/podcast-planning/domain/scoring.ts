/**
 * podcast-planning/domain/scoring.ts — the 100-point score.
 *
 * Concept §7 and §10. **Plain arithmetic over stored fields**: no model call, no
 * hidden weights, no randomness. That is a product requirement, not an
 * implementation preference — "a number nobody can explain would be worse than
 * the instinct it replaced" — so every function here returns its breakdown
 * alongside its total, and every computation is stamped with a weights version.
 *
 *   Chance of a yes 25 · Reach 20 · Timeliness 20 · Follow-up 15 · Mission 15 · Format 5
 */

import type {
  CandidateRoute,
  EpisodeFormat,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import {
  ASK_META,
  DEFAULT_PLANNING_CONFIG,
  FORMAT_META,
  ROUTE_META,
} from '@/modules/podcast-planning/domain/types'

/**
 * Bump this whenever a weight or a rule changes. Every snapshot carries it, so a
 * historical number stays reproducible and a weight change stays auditable
 * (ADR-0013 §3).
 */
export const WEIGHTS_VERSION = 'v1'

/** The six parts and their maxima. */
export const SCORE_PARTS = {
  chanceOfYes: 25,
  reach: 20,
  timeliness: 20,
  followup: 15,
  mission: 15,
  formatFit: 5,
} as const

export type ScorePart = keyof typeof SCORE_PARTS

export type ScoreLine = { label: string; points: number; max: number; note: string }

export type PartScore = { points: number; max: number; lines: ScoreLine[] }

export type CandidateScore = {
  weightsVersion: string
  chanceOfYes: number
  reach: number
  timeliness: number
  followup: number
  mission: number
  formatFit: number
  total: number
  band: ScoreBand
  breakdown: Record<ScorePart, PartScore>
  /** The single strongest and weakest part — what the card shows in one line. */
  strongest: ScorePart
  weakest: ScorePart
}

export type ScoreBand = 'chase_now' | 'strong' | 'fixable' | 'leave_it'

export const BAND_META: Record<ScoreBand, { label: string; range: string; advice: string }> = {
  chase_now: {
    label: 'Chase now',
    range: '80–100',
    advice: 'Research immediately and give it the best available route. Anchor candidate.',
  },
  strong: { label: 'Strong', range: '60–79', advice: 'Research it. Fix the weakest part before asking.' },
  fixable: {
    label: 'Fixable',
    range: '40–59',
    advice: 'Usually a route problem or a missing ask. Leave on the wishlist until something changes.',
  },
  leave_it: {
    label: 'Leave it',
    range: 'below 40',
    advice: 'Timeliness decays on its own, so it will sink unless a new reason appears.',
  },
}

export function bandFor(total: number): ScoreBand {
  if (total >= 80) return 'chase_now'
  if (total >= 60) return 'strong'
  if (total >= 40) return 'fixable'
  return 'leave_it'
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

// ─── Chance of a yes (25) ────────────────────────────────────────────────────

/**
 * The part that matters most, because a perfect question with an unreachable
 * guest produces no episode at all (concept §7).
 *
 * Route 12 · does this sort of thing 4 · good moment 3 · peer already in 3 ·
 * practicalities 3 · minus institutional friction and any earlier refusal.
 *
 * Note the floor at zero: a heavily penalised card is *unlikely*, not
 * negatively likely, and letting it drag the total below its other parts would
 * make the number stop meaning anything.
 */
export function chanceOfYes(
  candidate: Pick<
    QuestionCandidate,
    'route' | 'recentAppearance' | 'goodMoment' | 'practicalities' | 'priorRefusal'
  >,
  context: { anchorConfirmed?: boolean; peerConfirmed?: boolean; institutionalFriction?: string } = {},
): PartScore {
  const lines: ScoreLine[] = []

  const route: CandidateRoute | null = candidate.route
  const routePoints = route ? ROUTE_META[route].points : 0
  lines.push({
    label: 'Route',
    points: routePoints,
    max: 12,
    note: route ? ROUTE_META[route].meaning : 'No route chosen yet.',
  })

  // The single fact that predicts a yes better than anything else the platform
  // can know (concept §6).
  const appearancePoints =
    candidate.recentAppearance === 'within_12_months' ? 4 : candidate.recentAppearance === 'older' ? 2 : 0
  lines.push({
    label: 'Does this sort of thing',
    points: appearancePoints,
    max: 4,
    note:
      candidate.recentAppearance === 'within_12_months'
        ? 'Appeared on a podcast within twelve months.'
        : candidate.recentAppearance === 'older'
          ? 'Has appeared, but not recently.'
          : 'No podcast appearance found.',
  })

  const moment = clamp(candidate.goodMoment, 0, 3)
  lines.push({
    label: 'Good moment for them',
    points: moment,
    max: 3,
    note: 'They have something to promote or defend right now.',
  })

  // Recalculated automatically every time somebody accepts — "X has already
  // agreed" is the single most useful sentence in an invitation.
  const peer = context.anchorConfirmed ? 3 : context.peerConfirmed ? 2 : 0
  lines.push({
    label: 'Someone they respect is already in',
    points: peer,
    max: 3,
    note: context.anchorConfirmed
      ? 'The anchor has confirmed on this question.'
      : context.peerConfirmed
        ? 'A known peer has confirmed.'
        : 'Nobody has confirmed on this question yet.',
  })

  const practicalities = clamp(candidate.practicalities, 0, 3)
  lines.push({
    label: 'Practicalities',
    points: practicalities,
    max: 3,
    note: 'Language, time zone, remote, and proportionate preparation.',
  })

  const friction = context.institutionalFriction ?? 'none'
  const frictionPenalty =
    friction === 'press_office' ? -3 : friction === 'pharmaceutical' || friction === 'regulator' ? -2 : friction === 'civil_service' ? -1 : 0
  lines.push({
    label: 'Institutional friction',
    points: frictionPenalty,
    max: 0,
    note: frictionPenalty === 0 ? 'No approval overhead.' : 'Approval overhead lengthens or kills bookings.',
  })

  const refusalPenalty =
    candidate.priorRefusal === 'firm_no' ? -4 : candidate.priorRefusal === 'soft_no' ? -2 : candidate.priorRefusal === 'not_now' ? -1 : 0
  lines.push({
    label: 'Said no before',
    points: refusalPenalty,
    max: 0,
    note:
      candidate.priorRefusal === 'not_now'
        ? 'A “not now” is close to neutral.'
        : candidate.priorRefusal === 'none'
          ? 'No previous refusal.'
          : 'A firm no stands until circumstances change.',
  })

  const raw = lines.reduce((sum, l) => sum + l.points, 0)
  return { points: clamp(raw, 0, SCORE_PARTS.chanceOfYes), max: SCORE_PARTS.chanceOfYes, lines }
}

// ─── Reach (20) ──────────────────────────────────────────────────────────────

export function reachScore(
  candidate: Pick<QuestionCandidate, 'guestAudience'>,
  question: Pick<PodcastQuestion, 'questionPull' | 'amplification'>,
  context: { sharesOwnAppearances?: boolean | null } = {},
): PartScore {
  // A guest who will share the episode is worth more than one with twice the
  // followers who will not — so an audience with no sharing is halved.
  const rawAudience = clamp(candidate.guestAudience, 0, 8)
  const audience = context.sharesOwnAppearances === false ? Math.floor(rawAudience / 2) : rawAudience

  const lines: ScoreLine[] = [
    {
      label: 'Guest audience and whether they share',
      points: audience,
      max: 8,
      note:
        context.sharesOwnAppearances === false
          ? 'They do not promote their own appearances — halved.'
          : context.sharesOwnAppearances
            ? 'They promote their own appearances.'
            : 'Sharing behaviour unknown.',
    },
    {
      label: 'Pull of the question',
      points: clamp(question.questionPull, 0, 7),
      max: 7,
      note: 'Judged against how comparable past content performed.',
    },
    {
      label: 'Who else will push it',
      points: clamp(question.amplification, 0, 5),
      max: 5,
      note: 'Hubs, partners and contributors.',
    },
  ]

  return { points: lines.reduce((s, l) => s + l.points, 0), max: SCORE_PARTS.reach, lines }
}

// ─── Timeliness (20), the part that decays ───────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Exponential decay by half-life. Wishlists clean themselves and stale names
 * sink without anyone pruning (concept §10) — which only works if the decay is
 * applied at *read* time rather than by a job, so it is computed here.
 */
export function decayFactor(ageDays: number, halfLifeDays: number): number {
  if (ageDays <= 0) return 1
  if (halfLifeDays <= 0) return 0
  return Math.pow(0.5, ageDays / halfLifeDays)
}

export function timelinessScore(
  question: Pick<PodcastQuestion, 'whyNow' | 'whyNowAt' | 'independentSources' | 'anchorDate'>,
  opts: { now?: Date; config?: PlanningConfig } = {},
): PartScore {
  const config = opts.config ?? DEFAULT_PLANNING_CONFIG
  const now = opts.now ?? new Date()

  // How recent the reason is (8), decayed.
  let recency = 0
  let recencyNote = 'No dated reason — timeliness cannot be established.'
  if (question.whyNowAt) {
    const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(question.whyNowAt).getTime()) / DAY_MS))
    recency = Math.round(8 * decayFactor(ageDays, config.timelinessHalfLifeDays))
    recencyNote = `The reason is ${ageDays} day${ageDays === 1 ? '' : 's'} old.`
  } else if (question.whyNow?.trim()) {
    recency = 2
    recencyNote = 'A reason is written down but not dated.'
  }

  // How many independent sources (6). Three in one week is itself the reason to
  // record now, so three saturates this line.
  const sources = clamp(Math.round((question.independentSources / 3) * 6), 0, 6)

  // A fixed date that anchors it (6) — but only while it is still ahead.
  const anchor =
    question.anchorDate && new Date(question.anchorDate).getTime() >= now.getTime() - DAY_MS ? 6 : 0

  const lines: ScoreLine[] = [
    { label: 'How recent the reason is', points: recency, max: 8, note: recencyNote },
    {
      label: 'Independent sources',
      points: sources,
      max: 6,
      note: `${question.independentSources} independent source${question.independentSources === 1 ? '' : 's'}.`,
    },
    {
      label: 'A fixed date anchors it',
      points: anchor,
      max: 6,
      note: anchor ? 'A congress or deadline is still ahead.' : 'No upcoming fixed date.',
    },
  ]

  return { points: lines.reduce((s, l) => s + l.points, 0), max: SCORE_PARTS.timeliness, lines }
}

// ─── Follow-up (15) ──────────────────────────────────────────────────────────

export function followupScore(
  question: Pick<PodcastQuestion, 'askType' | 'askDestinationUrl' | 'askVerifiedAt' | 'askConversionPrior'>,
): PartScore {
  const lines: ScoreLine[] = [
    {
      label: 'An ask is defined',
      points: question.askType ? 5 : 0,
      max: 5,
      note: question.askType ? ASK_META[question.askType].label : 'No listener action decided yet.',
    },
    {
      // An ask pointing at a broken page wastes the entire episode, so an
      // unverified destination earns nothing rather than the benefit of the doubt.
      label: 'The page it points at works',
      points: question.askVerifiedAt ? 5 : 0,
      max: 5,
      note: question.askVerifiedAt
        ? 'Destination checked.'
        : question.askDestinationUrl
          ? 'Destination not checked yet.'
          : 'No destination.',
    },
    {
      label: 'How that ask has converted before',
      points: clamp(question.askConversionPrior, 0, 5),
      max: 5,
      note: 'Measured against previous episodes.',
    },
  ]

  return { points: lines.reduce((s, l) => s + l.points, 0), max: SCORE_PARTS.followup, lines }
}

// ─── Mission (15) ────────────────────────────────────────────────────────────

export function missionScore(
  question: Pick<PodcastQuestion, 'initiativeId' | 'onAdvocacyAgenda' | 'patientRelevance'>,
): PartScore {
  const lines: ScoreLine[] = [
    {
      label: 'Connected to a live initiative',
      points: question.initiativeId ? 6 : 0,
      max: 6,
      note: question.initiativeId ? 'Linked to an initiative.' : 'Not linked to an initiative.',
    },
    {
      label: 'On the advocacy agenda',
      points: question.onAdvocacyAgenda ? 5 : 0,
      max: 5,
      note: question.onAdvocacyAgenda ? 'On the agenda.' : 'Not on the agenda.',
    },
    {
      label: 'Matters to patients',
      points: question.patientRelevance === 'patients' ? 4 : question.patientRelevance === 'both' ? 3 : 0,
      max: 4,
      note:
        question.patientRelevance === 'field'
          ? 'Matters to the field rather than to patients.'
          : 'Matters to patients, not only to the field.',
    },
  ]

  return { points: lines.reduce((s, l) => s + l.points, 0), max: SCORE_PARTS.mission, lines }
}

// ─── Format (5) ──────────────────────────────────────────────────────────────

/**
 * Worth only five points, but it works as a filter: a question that fits no
 * format is reframed or dropped.
 */
export function formatScore(
  question: Pick<PodcastQuestion, 'format'>,
  context: { producible?: boolean; addsVariety?: boolean } = {},
): PartScore {
  const format: EpisodeFormat | null = question.format
  const lines: ScoreLine[] = [
    {
      label: 'Format assigned',
      points: format ? 2 : 0,
      max: 2,
      note: format ? FORMAT_META[format].label : 'No format chosen — reframe or drop the question.',
    },
    {
      label: 'Realistically producible',
      points: context.producible === false ? 0 : format ? 2 : 0,
      max: 2,
      note: context.producible === false ? 'Not producible as things stand.' : 'Producible.',
    },
    {
      label: 'Adds variety',
      points: context.addsVariety ? 1 : 0,
      max: 1,
      note: context.addsVariety ? 'Different from what is already scheduled.' : 'Similar to recent episodes.',
    },
  ]

  return { points: lines.reduce((s, l) => s + l.points, 0), max: SCORE_PARTS.formatFit, lines }
}

// ─── The total ───────────────────────────────────────────────────────────────

export type ScoreContext = {
  anchorConfirmed?: boolean
  peerConfirmed?: boolean
  institutionalFriction?: string
  sharesOwnAppearances?: boolean | null
  producible?: boolean
  addsVariety?: boolean
  now?: Date
  config?: PlanningConfig
}

/** The whole score for one candidate on one question, with its breakdown. */
export function scoreCandidate(
  candidate: QuestionCandidate,
  question: PodcastQuestion,
  context: ScoreContext = {},
): CandidateScore {
  const breakdown = {
    chanceOfYes: chanceOfYes(candidate, context),
    reach: reachScore(candidate, question, context),
    timeliness: timelinessScore(question, { now: context.now, config: context.config }),
    followup: followupScore(question),
    mission: missionScore(question),
    formatFit: formatScore(question, context),
  } satisfies Record<ScorePart, PartScore>

  const total = (Object.keys(breakdown) as ScorePart[]).reduce((s, k) => s + breakdown[k].points, 0)

  // "Strongest" and "weakest" are proportions of each part's maximum, not raw
  // points — otherwise Chance of a yes would always look strongest simply for
  // being worth 25.
  const ratios = (Object.keys(breakdown) as ScorePart[]).map((part) => ({
    part,
    ratio: breakdown[part].max > 0 ? breakdown[part].points / breakdown[part].max : 0,
  }))
  const sorted = [...ratios].sort((a, b) => b.ratio - a.ratio)

  return {
    weightsVersion: WEIGHTS_VERSION,
    chanceOfYes: breakdown.chanceOfYes.points,
    reach: breakdown.reach.points,
    timeliness: breakdown.timeliness.points,
    followup: breakdown.followup.points,
    mission: breakdown.mission.points,
    formatFit: breakdown.formatFit.points,
    total,
    band: bandFor(total),
    breakdown,
    strongest: sorted[0].part,
    weakest: sorted[sorted.length - 1].part,
  }
}

export const PART_LABELS: Record<ScorePart, string> = {
  chanceOfYes: 'Chance of a yes',
  reach: 'Reach',
  timeliness: 'Timeliness',
  followup: 'Follow-up',
  mission: 'Mission',
  formatFit: 'Format',
}

/** The one-line summary shown under the number on every card. */
export function summariseScore(score: CandidateScore): string {
  return `Strongest: ${PART_LABELS[score.strongest]}. Weakest: ${PART_LABELS[score.weakest]}.`
}

/**
 * Board order.
 *
 * An override wins outright and is *shown* winning — the platform records the
 * decision rather than hiding it, because an override that keeps being right is
 * evidence the model is wrong, not the person (concept §10).
 */
export function rankCandidates(candidates: QuestionCandidate[]): QuestionCandidate[] {
  return [...candidates].sort((a, b) => {
    if (Boolean(a.overrideAt) !== Boolean(b.overrideAt)) return a.overrideAt ? -1 : 1
    if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1
    return (b.scoreTotal ?? -1) - (a.scoreTotal ?? -1)
  })
}
