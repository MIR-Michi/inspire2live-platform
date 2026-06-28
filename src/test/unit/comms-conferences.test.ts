import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  webSearchTool: () => ({}),
  wrapExternalData: (l: string, v: string) => `${l}:${v}`,
}))

import {
  filterConferences,
  partitionConferences,
  type ConferenceStage,
  type ConferenceView,
} from '@/lib/comms-conferences'

function conf(overrides: Partial<ConferenceView> & { id: string }): ConferenceView {
  return {
    id: overrides.id,
    name: overrides.name ?? 'Conf',
    organizer: overrides.organizer ?? null,
    region: overrides.region ?? 'europe',
    regionLabel: overrides.regionLabel ?? 'Europe',
    location: overrides.location ?? null,
    mainFocus: overrides.mainFocus ?? null,
    topics: overrides.topics ?? [],
    format: overrides.format ?? 'in_person',
    startDate: overrides.startDate ?? '2026-09-01',
    endDate: overrides.endDate ?? null,
    websiteUrl: overrides.websiteUrl ?? null,
    sourceUrl: overrides.sourceUrl ?? null,
    summary: overrides.summary ?? null,
    relevance: overrides.relevance ?? 50,
    detail: overrides.detail ?? null,
    detailStatus: overrides.detailStatus ?? 'none',
    tracking: overrides.tracking ?? null,
  }
}

const track = (stage: ConferenceStage) => ({ stage, notes: null, addedAt: 'x', updatedAt: 'x' })

describe('filterConferences', () => {
  const list = [
    conf({ id: '1', name: 'ESMO Congress', region: 'europe', mainFocus: 'General oncology', format: 'in_person', topics: ['immunotherapy'] }),
    conf({ id: '2', name: 'AACR Annual', region: 'north_america', mainFocus: 'Research', format: 'hybrid' }),
    conf({ id: '3', name: 'Virtual Breast Summit', region: 'global', mainFocus: 'Breast cancer', format: 'virtual' }),
  ]

  it('passes everything through with all-filters', () => {
    expect(filterConferences(list, { region: 'all', focus: 'all', format: 'all', search: '' })).toHaveLength(3)
  })
  it('filters by region', () => {
    const out = filterConferences(list, { region: 'europe' })
    expect(out.map((c) => c.id)).toEqual(['1'])
  })
  it('filters by focus (case-insensitive)', () => {
    const out = filterConferences(list, { focus: 'breast cancer' })
    expect(out.map((c) => c.id)).toEqual(['3'])
  })
  it('filters by format', () => {
    expect(filterConferences(list, { format: 'virtual' }).map((c) => c.id)).toEqual(['3'])
  })
  it('searches name, focus, and topics', () => {
    expect(filterConferences(list, { search: 'immuno' }).map((c) => c.id)).toEqual(['1'])
    expect(filterConferences(list, { search: 'aacr' }).map((c) => c.id)).toEqual(['2'])
  })
})

describe('partitionConferences', () => {
  it('routes conferences to a tab per stage, keeping intended in Upcoming', () => {
    const list = [
      conf({ id: 'd' }), // discovered → upcoming only
      conf({ id: 'i', tracking: track('intended') }), // intended + upcoming
      conf({ id: 'r', tracking: track('registered') }), // registered
      conf({ id: 'o', tracking: track('ongoing') }), // ongoing
      conf({ id: 'f', tracking: track('follow_up') }), // follow_up
      conf({ id: 'a', tracking: track('archived') }), // archived
    ]
    const p = partitionConferences(list)
    expect(p.upcoming.map((c) => c.id).sort()).toEqual(['d', 'i'])
    expect(p.intended.map((c) => c.id)).toEqual(['i'])
    expect(p.registered.map((c) => c.id)).toEqual(['r'])
    expect(p.ongoing.map((c) => c.id)).toEqual(['o'])
    expect(p.follow_up.map((c) => c.id)).toEqual(['f'])
    expect(p.archived.map((c) => c.id)).toEqual(['a'])
  })
})
