/**
 * podcast-planning — where the old Guests tab goes (concept §1).
 *
 * The tab is removed; the data is not. These assertions guard the promise that
 * nothing is deleted and that re-running the import is safe.
 */

import { describe, it, expect } from 'vitest'
import {
  extractPastGuests,
  guestToPersonInput,
} from '@/modules/podcast-planning/domain/guest-import'
import type { EpisodeGuestSource } from '@/modules/podcast-planning/domain/guest-import'

const episodes: EpisodeGuestSource[] = [
  { id: 'e1', title: 'Reimbursement delays', startDate: '2026-02-10', guests: ['Prof. Grace Hopper', 'Dr Ada Lovelace'] },
  { id: 'e2', title: 'Screening thresholds', startDate: '2026-05-20', guests: ['prof. grace hopper'] },
  { id: 'e3', title: 'No guests yet', startDate: '2026-06-01', guests: null },
  { id: 'e4', title: 'Blank entries', startDate: '2026-06-15', guests: ['  ', ''] },
]

describe('extractPastGuests', () => {
  it('collapses episodes into one record per guest', () => {
    const guests = extractPastGuests(episodes)
    expect(guests.map((g) => g.fullName)).toEqual(['Dr Ada Lovelace', 'Prof. Grace Hopper'])
  })

  it('counts every appearance and keeps the latest episode', () => {
    const grace = extractPastGuests(episodes).find((g) => g.fullName === 'Prof. Grace Hopper')!
    expect(grace.episodeCount).toBe(2)
    expect(grace.latestDate).toBe('2026-05-20')
    expect(grace.latestTitle).toBe('Screening thresholds')
    expect(grace.episodeIds).toEqual(['e1', 'e2'])
  })

  it('matches names case- and whitespace-insensitively but keeps the written form', () => {
    const guests = extractPastGuests([
      { id: 'a', title: 'A', startDate: '2026-01-01', guests: ['Ada  Lovelace'] },
      { id: 'b', title: 'B', startDate: '2026-02-01', guests: ['ada lovelace'] },
    ])
    expect(guests).toHaveLength(1)
    // The display name is somebody's name, not a key — first form wins.
    expect(guests[0].fullName).toBe('Ada  Lovelace')
  })

  it('ignores empty and missing guest lists rather than creating blank people', () => {
    expect(extractPastGuests([episodes[2], episodes[3]])).toEqual([])
  })

  it('is stable — the same episodes always produce the same records', () => {
    expect(extractPastGuests(episodes)).toEqual(extractPastGuests(episodes))
  })
})

describe('guestToPersonInput', () => {
  it('marks them a past guest, which is the strongest origin there is', () => {
    const [guest] = extractPastGuests([episodes[1]])
    const person = guestToPersonInput(guest)
    expect(person.origin).toBe('past_guest')
    expect(person.fullName).toBe('prof. grace hopper')
  })

  it('records the appearance — the single most predictive field in the model', () => {
    const grace = extractPastGuests(episodes).find((g) => g.fullName === 'Prof. Grace Hopper')!
    const person = guestToPersonInput(grace)
    expect(person.appearances).toEqual([
      { show: 'Inspire2Live podcast', url: null, publishedAt: '2026-05-20' },
    ])
  })

  it('attributes every derived field to its source (concept §16)', () => {
    const grace = extractPastGuests(episodes).find((g) => g.fullName === 'Prof. Grace Hopper')!
    const person = guestToPersonInput(grace)
    expect(person.sourceAttribution).toEqual({
      podcast_appearances: 'internal:events/e1',
      origin: 'internal:podcast-guest-roster',
    })
  })

  it('carries no private contact detail — professional information only', () => {
    const [guest] = extractPastGuests([episodes[0]])
    const person = guestToPersonInput(guest)
    expect(Object.keys(person)).not.toContain('email')
    expect(Object.keys(person)).not.toContain('phone')
  })

  it('notes a repeat guest and leaves a one-off note empty', () => {
    const all = extractPastGuests(episodes)
    const grace = guestToPersonInput(all.find((g) => g.fullName === 'Prof. Grace Hopper')!)
    const ada = guestToPersonInput(all.find((g) => g.fullName === 'Dr Ada Lovelace')!)
    expect(grace.notes).toContain('2 episodes')
    expect(ada.notes).toBeNull()
  })
})
