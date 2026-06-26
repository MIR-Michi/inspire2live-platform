import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  webSearchTool: () => ({ type: 'web_search_20260209', name: 'web_search' }),
  wrapExternalData: (label: string, value: string) => `[${label}]${value}[/${label}]`,
}))

import {
  buildNewsfeedSystemPrompt,
  dedupeNewsItems,
  normalizeUrl,
  validateNewsFeedItems,
  type NewsFeedItem,
} from '@/lib/ai/org-newsfeed'
import { DEFAULT_ORG_FEED_CONFIG } from '@/lib/ai/org-feed-config'

describe('buildNewsfeedSystemPrompt', () => {
  it('embeds the configured topics, themes, region, and source rules', () => {
    const prompt = buildNewsfeedSystemPrompt({
      ...DEFAULT_ORG_FEED_CONFIG,
      topics: ['precision oncology'],
      themes: ['patient advocacy'],
      region: 'Europe',
      allowedSources: ['nature.com'],
      blockedSources: ['tabloid.com'],
    })
    expect(prompt).toContain('precision oncology')
    expect(prompt).toContain('patient advocacy')
    expect(prompt).toContain('Europe')
    expect(prompt).toContain('nature.com')
    expect(prompt).toContain('tabloid.com')
    expect(prompt).toContain('mandatory citation')
  })

  it('adds a mention-monitoring section for watched entities', () => {
    const prompt = buildNewsfeedSystemPrompt(DEFAULT_ORG_FEED_CONFIG, {
      organizations: ['Inspire2Live'],
      people: ['Peter Kapitein'],
    })
    expect(prompt).toContain('Mention monitoring')
    expect(prompt).toContain('Inspire2Live')
    expect(prompt).toContain('Peter Kapitein')
    expect(prompt).toContain('mentionOf')
  })

  it('omits the mention section when nothing is watched', () => {
    const prompt = buildNewsfeedSystemPrompt(DEFAULT_ORG_FEED_CONFIG)
    expect(prompt).not.toContain('Mention monitoring')
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
  })

  it('drops items already stored and repeats within the batch', () => {
    const result = dedupeNewsItems(
      [make('https://nature.com/a'), make('https://nature.com/a/'), make('https://who.int/b')],
      ['https://NATURE.com/a']
    )
    expect(result.map((i) => i.sourceUrl)).toEqual(['https://who.int/b'])
  })
})
