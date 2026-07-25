/**
 * network — affiliation overlap (concept §8, first mechanism).
 *
 * The central rule under test: overlap produces a *guess*, never a claim. If
 * anything in here ever produced a `confirmed` connection, the platform would be
 * asserting that two people know each other because their CVs matched.
 */

import { describe, it, expect } from 'vitest'
import {
  normaliseAffiliationName,
  suggestConnections,
  yearsOverlap,
} from '@/modules/network/domain/affiliation-overlap'
import type { MemberAffiliation, PersonAffiliation } from '@/modules/network/domain/types'

const PROFILE = 'profile-1'
const PERSON = 'person-1'

function mine(partial: Partial<MemberAffiliation> & Pick<MemberAffiliation, 'kind' | 'name'>): MemberAffiliation {
  return {
    id: `m-${partial.name}`,
    profileId: PROFILE,
    fromYear: null,
    toYear: null,
    visibility: 'network',
    ...partial,
  }
}

function theirs(
  partial: Partial<PersonAffiliation> & Pick<PersonAffiliation, 'kind' | 'name'>,
): PersonAffiliation {
  return {
    id: `p-${partial.name}`,
    personId: PERSON,
    fromYear: null,
    toYear: null,
    sourceUrl: null,
    ...partial,
  }
}

describe('normaliseAffiliationName', () => {
  it('ignores case, punctuation, accents and generic org words', () => {
    expect(normaliseAffiliationName('Erasmus MC — University Medical Center')).toBe(
      normaliseAffiliationName('erasmus mc university medical centre'),
    )
    expect(normaliseAffiliationName('Institut Gustave Roussy')).toBe(
      normaliseAffiliationName('Institut Gustave-Roussy'),
    )
  })
})

describe('yearsOverlap', () => {
  it('treats a missing bound as open-ended', () => {
    expect(yearsOverlap({ fromYear: 2010, toYear: null }, { fromYear: 2020, toYear: 2021 })).toBe(true)
    expect(yearsOverlap({ fromYear: null, toYear: null }, { fromYear: 1999, toYear: 2000 })).toBe(true)
  })

  it('is false for genuinely separate periods', () => {
    expect(yearsOverlap({ fromYear: 2000, toYear: 2004 }, { fromYear: 2010, toYear: 2015 })).toBe(false)
  })
})

describe('suggestConnections', () => {
  it('produces suggestions only — never a confirmed connection', () => {
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'board', name: 'EU HTA advisory panel' })],
      [theirs({ kind: 'board', name: 'EU HTA Advisory Panel' })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('suggested')
    expect(out[0].connectionType).toBe('shared_board')
    expect(out[0].strength).toBe(0.6)
  })

  it('never uses a private declaration — consent is per item', () => {
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'society', name: 'ESMO', visibility: 'private' })],
      [theirs({ kind: 'society', name: 'ESMO' })],
    )
    expect(out).toEqual([])
  })

  it('requires overlapping years for a shared institution', () => {
    const noOverlap = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'institution', name: 'Erasmus MC', fromYear: 2000, toYear: 2004 })],
      [theirs({ kind: 'institution', name: 'Erasmus MC', fromYear: 2012, toYear: 2018 })],
    )
    expect(noOverlap).toEqual([])

    const overlap = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'institution', name: 'Erasmus MC', fromYear: 2010, toYear: 2016 })],
      [theirs({ kind: 'institution', name: 'Erasmus MC', fromYear: 2012, toYear: 2018 })],
    )
    expect(overlap).toHaveLength(1)
    expect(overlap[0].evidence[0].detail).toContain('2012')
  })

  it('does not match across different kinds', () => {
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'country', name: 'Netherlands' })],
      [theirs({ kind: 'institution', name: 'Netherlands' })],
    )
    expect(out).toEqual([])
  })

  it('emits one edge per connection type, with the corroboration merged in', () => {
    // Four shared societies must not make somebody look four times as connected.
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [
        mine({ kind: 'society', name: 'ESMO' }),
        mine({ kind: 'society', name: 'EHA' }),
        mine({ kind: 'society', name: 'ECPC' }),
      ],
      [
        theirs({ kind: 'society', name: 'ESMO' }),
        theirs({ kind: 'society', name: 'EHA' }),
        theirs({ kind: 'society', name: 'ECPC' }),
      ],
    )
    expect(out).toHaveLength(1)
    expect(out[0].strength).toBe(0.25)
    expect(out[0].evidence).toHaveLength(3)
  })

  it('returns the strongest overlap first', () => {
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'society', name: 'ESMO' }), mine({ kind: 'board', name: 'Cancer Mission board' })],
      [theirs({ kind: 'society', name: 'ESMO' }), theirs({ kind: 'board', name: 'Cancer Mission Board' })],
    )
    expect(out.map((c) => c.connectionType)).toEqual(['shared_board', 'shared_society'])
  })

  it('carries the source URL through as evidence', () => {
    const out = suggestConnections(
      PROFILE,
      PERSON,
      [mine({ kind: 'congress', name: 'ESMO 2026' })],
      [theirs({ kind: 'congress', name: 'ESMO 2026', sourceUrl: 'https://esmo.org/programme' })],
    )
    expect(out[0].evidence[0].sourceUrl).toBe('https://esmo.org/programme')
  })
})
