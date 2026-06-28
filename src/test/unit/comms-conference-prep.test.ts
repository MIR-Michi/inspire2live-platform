import { describe, expect, it } from 'vitest'

import {
  emptyConferencePrep,
  isConferencePrepFlag,
  parseKeyPeople,
  prepFlagColumn,
  rowToConferencePrep,
  showsPresentationBlocks,
  stagePrepProgress,
  type ConferencePrep,
} from '@/lib/comms-conference-prep'

function prep(overrides: Partial<ConferencePrep> = {}): ConferencePrep {
  return { ...emptyConferencePrep('c1'), ...overrides }
}

describe('emptyConferencePrep', () => {
  it('defaults to undecided presentation and empty collections', () => {
    const p = emptyConferencePrep('c1')
    expect(p.hasPresentation).toBeNull()
    expect(p.keyPeople).toEqual([])
    expect(p.photoUrls).toEqual([])
    expect(p.outputLinkedin).toBe(false)
  })
})

describe('parseKeyPeople', () => {
  it('keeps only entries with a name and coerces fields', () => {
    const out = parseKeyPeople([
      { name: ' Dr Smith ', org: 'ESMO', topic: 'Immuno', connected: true },
      { org: 'no name' },
      'garbage',
      { name: '' },
    ])
    expect(out).toEqual([{ name: 'Dr Smith', org: 'ESMO', topic: 'Immuno', connected: true }])
  })

  it('returns empty for non-arrays', () => {
    expect(parseKeyPeople(null)).toEqual([])
    expect(parseKeyPeople('x')).toEqual([])
  })
})

describe('stagePrepProgress', () => {
  it('counts completed checklist items per stage', () => {
    const p = prep({ abstractSubmitted: true, deckDrafted: true })
    expect(stagePrepProgress(p, 'registered')).toEqual({ done: 2, total: 3 })
    expect(stagePrepProgress(p, 'ongoing')).toEqual({ done: 0, total: 1 })
  })

  it('reports no checklist for intended and archived', () => {
    const p = prep()
    expect(stagePrepProgress(p, 'intended')).toEqual({ done: 0, total: 0 })
    expect(stagePrepProgress(p, 'archived')).toEqual({ done: 0, total: 0 })
  })

  it('counts amplification outputs for follow-up', () => {
    const p = prep({ outputReport: true, outputLinkedin: true, outputNewsletter: true })
    expect(stagePrepProgress(p, 'follow_up')).toEqual({ done: 3, total: 5 })
  })
})

describe('showsPresentationBlocks', () => {
  it('hides blocks only when attending-only', () => {
    expect(showsPresentationBlocks(prep({ hasPresentation: false }))).toBe(false)
    expect(showsPresentationBlocks(prep({ hasPresentation: true }))).toBe(true)
    expect(showsPresentationBlocks(prep({ hasPresentation: null }))).toBe(true)
  })
})

describe('prep flags', () => {
  it('validates known flags and maps to snake_case columns', () => {
    expect(isConferencePrepFlag('outputLinkedin')).toBe(true)
    expect(isConferencePrepFlag('nope')).toBe(false)
    expect(prepFlagColumn('outputLinkedin')).toBe('output_linkedin')
    expect(prepFlagColumn('deckFinal')).toBe('deck_final')
  })
})

describe('rowToConferencePrep', () => {
  it('maps a db row into the view model', () => {
    const p = rowToConferencePrep({
      conference_id: 'c9',
      has_presentation: true,
      presentation_title: 'Patient voice',
      abstract: 'An abstract',
      asset_urls: ['https://a', 'https://b'],
      key_people: [{ name: 'Jo', connected: false }],
      output_website: true,
      photo_urls: null,
    })
    expect(p.conferenceId).toBe('c9')
    expect(p.hasPresentation).toBe(true)
    expect(p.presentationTitle).toBe('Patient voice')
    expect(p.assetUrls).toEqual(['https://a', 'https://b'])
    expect(p.keyPeople).toEqual([{ name: 'Jo', org: '', topic: '', connected: false }])
    expect(p.outputWebsite).toBe(true)
    expect(p.photoUrls).toEqual([])
  })
})
