import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  wrapExternalData: (label: string, value: string) => [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n'),
}))

import {
  buildDeterministicIntakeSuggestion,
  validateStructuredIntakeSuggestion,
} from '@/lib/ai/intake-structure'

describe('intake AI structure helper', () => {
  it('accepts a schema-valid structure suggestion', () => {
    const result = validateStructuredIntakeSuggestion({
      contentType: 'article_share',
      summary: 'A new paper should be considered for the newsletter.',
      entities: [
        { name: 'Precision Oncology Journal', type: 'organization' },
        { name: 'https://example.org/paper', type: 'url', value: 'https://example.org/paper' },
      ],
      suggestedChannel: 'newsletter',
      suggestedAction: 'route_to_calendar',
      founderSignal: false,
      confidence: 'medium',
      rationale: 'The intake shares a public article link and asks comms to review it.',
    })

    expect(result).toMatchObject({
      contentType: 'article_share',
      suggestedChannel: 'newsletter',
      suggestedAction: 'route_to_calendar',
      confidence: 'medium',
    })
    expect(result?.entities).toHaveLength(2)
  })

  it('rejects unknown content types and unsupported actions', () => {
    expect(
      validateStructuredIntakeSuggestion({
        contentType: 'fundraising_lead',
        summary: 'A plausible but unsupported category.',
        entities: [],
        suggestedChannel: 'newsletter',
        suggestedAction: 'route_to_calendar',
        founderSignal: false,
        confidence: 'medium',
        rationale: 'Unsupported taxonomy entry.',
      })
    ).toBeNull()

    expect(
      validateStructuredIntakeSuggestion({
        contentType: 'article_share',
        summary: 'A valid summary.',
        entities: [],
        suggestedChannel: 'newsletter',
        suggestedAction: 'send_without_review',
        founderSignal: false,
        confidence: 'medium',
        rationale: 'Unsupported automation action.',
      })
    ).toBeNull()
  })

  it('builds a deterministic fallback from existing classifier rules', () => {
    const result = buildDeterministicIntakeSuggestion({
      senderName: 'Event Lead',
      rawContent: 'Workshop report from Vienna is ready for LinkedIn and the newsletter.',
      sourceUrl: null,
      attachedMediaRef: null,
    })

    expect(result.source).toBe('deterministic_fallback')
    expect(result.contentType).toBe('event_report')
    expect(result.suggestedAction).toBe('route_to_calendar')
    expect(result.suggestedChannel).toBe('linkedin')
    expect(result.confidence).toBe('high')
  })
})
