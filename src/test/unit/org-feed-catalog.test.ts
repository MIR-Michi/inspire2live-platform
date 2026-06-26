import { describe, expect, it } from 'vitest'

import {
  ALL_SUGGESTED_TOPICS,
  ALL_SUGGESTED_THEMES,
  splitKnownAndCustom,
  SUGGESTED_TOPIC_CATEGORIES,
} from '@/lib/ai/org-feed-catalog'

describe('splitKnownAndCustom', () => {
  it('separates catalog matches from custom values, case-insensitively', () => {
    const result = splitKnownAndCustom(
      ['Precision oncology', 'CAR-T cell therapy', 'Tumor microenvironment', 'breast'],
      ALL_SUGGESTED_TOPICS
    )
    expect(result.known).toContain('Precision oncology')
    expect(result.known).toContain('CAR-T cell therapy')
    expect(result.known).toContain('Breast') // canonical casing from the catalog
    expect(result.custom).toEqual(['Tumor microenvironment'])
  })

  it('de-duplicates and ignores blanks', () => {
    const result = splitKnownAndCustom(['Patient advocacy & voice', 'patient advocacy & voice', '  '], ALL_SUGGESTED_THEMES)
    expect(result.known).toEqual(['Patient advocacy & voice'])
    expect(result.custom).toEqual([])
  })

  it('returns everything as custom when nothing matches', () => {
    const result = splitKnownAndCustom(['Quantum widgets'], ALL_SUGGESTED_TOPICS)
    expect(result.known).toEqual([])
    expect(result.custom).toEqual(['Quantum widgets'])
  })
})

describe('catalog integrity', () => {
  it('exposes unique category ids and non-empty subtopics', () => {
    const ids = SUGGESTED_TOPIC_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const cat of SUGGESTED_TOPIC_CATEGORIES) expect(cat.subtopics.length).toBeGreaterThan(0)
  })

  it('flattens category labels and subtopics into ALL_SUGGESTED_TOPICS', () => {
    for (const cat of SUGGESTED_TOPIC_CATEGORIES) {
      expect(ALL_SUGGESTED_TOPICS).toContain(cat.label)
      for (const sub of cat.subtopics) expect(ALL_SUGGESTED_TOPICS).toContain(sub)
    }
  })
})
