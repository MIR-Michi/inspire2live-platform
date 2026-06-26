import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  webSearchTool: () => ({ type: 'web_search_20260209', name: 'web_search' }),
  wrapExternalData: (label: string, value: string) => `[${label}]${value}[/${label}]`,
}))

import {
  buildNewsfeedSystemPrompt,
  buildSearchGroups,
  dedupeNewsItems,
  normalizeUrl,
  toIsoTimestamp,
  validateNewsFeedItems,
  type NewsFeedItem,
} from '@/lib/ai/org-newsfeed'
import { DEFAULT_ORG_FEED_CONFIG } from '@/lib/ai/org-feed-config'

describe('buildNewsfeedSystemPrompt', () => {
  it('is a stable, cacheable prefix: region + source rules + citation rule, no per-topic content', () => {
    const prompt = buildNewsfeedSystemPrompt({
      ...DEFAULT_ORG_FEED_CONFIG,
      topics: ['precision oncology'],
      themes: ['patient advocacy'],
      region: 'Europe',
      allowedSources: ['nature.com'],
      blockedSources: ['tabloid.com'],
    })
    expect(prompt).toContain('Europe')
    expect(prompt).toContain('nature.com')
    expect(prompt).toContain('tabloid.com')
    expect(prompt).toContain('mandatory citation')
    // Topic/theme specifics live in the per-group user message, not the prefix.
    expect(prompt).not.toContain('precision oncology')
    expect(prompt).not.toContain('patient advocacy')
  })
})

describe('buildSearchGroups', () => {
  it('creates a group per topic and theme, plus a mentions group, capped', () => {
    const groups = buildSearchGroups(
      { ...DEFAULT_ORG_FEED_CONFIG, topics: ['precision oncology', 'clinical trials'], themes: ['patient advocacy'] },
      { organizations: ['Inspire2Live'], people: ['Peter Kapitein'] }
    )
    const labels = groups.map((g) => g.label)
    expect(labels).toContain('Mentions')
    expect(labels).toContain('precision oncology')
    expect(labels).toContain('clinical trials')
    expect(labels).toContain('patient advocacy')
    // Mentions group is first (prioritised) and carries the watched names.
    expect(groups[0].kind).toBe('mention')
    expect(groups[0].query).toContain('Inspire2Live')
    expect(groups[0].query).toContain('Peter Kapitein')
  })

  it('omits the mentions group when nothing is watched, and respects the cap', () => {
    const groups = buildSearchGroups(
      { ...DEFAULT_ORG_FEED_CONFIG, topics: ['a', 'b', 'c'], themes: ['d', 'e', 'f', 'g'] },
      undefined,
      4
    )
    expect(groups).toHaveLength(4)
    expect(groups.some((g) => g.kind === 'mention')).toBe(false)
  })
})

describe('toIsoTimestamp', () => {
  it('coerces partial/loose dates the model returns into valid ISO (or null)', () => {
    expect(toIsoTimestamp('2025')).toBe('2025-01-01T00:00:00.000Z')
    expect(toIsoTimestamp('2025-06-15')).toBe('2025-06-15T00:00:00.000Z')
    expect(toIsoTimestamp('2025-06-15T10:30:00Z')).toBe('2025-06-15T10:30:00.000Z')
    expect(toIsoTimestamp('not a date')).toBeNull()
    expect(toIsoTimestamp('')).toBeNull()
    expect(toIsoTimestamp(null)).toBeNull()
    expect(toIsoTimestamp('1700')).toBeNull() // implausible year
  })
})

describe('normalizeUrl', () => {
  it('lowercases host, drops fragments and trailing slash', () => {
    expect(normalizeUrl('https://WWW.Nature.com/Article/')).toBe('https://www.nature.com/article')
    expect(normalizeUrl('https://nature.com/x#section')).toBe('https://nature.com/x')
  })
})

describe('validateNewsFeedItems', () => {
  it('accepts items wrapped in { items: [...] } and requires a valid URL', () => {
    const items = validateNewsFeedItems({
      items: [
        { headline: 'New therapy approved', sourceUrl: 'https://nature.com/a', category: 'medical', relevance: 90 },
        { headline: 'No URL', sourceUrl: '', category: 'policy', relevance: 50 },
        { headline: 'Bad URL', sourceUrl: 'not-a-url', category: 'policy', relevance: 50 },
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ headline: 'New therapy approved', sourceUrl: 'https://nature.com/a', relevance: 90 })
    expect(items[0].sourceName).toBe('nature.com')
  })

  it('enforces blocked domains and clamps relevance + unknown category', () => {
    const items = validateNewsFeedItems(
      {
        items: [
          { headline: 'Blocked', sourceUrl: 'https://tabloid.com/x', category: 'medical', relevance: 80 },
          { headline: 'Clamped', sourceUrl: 'https://who.int/y', category: 'unknown-cat', relevance: 250 },
        ],
      },
      ['tabloid.com']
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ headline: 'Clamped', relevance: 100, category: 'other' })
  })

  it('returns empty for non-array input', () => {
    expect(validateNewsFeedItems(null)).toEqual([])
    expect(validateNewsFeedItems({ items: 'nope' })).toEqual([])
  })
})

describe('dedupeNewsItems', () => {
  const make = (url: string): NewsFeedItem => ({
    headline: 'h',
    summary: null,
    category: 'other',
    region: null,
    sourceUrl: url,
    sourceName: null,
    relevance: 50,
    publishedAt: null,
    mentionOf: null,
    topic: null,
  })

  it('drops items already stored and repeats within the batch', () => {
    const result = dedupeNewsItems(
      [make('https://nature.com/a'), make('https://nature.com/a/'), make('https://who.int/b')],
      ['https://NATURE.com/a']
    )
    expect(result.map((i) => i.sourceUrl)).toEqual(['https://who.int/b'])
  })
})
