/**
 * network — not wearing people out (concept §8).
 *
 * The rules being asserted are social, not technical: a decline costs the
 * introducer exactly as much as an acceptance (they were still asked), the
 * cooldown is a real refusal rather than a warning, and "doors opened" is
 * recognition that never feeds a ranking.
 */

import { describe, it, expect } from 'vitest'
import {
  canRequestIntroduction,
  daysBetween,
  summariseIntroducerLoad,
} from '@/modules/network/domain/fatigue'
import { DEFAULT_NETWORK_CONFIG } from '@/modules/network/domain/types'
import type { IntroductionRequest } from '@/modules/network/domain/types'

const NOW = new Date('2026-07-25T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function request(partial: Partial<IntroductionRequest> = {}): IntroductionRequest {
  return {
    id: 'r1',
    contextType: 'podcast_candidate',
    contextId: null,
    contextSummary: null,
    introducerProfileId: 'ada',
    personId: 'target',
    connectionId: null,
    requestedAt: daysAgo(30),
    response: null,
    respondedAt: null,
    introSentAt: null,
    outcome: null,
    notes: null,
    ...partial,
  }
}

describe('canRequestIntroduction', () => {
  it('allows the first ask', () => {
    const verdict = canRequestIntroduction([], { now: NOW })
    expect(verdict.allowed).toBe(true)
  })

  it('refuses a second ask inside the cooldown window', () => {
    const verdict = canRequestIntroduction([request({ requestedAt: daysAgo(3) })], { now: NOW })
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) {
      expect(verdict.reason).toBe('cooldown')
      expect(verdict.daysUntilAvailable).toBe(DEFAULT_NETWORK_CONFIG.introducerCooldownDays - 3)
    }
  })

  it('allows again once the window has passed', () => {
    const verdict = canRequestIntroduction([request({ requestedAt: daysAgo(14) })], { now: NOW })
    expect(verdict.allowed).toBe(true)
  })

  it('counts a declined request exactly like an accepted one', () => {
    // The cost to the introducer was the asking, not the answer — which is what
    // makes "decline freely, no consequence" true rather than merely polite.
    const declined = canRequestIntroduction(
      [request({ requestedAt: daysAgo(2), response: 'declined' })],
      { now: NOW },
    )
    const accepted = canRequestIntroduction(
      [request({ requestedAt: daysAgo(2), response: 'yes' })],
      { now: NOW },
    )
    expect(declined.allowed).toBe(false)
    expect(accepted.allowed).toBe(false)
  })

  it('measures from the most recent ask, not the first', () => {
    const verdict = canRequestIntroduction(
      [request({ id: 'old', requestedAt: daysAgo(90) }), request({ id: 'new', requestedAt: daysAgo(1) })],
      { now: NOW },
    )
    expect(verdict.allowed).toBe(false)
  })

  it('respects a retuned cooldown — the window is a setting', () => {
    const verdict = canRequestIntroduction([request({ requestedAt: daysAgo(3) })], {
      now: NOW,
      config: { ...DEFAULT_NETWORK_CONFIG, introducerCooldownDays: 2 },
    })
    expect(verdict.allowed).toBe(true)
  })
})

describe('summariseIntroducerLoad', () => {
  it('reports availability, recency and doors opened per introducer', () => {
    const load = summariseIntroducerLoad(
      [
        request({ id: '1', introducerProfileId: 'ada', requestedAt: daysAgo(2), introSentAt: daysAgo(1) }),
        request({ id: '2', introducerProfileId: 'ada', requestedAt: daysAgo(40) }),
        request({ id: '3', introducerProfileId: 'grace', requestedAt: daysAgo(40), introSentAt: daysAgo(39) }),
      ],
      { now: NOW },
    )

    const ada = load.find((l) => l.profileId === 'ada')!
    expect(ada.total).toBe(2)
    expect(ada.recent).toBe(1)
    expect(ada.doorsOpened).toBe(1)
    expect(ada.available).toBe(false)
    expect(ada.daysUntilAvailable).toBe(12)

    const grace = load.find((l) => l.profileId === 'grace')!
    expect(grace.available).toBe(true)
    expect(grace.daysUntilAvailable).toBe(0)
  })

  it('does not rank people by favours asked', () => {
    // Ordering is stable and alphabetical, never by doorsOpened — a leaderboard
    // would corrode exactly the culture that makes the network work.
    const load = summariseIntroducerLoad(
      [
        request({ id: '1', introducerProfileId: 'zoe', introSentAt: daysAgo(1) }),
        request({ id: '2', introducerProfileId: 'ada' }),
      ],
      { now: NOW },
    )
    expect(load.map((l) => l.profileId)).toEqual(['ada', 'zoe'])
  })

  it('returns nothing when nobody has been asked', () => {
    expect(summariseIntroducerLoad([], { now: NOW })).toEqual([])
  })
})

describe('daysBetween', () => {
  it('floors to whole days', () => {
    expect(daysBetween(daysAgo(1), NOW)).toBe(1)
    expect(daysBetween(new Date(NOW.getTime() - 1000), NOW)).toBe(0)
  })
})
