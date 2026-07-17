import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  webSearchTool: () => ({ type: 'web_search_20260209', name: 'web_search' }),
  wrapExternalData: (label: string, value: string) => `[${label}]${value}[/${label}]`,
}))

import {
  buildDiscoverySystemPrompt,
  conferenceDedupeKey,
  dedupeConferences,
  normalizeConferenceName,
  normalizeDetail,
  toIsoDate,
  validateConferences,
  type DiscoveredConference,
} from '@/lib/ai/conferences'

const FAR_FUTURE = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
})()

describe('toIsoDate', () => {
  it('keeps a valid ISO date as YYYY-MM-DD', () => {
    expect(toIsoDate('2026-09-14')).toBe('2026-09-14')
  })
  it('coerces a loose month into the first of that month', () => {
    expect(toIsoDate('September 2026')).toBe('2026-09-01')
  })
  it('rejects junk and implausible years', () => {
    expect(toIsoDate('not a date')).toBeNull()
    expect(toIsoDate('1500-01-01')).toBeNull()
    expect(toIsoDate('')).toBeNull()
  })
})

describe('conferenceDedupeKey', () => {
  it('is stable across casing/punctuation and keyed by start month', () => {
    const a = conferenceDedupeKey('ESMO Congress 2026!', '2026-10-16')
    const b = conferenceDedupeKey('esmo  congress 2026', '2026-10-29')
    expect(a).toBe(b) // same name, same month → same key
  })
  it('uses tbd when no start date', () => {
    expect(conferenceDedupeKey('Some Summit', null)).toContain(':tbd')
  })
})

describe('buildDiscoverySystemPrompt', () => {
  it('states the window and forbids inventing conferences', () => {
    const prompt = buildDiscoverySystemPrompt(12)
    expect(prompt).toContain('12 months')
    expect(prompt).toContain('Never invent')
    expect(prompt).toContain('YYYY-MM-DD')
  })
})

describe('validateConferences', () => {
  it('keeps future conferences and assigns the group region as a fallback', () => {
    const out = validateConferences(
      { conferences: [{ name: 'Future Onco Summit', startDate: FAR_FUTURE, relevance: 90 }] },
      'europe',
      12
    )
    expect(out).toHaveLength(1)
    expect(out[0].region).toBe('europe')
    expect(out[0].dedupeKey).toContain('future-onco-summit')
  })
  it('drops past-dated conferences', () => {
    const out = validateConferences({ conferences: [{ name: 'Old Event', startDate: '2001-01-01' }] }, 'global', 12)
    expect(out).toHaveLength(0)
  })
  it('drops entries with no name', () => {
    const out = validateConferences({ conferences: [{ startDate: FAR_FUTURE }] }, 'global', 12)
    expect(out).toHaveLength(0)
  })
  it('keeps date-TBD conferences for manual triage', () => {
    const out = validateConferences({ conferences: [{ name: 'TBD Summit', startDate: null }] }, 'asia_pacific', 12)
    expect(out).toHaveLength(1)
  })
})

describe('dedupeConferences', () => {
  const make = (name: string, relevance: number): DiscoveredConference => ({
    name,
    organizer: null,
    region: 'global',
    location: null,
    mainFocus: null,
    topics: [],
    format: 'in_person',
    startDate: '2026-09-01',
    endDate: null,
    websiteUrl: null,
    sourceUrl: null,
    summary: null,
    relevance,
    dedupeKey: conferenceDedupeKey(name, '2026-09-01'),
  })

  it('collapses duplicates by key, keeping the highest relevance', () => {
    const out = dedupeConferences([make('Onco Summit', 40), make('onco summit', 80)])
    expect(out).toHaveLength(1)
    expect(out[0].relevance).toBe(80)
  })
  it('skips conferences whose key already exists', () => {
    const existing = [conferenceDedupeKey('Onco Summit', '2026-09-01')]
    expect(dedupeConferences([make('Onco Summit', 90)], existing)).toHaveLength(0)
  })
})

describe('conferenceDedupeKey / normalizeConferenceName', () => {
  it('collapses title variants of the same conference to one key', () => {
    const a = conferenceDedupeKey('ESMO Congress 2026', '2026-10-20')
    const b = conferenceDedupeKey('The ESMO Congress', '2026-10-21')
    const c = conferenceDedupeKey('ESMO Congress', '2026-10-01')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('keys on the year, so a month drift between sources does not split', () => {
    expect(conferenceDedupeKey('ASCO Annual Meeting', '2026-06-01')).toBe(
      conferenceDedupeKey('ASCO Annual Meeting', '2026-07-15')
    )
  })

  it('strips ordinal edition markers', () => {
    expect(normalizeConferenceName('24th Annual Breast Cancer Symposium')).toBe('breast-cancer-symposium')
  })

  it('keeps event-type words that distinguish sibling events', () => {
    expect(conferenceDedupeKey('Onco Summit', '2026-09-01')).not.toBe(
      conferenceDedupeKey('Onco Congress', '2026-09-01')
    )
  })

  it('falls back to a stable key when the name is all noise', () => {
    expect(conferenceDedupeKey('2026', '2026-09-01')).toBe('conference:2026')
  })
})

describe('normalizeDetail', () => {
  it('shapes a partial model payload and drops malformed entries', () => {
    const detail = normalizeDetail({
      overview: 'A big oncology meeting.',
      keyTopics: ['immunotherapy', '', 123, 'screening'],
      facts: [{ label: 'Venue', value: 'Vienna' }, { label: 'Bad' }],
      links: [{ label: 'Register', url: 'https://example.org/reg' }, { label: 'Broken', url: 'not-a-url' }],
      notableSpeakers: ['Dr A', 'Dr B'],
    })
    expect(detail.overview).toBe('A big oncology meeting.')
    expect(detail.keyTopics).toEqual(['immunotherapy', 'screening'])
    expect(detail.facts).toEqual([{ label: 'Venue', value: 'Vienna' }])
    expect(detail.links).toEqual([{ label: 'Register', url: 'https://example.org/reg' }])
    expect(detail.notableSpeakers).toEqual(['Dr A', 'Dr B'])
  })
  it('returns a fully-shaped empty detail for junk input', () => {
    const detail = normalizeDetail(null)
    expect(detail.overview).toBeNull()
    expect(detail.keyTopics).toEqual([])
    expect(detail.facts).toEqual([])
    expect(detail.links).toEqual([])
  })
})
