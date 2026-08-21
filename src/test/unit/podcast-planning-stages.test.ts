/**
 * podcast-planning — the six stages and their gates (concept §3).
 *
 * The two gates that carry the most product weight are asserted hardest: a
 * question with no listener action cannot have its names researched, and a
 * seventh open ask is refused outright.
 */

import { describe, it, expect } from 'vitest'
import {
  BOARD_STAGES,
  boardAgenda,
  canAdvance,
  canDeleteQuestion,
  countOpenAsks,
  dueToWake,
  isWaitingStage,
  questionReadiness,
  STAGE_META,
  waitingState,
} from '@/modules/podcast-planning/domain/stages'
import { DEFAULT_PLANNING_CONFIG } from '@/modules/podcast-planning/domain/types'
import type { PodcastQuestion, QuestionCandidate } from '@/modules/podcast-planning/domain/types'

const NOW = new Date('2026-07-25T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function question(partial: Partial<PodcastQuestion> = {}): PodcastQuestion {
  return {
    id: 'q1',
    question: 'Why is a proven diagnostic still unreimbursed?',
    whyNow: 'A parliamentary hearing last week.',
    whyNowSourceUrls: [],
    whyNowAt: daysAgo(7).slice(0, 10),
    anchorDate: null,
    independentSources: 3,
    askType: 'join_initiative',
    askDestinationUrl: 'https://example.org/initiative',
    askVerifiedAt: NOW.toISOString(),
    format: 'how_it_works',
    topicTags: [],
    initiativeId: null,
    onAdvocacyAgenda: true,
    patientRelevance: 'patients',
    questionPull: 4,
    askConversionPrior: 3,
    amplification: 2,
    ownerId: null,
    status: 'live',
    updatedAt: NOW.toISOString(),
    ...partial,
  }
}

