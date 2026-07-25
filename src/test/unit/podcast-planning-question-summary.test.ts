/**
 * podcast-planning — per-question counts (concept §4, Questions screen).
 *
 * "In play" is a product judgement rather than a query detail, which is why it
 * is asserted here: a wishlist name costs nothing, a card in Research through
 * Booked is costing attention right now.
 */

import { describe, it, expect } from 'vitest'
import { summariseQuestions } from '@/modules/podcast-planning/domain/question-summary'
import type { PodcastQuestion, QuestionCandidate } from '@/modules/podcast-planning/domain/types'

function question(id: string, partial: Partial<PodcastQuestion> = {}): PodcastQuestion {
  return {
    id,
    question: `Question ${id}`,
    whyNow: null,
    whyNowSourceUrls: [],
    whyNowAt: null,
    anchorDate: null,
    independentSources: 0,
    askType: null,
    askDestinationUrl: null,
    askVerifiedAt: null,
    format: null,
    topicTags: [],
    initiativeId: null,
    onAdvocacyAgenda: false,
    patientRelevance: 'field',
    questionPull: 0,
    askConversionPrior: 0,
    amplification: 0,
    ownerId: null,
    status: 'live',
    updatedAt: '2026-07-25T00:00:00Z',
    ...partial,
  }
}

function candidate(
  id: string,
  questionId: string,
  partial: Partial<QuestionCandidate> = {},
): QuestionCandidate {
  return {
    id,
    questionId,
    personId: `p-${id}`,
    angle: null,
    stage: 'wishlist',
    stageEnteredAt: '2026-07-01T00:00:00Z',
    isAnchor: false,
    route: null,
    recentAppearance: 'none',
    goodMoment: 0,
    practicalities: 0,
    priorRefusal: 'none',
    priorRefusalAt: null,
    guestAudience: 0,
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
    ...partial,
  }
}

describe('summariseQuestions', () => {
  const questions = [question('q1'), question('q2')]
  const candidates = [
    candidate('a', 'q1'),
    candidate('b', 'q1'),
    candidate('c', 'q1', { stage: 'research' }),
    candidate('d', 'q1', { stage: 'ask' }),
    candidate('e', 'q1', { stage: 'planning' }),
    candidate('f', 'q1', { stage: 'booked' }),
    candidate('g', 'q1', { stage: 'recorded' }),
    candidate('h', 'q1', { stage: 'not_now' }),
    candidate('i', 'q1', { stage: 'closed' }),
    candidate('j', 'q2'),
  ]

  it('counts the wishlist, what is in play, and what shipped', () => {
    const [q1] = summariseQuestions(questions, candidates)
    expect(q1.wishlistSize).toBe(2)
    // Research · Ask · Planning · Booked — the working middle of the board.
    expect(q1.inPlay).toBe(4)
    expect(q1.episodes).toBe(1)
  })

  it('does not count sleeping or closed cards as in play', () => {
    const [q1] = summariseQuestions(questions, candidates)
    expect(q1.inPlay).not.toBe(6)
  })

  it('keeps each question to its own candidates', () => {
    const [, q2] = summariseQuestions(questions, candidates)
    expect(q2.wishlistSize).toBe(1)
    expect(q2.inPlay).toBe(0)
    expect(q2.episodes).toBe(0)
  })

  it('reports the anchor as secured only once they are past saying yes', () => {
    const asking = summariseQuestions(
      [question('q3')],
      [candidate('k', 'q3', { isAnchor: true, stage: 'ask' })],
    )
    expect(asking[0].anchorSecured).toBe(false)

    const agreed = summariseQuestions(
      [question('q3')],
      [candidate('k', 'q3', { isAnchor: true, stage: 'planning' })],
    )
    expect(agreed[0].anchorSecured).toBe(true)
  })

  it('returns a row for a question with no candidates at all', () => {
    const [only] = summariseQuestions([question('q4')], [])
    expect(only).toMatchObject({ wishlistSize: 0, inPlay: 0, episodes: 0, anchorSecured: false })
  })
})
