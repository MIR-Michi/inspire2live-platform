/**
 * podcast-planning — the score (concept §7 and §10).
 *
 * The properties under test are the ones the concept commits to publicly: the
 * six parts add to 100, the breakdown is always available, timeliness decays on
 * its own, and nothing here is a judgement call the code makes silently.
 */

import { describe, it, expect } from 'vitest'
import {
  BAND_META,
  SCORE_PARTS,
  WEIGHTS_VERSION,
  bandFor,
  chanceOfYes,
  decayFactor,
  followupScore,
  formatScore,
  missionScore,
  rankCandidates,
  reachScore,
  scoreCandidate,
  summariseScore,
  timelinessScore,
} from '@/modules/podcast-planning/domain/scoring'
import { DEFAULT_PLANNING_CONFIG } from '@/modules/podcast-planning/domain/types'
import type { PodcastQuestion, QuestionCandidate } from '@/modules/podcast-planning/domain/types'

const NOW = new Date('2026-07-25T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function question(partial: Partial<PodcastQuestion> = {}): PodcastQuestion {
  return {
    id: 'q1',
    question: 'Why is a proven diagnostic still unreimbursed three years on?',
    whyNow: 'A parliamentary hearing last week.',
    whyNowSourceUrls: [],
    whyNowAt: daysAgo(7),
    anchorDate: null,
    independentSources: 3,
    askType: 'join_initiative',
    askDestinationUrl: 'https://example.org/initiative',
    askVerifiedAt: NOW.toISOString(),
    format: 'how_it_works',
    topicTags: [],
    initiativeId: 'init-1',
    onAdvocacyAgenda: true,
    patientRelevance: 'patients',
    questionPull: 7,
    askConversionPrior: 5,
    amplification: 5,
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
    stage: 'research',
    stageEnteredAt: NOW.toISOString(),
    isAnchor: false,
    route: 'already_known',
    recentAppearance: 'within_12_months',
    goodMoment: 3,
    practicalities: 3,
    priorRefusal: 'none',
    priorRefusalAt: null,
    guestAudience: 8,
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

describe('the six parts', () => {
  it('add up to exactly 100', () => {
    const total = Object.values(SCORE_PARTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
    expect(SCORE_PARTS).toEqual({
      chanceOfYes: 25,
      reach: 20,
      timeliness: 20,
      followup: 15,
      mission: 15,
      formatFit: 5,
    })
  })

  it('a perfect card scores 100 and lands in Chase now', () => {
    const score = scoreCandidate(
      candidate(),
      question({ anchorDate: daysAgo(-30), whyNowAt: NOW.toISOString().slice(0, 10) }),
      { anchorConfirmed: true, sharesOwnAppearances: true, addsVariety: true, now: NOW },
    )
    expect(score.total).toBe(100)
    expect(score.band).toBe('chase_now')
    expect(score.weightsVersion).toBe(WEIGHTS_VERSION)
  })

  it('never exceeds any part maximum', () => {
    const score = scoreCandidate(
      candidate({ goodMoment: 99, practicalities: 99, guestAudience: 99 }),
      question({ questionPull: 99, amplification: 99, askConversionPrior: 99, independentSources: 99 }),
      { anchorConfirmed: true, now: NOW },
    )
    for (const [part, max] of Object.entries(SCORE_PARTS)) {
      expect(score.breakdown[part as keyof typeof SCORE_PARTS].points).toBeLessThanOrEqual(max)
    }
    expect(score.total).toBeLessThanOrEqual(100)
  })
})

describe('chance of a yes (25)', () => {
  it('scores the route exactly as published (concept §7)', () => {
    const points = (route: QuestionCandidate['route']) =>
      chanceOfYes({ route, recentAppearance: 'none', goodMoment: 0, practicalities: 0, priorRefusal: 'none' })
        .lines[0].points
    expect(points('already_known')).toBe(12)
    expect(points('one_introduction')).toBe(10)
    expect(points('two_steps')).toBe(7)
    expect(points('cold_hook')).toBe(4)
    expect(points('press_office')).toBe(1)
    expect(points(null)).toBe(0)
  })

  it('weights a recent podcast appearance most heavily of the small factors', () => {
    const base = { route: null, goodMoment: 0, practicalities: 0, priorRefusal: 'none' } as const
    expect(chanceOfYes({ ...base, recentAppearance: 'within_12_months' }).points).toBe(4)
    expect(chanceOfYes({ ...base, recentAppearance: 'older' }).points).toBe(2)
    expect(chanceOfYes({ ...base, recentAppearance: 'none' }).points).toBe(0)
  })

  it('gives three points once the anchor has confirmed', () => {
    const base = {
      route: null,
      recentAppearance: 'none',
      goodMoment: 0,
      practicalities: 0,
      priorRefusal: 'none',
    } as const
    expect(chanceOfYes(base, { anchorConfirmed: true }).points).toBe(3)
    expect(chanceOfYes(base, { peerConfirmed: true }).points).toBe(2)
    expect(chanceOfYes(base).points).toBe(0)
  })

  it('treats a "not now" as close to neutral and a firm no as heavy', () => {
    const base = {
      route: 'already_known',
      recentAppearance: 'none',
      goodMoment: 0,
      practicalities: 0,
    } as const
    expect(chanceOfYes({ ...base, priorRefusal: 'not_now' }).points).toBe(11)
    expect(chanceOfYes({ ...base, priorRefusal: 'soft_no' }).points).toBe(10)
    expect(chanceOfYes({ ...base, priorRefusal: 'firm_no' }).points).toBe(8)
  })

  it('penalises institutional friction', () => {
    const base = {
      route: 'already_known',
      recentAppearance: 'none',
      goodMoment: 0,
      practicalities: 0,
      priorRefusal: 'none',
    } as const
    expect(chanceOfYes(base, { institutionalFriction: 'press_office' }).points).toBe(9)
    expect(chanceOfYes(base, { institutionalFriction: 'pharmaceutical' }).points).toBe(10)
    expect(chanceOfYes(base, { institutionalFriction: 'none' }).points).toBe(12)
  })

  it('never goes below zero — unlikely is not negatively likely', () => {
    const score = chanceOfYes(
      { route: 'press_office', recentAppearance: 'none', goodMoment: 0, practicalities: 0, priorRefusal: 'firm_no' },
      { institutionalFriction: 'press_office' },
    )
    expect(score.points).toBe(0)
  })

  it('always returns its breakdown, never just a number', () => {
    const score = chanceOfYes({
      route: 'two_steps',
      recentAppearance: 'older',
      goodMoment: 1,
      practicalities: 2,
      priorRefusal: 'none',
    })
    expect(score.lines).toHaveLength(7)
    expect(score.lines.every((l) => l.note.length > 0)).toBe(true)
  })
})

describe('reach (20)', () => {
  it('halves the audience of a guest who will not share it', () => {
    const willShare = reachScore({ guestAudience: 8 }, { questionPull: 0, amplification: 0 }, { sharesOwnAppearances: true })
    const willNot = reachScore({ guestAudience: 8 }, { questionPull: 0, amplification: 0 }, { sharesOwnAppearances: false })
    expect(willShare.points).toBe(8)
    expect(willNot.points).toBe(4)
  })
})

describe('timeliness (20) and its decay', () => {
  it('halves the recency line over one half-life', () => {
    expect(decayFactor(0, 60)).toBe(1)
    expect(decayFactor(60, 60)).toBeCloseTo(0.5, 6)
    expect(decayFactor(120, 60)).toBeCloseTo(0.25, 6)
  })

  it('sinks a stale question without anyone pruning it', () => {
    const fresh = timelinessScore(question({ whyNowAt: NOW.toISOString().slice(0, 10) }), { now: NOW })
    const stale = timelinessScore(question({ whyNowAt: daysAgo(240) }), { now: NOW })
    expect(fresh.lines[0].points).toBe(8)
    expect(stale.lines[0].points).toBeLessThanOrEqual(1)
    expect(stale.points).toBeLessThan(fresh.points)
  })

  it('gives an undated reason only token credit', () => {
    const undated = timelinessScore(question({ whyNowAt: null, whyNow: 'Something happened.' }), { now: NOW })
    expect(undated.lines[0].points).toBe(2)
  })

  it('saturates the sources line at three independent sources', () => {
    expect(timelinessScore(question({ independentSources: 3 }), { now: NOW }).lines[1].points).toBe(6)
    expect(timelinessScore(question({ independentSources: 9 }), { now: NOW }).lines[1].points).toBe(6)
    expect(timelinessScore(question({ independentSources: 0 }), { now: NOW }).lines[1].points).toBe(0)
  })

  it('only counts an anchor date that is still ahead', () => {
    expect(timelinessScore(question({ anchorDate: daysAgo(-30) }), { now: NOW }).lines[2].points).toBe(6)
    expect(timelinessScore(question({ anchorDate: daysAgo(30) }), { now: NOW }).lines[2].points).toBe(0)
  })

  it('respects a retuned half-life — decay is a setting, not a constant', () => {
    const fast = timelinessScore(question({ whyNowAt: daysAgo(30) }), {
      now: NOW,
      config: { ...DEFAULT_PLANNING_CONFIG, timelinessHalfLifeDays: 10 },
    })
    const slow = timelinessScore(question({ whyNowAt: daysAgo(30) }), {
      now: NOW,
      config: { ...DEFAULT_PLANNING_CONFIG, timelinessHalfLifeDays: 365 },
    })
    expect(fast.lines[0].points).toBeLessThan(slow.lines[0].points)
  })
})

describe('follow-up (15)', () => {
  it('gives nothing for an unverified destination — a broken page wastes the episode', () => {
    const unverified = followupScore(
      question({ askVerifiedAt: null, askDestinationUrl: 'https://example.org/x' }),
    )
    expect(unverified.lines[1].points).toBe(0)
    expect(followupScore(question()).lines[1].points).toBe(5)
  })

  it('gives nothing at all when no listener action is decided', () => {
    const none = followupScore(
      question({ askType: null, askDestinationUrl: null, askVerifiedAt: null, askConversionPrior: 0 }),
    )
    expect(none.points).toBe(0)
  })
})

describe('mission (15) and format (5)', () => {
  it('rewards a question that matters to patients rather than only to the field', () => {
    expect(missionScore(question({ patientRelevance: 'patients' })).lines[2].points).toBe(4)
    expect(missionScore(question({ patientRelevance: 'both' })).lines[2].points).toBe(3)
    expect(missionScore(question({ patientRelevance: 'field' })).lines[2].points).toBe(0)
  })

  it('gives a question with no format nothing — reframe or drop it', () => {
    expect(formatScore(question({ format: null }), { addsVariety: true }).points).toBe(1)
    expect(formatScore(question(), { addsVariety: true }).points).toBe(5)
  })
})

describe('bands', () => {
  it('map totals onto the four published bands', () => {
    expect(bandFor(100)).toBe('chase_now')
    expect(bandFor(80)).toBe('chase_now')
    expect(bandFor(79)).toBe('strong')
    expect(bandFor(60)).toBe('strong')
    expect(bandFor(59)).toBe('fixable')
    expect(bandFor(40)).toBe('fixable')
    expect(bandFor(39)).toBe('leave_it')
    expect(bandFor(0)).toBe('leave_it')
    expect(BAND_META.chase_now.range).toBe('80–100')
  })
})

describe('strongest and weakest', () => {
  it('compares proportions, so the 25-point part is not always "strongest"', () => {
    // Chance of a yes at 12/25 (48 %) against a full Format at 5/5 (100 %).
    const score = scoreCandidate(
      candidate({
        route: 'already_known',
        recentAppearance: 'none',
        goodMoment: 0,
        practicalities: 0,
        guestAudience: 0,
      }),
      question({ questionPull: 0, amplification: 0 }),
      { addsVariety: true, now: NOW },
    )
    expect(score.strongest).not.toBe('chanceOfYes')
    expect(summariseScore(score)).toContain('Strongest:')
  })
})

describe('rankCandidates', () => {
  it('puts an override first, then the anchor, then the score', () => {
    const ranked = rankCandidates([
      candidate({ id: 'low', scoreTotal: 30 }),
      candidate({ id: 'high', scoreTotal: 90 }),
      candidate({ id: 'anchor', scoreTotal: 40, isAnchor: true }),
      candidate({ id: 'override', scoreTotal: 10, overrideAt: NOW.toISOString(), overrideReason: 'Peter asked.' }),
    ])
    expect(ranked.map((c) => c.id)).toEqual(['override', 'anchor', 'high', 'low'])
  })

  it('sorts an unscored card below every scored one', () => {
    const ranked = rankCandidates([candidate({ id: 'unscored' }), candidate({ id: 'scored', scoreTotal: 0 })])
    expect(ranked.map((c) => c.id)).toEqual(['scored', 'unscored'])
  })
})
