/**
 * podcast-planning/domain/question-summary.ts — per-question counts.
 *
 * Pure, and deliberately not in the repository: what "in play" means is a
 * product judgement, not a query detail, and it should be testable without a
 * database.
 */

import type { PodcastQuestion, QuestionCandidate } from '@/modules/podcast-planning/domain/types'

export type QuestionSummary = {
  question: PodcastQuestion
  wishlistSize: number
  /** The working middle of the board — the cards costing attention right now. */
  inPlay: number
  episodes: number
  /** True once the anchor is past the point of saying yes. */
  anchorSecured: boolean
}

/** Stages where somebody has already agreed in principle. */
const SECURED: QuestionCandidate['stage'][] = ['planning', 'booked', 'recorded']
const IN_PLAY: QuestionCandidate['stage'][] = ['research', 'ask', 'planning', 'booked']

export function summariseQuestions(
  questions: PodcastQuestion[],
  candidates: QuestionCandidate[],
): QuestionSummary[] {
  return questions.map((question) => {
    const own = candidates.filter((c) => c.questionId === question.id)
    return {
      question,
      wishlistSize: own.filter((c) => c.stage === 'wishlist').length,
      inPlay: own.filter((c) => IN_PLAY.includes(c.stage)).length,
      episodes: own.filter((c) => c.stage === 'recorded').length,
      anchorSecured: own.some((c) => c.isAnchor && SECURED.includes(c.stage)),
    }
  })
}