function candidate(partial: Partial<QuestionCandidate> = {}): QuestionCandidate {
  return {
    id: 'c1',
    questionId: 'q1',
    personId: 'p1',
    angle: 'The only person who sat on both sides of the appraisal.',
    stage: 'wishlist',
    stageEnteredAt: NOW.toISOString(),
    isAnchor: false,
    route: 'one_introduction',
    recentAppearance: 'older',
    goodMoment: 2,
    practicalities: 2,
    priorRefusal: 'none',
    priorRefusalAt: null,
    guestAudience: 4,
    chanceOfYes: 18,
    scoreTotal: 62,
    scoredAt: NOW.toISOString(),
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

const context = (partial: Partial<Parameters<typeof canAdvance>[2]> = {}) => ({
  question: question(),
  openAskCount: 0,
  ...partial,
})

describe('the stage vocabulary', () => {
  it('has six board stages plus two exits', () => {
    expect(BOARD_STAGES).toEqual(['wishlist', 'research', 'ask', 'planning', 'booked', 'recorded'])
    expect(STAGE_META.not_now.who).toBe('exit')
    expect(STAGE_META.closed.who).toBe('exit')
  })

  it('marks exactly Ask and Planning as waiting — waiting is not to-do', () => {
    expect(BOARD_STAGES.filter(isWaitingStage)).toEqual(['ask', 'planning'])
  })
})

describe('questionReadiness', () => {
  it('accepts a fully defined question', () => {
    expect(questionReadiness(question()).ready).toBe(true)
  })

  it('names every missing piece', () => {
    const readiness = questionReadiness(
      question({ whyNow: null, askType: null, askDestinationUrl: null, format: null }),
    )
    expect(readiness.ready).toBe(false)
    expect(readiness.missing).toEqual([
      'why now',
      'the listener action',
      'where the ask points',
      'the episode format',
    ])
  })
})

describe('wishlist → research', () => {
  it('needs nothing from the candidate — Amit just picks it up', () => {
    const bare = candidate({ angle: null, route: null, scoreTotal: null })
    expect(canAdvance(bare, 'research', context()).allowed).toBe(true)
  })

  it('is blocked while the question has no listener action', () => {
    // The concept's own gate: the listener action is decided before any name is
    // researched, because it shapes how the episode is framed.
    const verdict = canAdvance(candidate(), 'research', context({ question: question({ askType: null }) }))
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('the listener action')
  })
})

describe('research → ask (the real quality gate)', () => {
  const inResearch = (partial: Partial<QuestionCandidate> = {}) =>
    candidate({ stage: 'research', ...partial })

  it('passes with an angle, a route and a score', () => {
    expect(canAdvance(inResearch(), 'ask', context()).allowed).toBe(true)
  })

  it('refuses without an angle', () => {
    const verdict = canAdvance(inResearch({ angle: '  ' }), 'ask', context())
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('angle')
  })

  it('refuses without a route', () => {
    expect(canAdvance(inResearch({ route: null }), 'ask', context()).allowed).toBe(false)
  })

  it('refuses without a score', () => {
    expect(canAdvance(inResearch({ scoreTotal: null }), 'ask', context()).allowed).toBe(false)
  })

  it('refuses a seventh open ask, across all questions', () => {
    const verdict = canAdvance(inResearch(), 'ask', context({ openAskCount: 6 }))
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('6 open asks')
    expect(canAdvance(inResearch(), 'ask', context({ openAskCount: 5 })).allowed).toBe(true)
  })

  it('honours a retuned ceiling — the limit is a setting', () => {
    const verdict = canAdvance(
      inResearch(),
      'ask',
      context({ openAskCount: 6, config: { ...DEFAULT_PLANNING_CONFIG, openAskLimit: 10 } }),
    )
    expect(verdict.allowed).toBe(true)
  })
})

describe('planning → booked', () => {
  const inPlanning = (partial: Partial<QuestionCandidate> = {}) =>
    candidate({ stage: 'planning', ...partial })

  it('needs a date', () => {
    const verdict = canAdvance(inPlanning({ consentConfirmed: true }), 'booked', context())
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('date')
  })

  it('needs consent to record and publish', () => {
    const verdict = canAdvance(inPlanning({ recordingDate: '2026-09-01' }), 'booked', context())
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('recorded and published')
  })

  it('needs every seat filled for a two-voice format', () => {
    const twoVoice = context({ question: question({ format: 'the_disagreement' }) })
    const card = inPlanning({ recordingDate: '2026-09-01', consentConfirmed: true })
    expect(canAdvance(card, 'booked', twoVoice).allowed).toBe(false)
    expect(canAdvance({ ...card, seatsFilled: true }, 'booked', twoVoice).allowed).toBe(true)
  })

  it('does not demand a second seat for a one-voice format', () => {
    const card = inPlanning({ recordingDate: '2026-09-01', consentConfirmed: true })
    expect(canAdvance(card, 'booked', context()).allowed).toBe(true)
  })
})

describe('the two exits and going backwards', () => {
  it('lets a card close or sleep from anywhere', () => {
    for (const stage of BOARD_STAGES) {
      expect(canAdvance(candidate({ stage }), 'closed', context()).allowed).toBe(true)
      expect(canAdvance(candidate({ stage }), 'not_now', context()).allowed).toBe(true)
    }
  })

  it('lets a card move backwards freely — a thin angle goes back to the wishlist', () => {
    expect(canAdvance(candidate({ stage: 'ask' }), 'research', context()).allowed).toBe(true)
    expect(canAdvance(candidate({ stage: 'planning' }), 'wishlist', context()).allowed).toBe(true)
  })

  it('returns a woken card to Research, never further forward', () => {
    const sleeping = candidate({ stage: 'not_now', wakeDate: '2026-07-01' })
    expect(canAdvance(sleeping, 'research', context()).allowed).toBe(true)
    expect(canAdvance(sleeping, 'ask', context()).allowed).toBe(false)
  })

  it('refuses to skip a stage', () => {
    const verdict = canAdvance(candidate({ stage: 'wishlist' }), 'ask', context())
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('Research')
  })
})

describe('waitingState', () => {
  it('counts no days outside the waiting stages', () => {
    expect(waitingState(candidate({ stage: 'research' }), { now: NOW }).days).toBeNull()
  })

  it('flags one nudge after seven days in Ask', () => {
    const state = waitingState(candidate({ stage: 'ask', stageEnteredAt: daysAgo(8) }), { now: NOW })
    expect(state.days).toBe(8)
    expect(state.nudgeDue).toBe(true)
    expect(state.treatAsNo).toBe(false)
    expect(state.label).toBe('Waiting 8 days')
  })

  it('treats silence past fourteen days as a no', () => {
    const state = waitingState(candidate({ stage: 'ask', stageEnteredAt: daysAgo(15) }), { now: NOW })
    expect(state.treatAsNo).toBe(true)
    // Past the cut-off the card needs rerouting, not another nudge.
    expect(state.nudgeDue).toBe(false)
  })

  it('flags a Planning card stuck for three weeks', () => {
    const state = waitingState(candidate({ stage: 'planning', stageEnteredAt: daysAgo(21) }), { now: NOW })
    expect(state.stalled).toBe(true)
    expect(waitingState(candidate({ stage: 'planning', stageEnteredAt: daysAgo(20) }), { now: NOW }).stalled).toBe(false)
  })

  it('honours retuned day counts', () => {
    const state = waitingState(candidate({ stage: 'ask', stageEnteredAt: daysAgo(3) }), {
      now: NOW,
      config: { ...DEFAULT_PLANNING_CONFIG, nudgeAfterDays: 2, silenceIsNoAfterDays: 5 },
    })
    expect(state.nudgeDue).toBe(true)
  })
})

describe('countOpenAsks and dueToWake', () => {
  it('counts only cards in Ask', () => {
    expect(
      countOpenAsks([
        candidate({ stage: 'ask' }),
        candidate({ stage: 'ask' }),
        candidate({ stage: 'planning' }),
        candidate({ stage: 'research' }),
      ]),
    ).toBe(2)
  })

  it('wakes a sleeping card on its date, and not before', () => {
    const due = candidate({ id: 'due', stage: 'not_now', wakeDate: '2026-07-25' })
    const later = candidate({ id: 'later', stage: 'not_now', wakeDate: '2026-08-30' })
    const noDate = candidate({ id: 'nodate', stage: 'not_now', wakeDate: null })
    expect(dueToWake([due, later, noDate], NOW).map((c) => c.id)).toEqual(['due'])
  })
})

describe('boardAgenda', () => {
  it('reads left to right and surfaces exactly what needs attention', () => {
    const agenda = boardAgenda(
      [
        candidate({ id: 'nudge', stage: 'ask', stageEnteredAt: daysAgo(8) }),
        candidate({ id: 'silent', stage: 'ask', stageEnteredAt: daysAgo(20) }),
        candidate({ id: 'stuck', stage: 'planning', stageEnteredAt: daysAgo(30) }),
        candidate({ id: 'wake', stage: 'not_now', wakeDate: '2026-07-01' }),
        candidate({ id: 'quiet', stage: 'research' }),
      ],
      { now: NOW },
    )
    expect(agenda.map((a) => a.candidate.id)).toEqual(['nudge', 'silent', 'stuck', 'wake'])
  })

  it('is empty when nothing needs attention — it must not manufacture work', () => {
    expect(boardAgenda([candidate({ stage: 'research' })], { now: NOW })).toEqual([])
  })
})

describe('canDeleteQuestion', () => {
  it('allows a question nobody has worked on', () => {
    expect(canDeleteQuestion({ cards: 0, invitations: 0 })).toEqual({ allowed: true })
  })

  it('asks first when cards would go with it, and says how many', () => {
    const verdict = canDeleteQuestion({ cards: 3, invitations: 0 })
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) return
    expect(verdict.confirmable).toBe(true)
    expect(verdict.reason).toContain('3 cards')
  })

  it('goes ahead once that has been confirmed', () => {
    expect(canDeleteQuestion({ cards: 3, invitations: 0 }, { confirmed: true })).toEqual({
      allowed: true,
    })
  })

  it('refuses outright once anybody has been invited, however small the question', () => {
    // The hard case: one card, one invitation. Cascading the delete would erase
    // the fact that this person was already approached, which is exactly what
    // stops them being approached twice.
    const verdict = canDeleteQuestion({ cards: 1, invitations: 1 }, { confirmed: true })
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) return
    expect(verdict.confirmable).toBe(false)
    expect(verdict.reason).toContain('Retire it instead')
  })

  it('cannot be talked round by confirming harder', () => {
    expect(canDeleteQuestion({ cards: 9, invitations: 4 }, { confirmed: true }).allowed).toBe(false)
  })
})
