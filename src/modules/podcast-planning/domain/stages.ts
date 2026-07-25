/**
 * podcast-planning/domain/stages.ts — the six stages and what guards them.
 *
 * Concept §3. Pure functions over a candidate and its question, so every gate is
 * testable without a database and identical wherever it is enforced.
 *
 * Two design points worth keeping in view while reading:
 *
 *  - **Waiting is not to-do.** Ask and Planning are stages where the work sits
 *    with somebody else. They are the only stages that count days, and they are
 *    presented differently, because "waiting" and "to do" are different problems.
 *  - **The ceiling is on chasing, not on thinking.** Research is unlimited; Ask
 *    is capped. That asymmetry is the difference between a pipeline that helps
 *    one person and a list that makes them feel behind.
 */

import type {
  CandidateStage,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import { DEFAULT_PLANNING_CONFIG, FORMAT_META } from '@/modules/podcast-planning/domain/types'

export const BOARD_STAGES: CandidateStage[] = [
  'wishlist',
  'research',
  'ask',
  'planning',
  'booked',
  'recorded',
]

export const STAGE_META: Record<
  CandidateStage,
  { label: string; who: 'amit' | 'waiting' | 'exit'; description: string }
> = {
  wishlist: { label: 'Wishlist', who: 'amit', description: 'A name and one line on why. No research yet.' },
  research: { label: 'Research', who: 'amit', description: 'Is this the right person, and how would we reach them.' },
  ask: { label: 'Ask', who: 'waiting', description: 'The request is out, with an introducer or with the guest.' },
  planning: { label: 'Planning', who: 'waiting', description: 'They are in. Date, format and scope being settled.' },
  booked: { label: 'Booked', who: 'amit', description: 'Date fixed. Brief, prep and launch plan.' },
  recorded: { label: 'Recorded', who: 'amit', description: 'Recording done. Hands over to the content calendar.' },
  not_now: { label: 'Not now', who: 'exit', description: 'Interested but unavailable. Sleeps until its wake date.' },
  closed: { label: 'Closed', who: 'exit', description: 'Declined, no reply, no route, or wrong person — with a reason.' },
}

/** True for the two stages where somebody else owes us an answer. */
export function isWaitingStage(stage: CandidateStage): boolean {
  return STAGE_META[stage].who === 'waiting'
}

// ─── The question readiness gate ─────────────────────────────────────────────

export type QuestionReadiness = {
  ready: boolean
  missing: string[]
}

/**
 * A question is not open for work until four things are written down
 * (concept §2). This is the gate that stops the most expensive failure mode in
 * the whole design: researching a shortlist for an episode nobody decided the
 * point of.
 */
export function questionReadiness(question: PodcastQuestion): QuestionReadiness {
  const missing: string[] = []
  if (!question.question?.trim()) missing.push('the question itself')
  if (!question.whyNow?.trim()) missing.push('why now')
  // The listener action is the one the concept singles out: it must exist
  // *before any name is researched*, because it shapes how the episode is framed.
  if (!question.askType) missing.push('the listener action')
  if (!question.askDestinationUrl?.trim()) missing.push('where the ask points')
  if (!question.format) missing.push('the episode format')
  return { ready: missing.length === 0, missing }
}

// ─── Stage transitions ───────────────────────────────────────────────────────

export type TransitionContext = {
  question: PodcastQuestion
  /** Cards currently in Ask across *all* questions — the ceiling is global. */
  openAskCount: number
  config?: PlanningConfig
  /** Seats already secured for this recording (guests confirmed). */
  seatsSecured?: number
}

export type TransitionVerdict = { allowed: true } | { allowed: false; reason: string }

const ORDER: CandidateStage[] = ['wishlist', 'research', 'ask', 'planning', 'booked', 'recorded']

/**
 * May this card move to `target`?
 *
 * Going *backwards* is always allowed and is a normal, healthy move: a card
 * whose angle turns out to be thin goes back to the wishlist, and a route that
 * went silent goes back to Research. Only forward moves are gated.
 */
export function canAdvance(
  candidate: QuestionCandidate,
  target: CandidateStage,
  context: TransitionContext,
): TransitionVerdict {
  const config = context.config ?? DEFAULT_PLANNING_CONFIG

  if (target === candidate.stage) return { allowed: true }

  // The two exits are always reachable — a "not now" or a decline can arrive at
  // any point, and refusing to record one would only lose the information.
  if (target === 'closed') return { allowed: true }
  if (target === 'not_now') return { allowed: true }

  const fromIndex = ORDER.indexOf(candidate.stage)
  const toIndex = ORDER.indexOf(target)

  // Waking a sleeping card, or reopening a closed one, returns it to Research —
  // never further forward, because its research is stale by definition.
  if (candidate.stage === 'not_now' || candidate.stage === 'closed') {
    return target === 'research' || target === 'wishlist'
      ? { allowed: true }
      : { allowed: false, reason: 'A sleeping or closed card returns to Research first.' }
  }

  if (toIndex < fromIndex) return { allowed: true }
  if (toIndex > fromIndex + 1) {
    return { allowed: false, reason: `Move it to ${STAGE_META[ORDER[fromIndex + 1]].label} first.` }
  }

  switch (target) {
    case 'research': {
      // "Amit picks it up. Nothing else." — but the question has to be worth
      // researching *for*, which is where the listener action gate bites.
      const readiness = questionReadiness(context.question)
      if (!readiness.ready) {
        return {
          allowed: false,
          reason: `Finish the question first — still missing: ${readiness.missing.join(', ')}.`,
        }
      }
      return { allowed: true }
    }

    case 'ask': {
      // The real quality gate (concept §3).
      if (!candidate.angle?.trim()) {
        return { allowed: false, reason: 'Write the angle: what can only this person say?' }
      }
      if (!candidate.route) {
        return { allowed: false, reason: 'Choose a route before asking.' }
      }
      if (candidate.scoreTotal === null) {
        return { allowed: false, reason: 'Score the card before asking.' }
      }
      if (context.openAskCount >= config.openAskLimit) {
        return {
          allowed: false,
          reason: `${config.openAskLimit} open asks is the working ceiling — every one needs following up. Close or reroute one first.`,
        }
      }
      return { allowed: true }
    }

    case 'planning':
      // Only the guest can move this one, and only by saying yes.
      return { allowed: true }

    case 'booked': {
      if (!candidate.recordingDate) {
        return { allowed: false, reason: 'Settle a date first — this is where bookings quietly die.' }
      }
      if (!candidate.consentConfirmed) {
        return { allowed: false, reason: 'Confirm they are content to be recorded and published.' }
      }
      const seats = FORMAT_META[context.question.format ?? 'advocate_meets_expert'].guestSeats
      if (seats > 1 && !candidate.seatsFilled) {
        return {
          allowed: false,
          reason: `${FORMAT_META[context.question.format!].label} needs ${seats} guests — the card does not move until every seat is filled.`,
        }
      }
      return { allowed: true }
    }

    case 'recorded':
      return { allowed: true }

    default:
      return { allowed: true }
  }
}

// ─── Waiting days (derived, never stored) ────────────────────────────────────

export type WaitingState = {
  /** Days in the current stage. Null when the stage does not count days. */
  days: number | null
  /** One nudge after the configured wait. */
  nudgeDue: boolean
  /** Silence past the configured wait is treated as a no. */
  treatAsNo: boolean
  /** A Planning card that has been sitting long enough to need a push. */
  stalled: boolean
  label: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How long this card has been waiting, and what that means.
 *
 * Derived rather than stored, so the counters can never drift from the clock and
 * a config change takes effect immediately.
 */
export function waitingState(
  candidate: QuestionCandidate,
  opts: { now?: Date; config?: PlanningConfig } = {},
): WaitingState {
  const config = opts.config ?? DEFAULT_PLANNING_CONFIG
  const now = opts.now ?? new Date()

  if (!isWaitingStage(candidate.stage)) {
    return { days: null, nudgeDue: false, treatAsNo: false, stalled: false, label: null }
  }

  const days = Math.floor((now.getTime() - new Date(candidate.stageEnteredAt).getTime()) / DAY_MS)

  if (candidate.stage === 'ask') {
    return {
      days,
      nudgeDue: days >= config.nudgeAfterDays && days < config.silenceIsNoAfterDays,
      treatAsNo: days >= config.silenceIsNoAfterDays,
      stalled: false,
      label: `Waiting ${days} day${days === 1 ? '' : 's'}`,
    }
  }

  return {
    days,
    nudgeDue: false,
    treatAsNo: false,
    stalled: days >= config.planningStallDays,
    label: `Waiting ${days} day${days === 1 ? '' : 's'}`,
  }
}

/** Cards that count against the open-ask ceiling. */
export function countOpenAsks(candidates: QuestionCandidate[]): number {
  return candidates.filter((c) => c.stage === 'ask').length
}

/**
 * Sleeping cards whose wake date has arrived. They return to Research — the most
 * common *good* outcome of a first ask, and never displayed as a loss.
 */
export function dueToWake(candidates: QuestionCandidate[], now: Date = new Date()): QuestionCandidate[] {
  const today = now.toISOString().slice(0, 10)
  return candidates.filter((c) => c.stage === 'not_now' && c.wakeDate !== null && c.wakeDate <= today)
}

/** What the fortnightly session should look at first, in order (concept §14). */
export function boardAgenda(
  candidates: QuestionCandidate[],
  opts: { now?: Date; config?: PlanningConfig } = {},
): Array<{ candidate: QuestionCandidate; reason: string }> {
  const agenda: Array<{ candidate: QuestionCandidate; reason: string }> = []

  for (const candidate of candidates) {
    const waiting = waitingState(candidate, opts)
    if (waiting.treatAsNo) {
      agenda.push({ candidate, reason: 'Silent past the cut-off — try another route or another person.' })
    } else if (waiting.nudgeDue) {
      agenda.push({ candidate, reason: 'Due one nudge.' })
    } else if (waiting.stalled) {
      agenda.push({ candidate, reason: 'Stuck in Planning — a date has drifted.' })
    }
  }

  for (const candidate of dueToWake(candidates, opts.now)) {
    agenda.push({ candidate, reason: 'Sleeping card is due to wake.' })
  }

  return agenda
}
