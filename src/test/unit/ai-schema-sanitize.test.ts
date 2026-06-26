import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { sanitizeStructuredSchema } from '@/lib/ai/client'
import { NEWS_FEED_JSON_SCHEMA } from '@/lib/ai/org-newsfeed'
import { MEETING_SUMMARY_JSON_SCHEMA } from '@/lib/ai/meeting-summary'

function collectKeys(node: unknown, found: Set<string>) {
  if (Array.isArray(node)) {
    for (const entry of node) collectKeys(entry, found)
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.add(key)
      collectKeys(value, found)
    }
  }
}

const UNSUPPORTED = ['minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'multipleOf']

describe('sanitizeStructuredSchema', () => {
  it('strips unsupported validation keywords from a nested schema', () => {
    const cleaned = sanitizeStructuredSchema({
      type: 'object',
      additionalProperties: false,
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          maxItems: 25,
          items: {
            type: 'object',
            required: ['headline', 'relevance'],
            properties: {
              headline: { type: 'string', minLength: 1, maxLength: 240 },
              relevance: { type: 'integer', minimum: 0, maximum: 100 },
            },
          },
        },
      },
    })

    const keys = new Set<string>()
    collectKeys(cleaned, keys)
    for (const bad of UNSUPPORTED) expect(keys.has(bad)).toBe(false)
  })

  it('preserves structural keywords and enum/required/type', () => {
    const cleaned = sanitizeStructuredSchema({
      type: 'object',
      additionalProperties: false,
      required: ['category'],
      properties: {
        category: { type: 'string', enum: ['medical', 'policy'] },
        nullable: { type: ['string', 'null'], maxLength: 10 },
      },
    }) as Record<string, unknown>

    const props = cleaned.properties as Record<string, Record<string, unknown>>
    expect(cleaned.required).toEqual(['category'])
    expect(cleaned.additionalProperties).toBe(false)
    expect(props.category.enum).toEqual(['medical', 'policy'])
    expect(props.category.type).toBe('string')
    expect(props.nullable.type).toEqual(['string', 'null'])
    expect('maxLength' in props.nullable).toBe(false)
  })

  it('does not strip a property literally named like a keyword', () => {
    const cleaned = sanitizeStructuredSchema({
      type: 'object',
      properties: {
        // a field named "pattern" must survive as a property
        pattern: { type: 'string', maxLength: 5 },
      },
    }) as Record<string, unknown>
    const props = cleaned.properties as Record<string, unknown>
    expect('pattern' in props).toBe(true)
    expect('maxLength' in (props.pattern as Record<string, unknown>)).toBe(false)
  })

  it('cleans the real newsfeed and meeting-summary schemas', () => {
    for (const schema of [NEWS_FEED_JSON_SCHEMA, MEETING_SUMMARY_JSON_SCHEMA]) {
      const keys = new Set<string>()
      collectKeys(sanitizeStructuredSchema(schema), keys)
      for (const bad of UNSUPPORTED) expect(keys.has(bad)).toBe(false)
    }
  })
})
