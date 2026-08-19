import { describe, expect, it } from 'vitest'
import { validateChannelPostPayload } from '@/modules/publishing/domain/claims'

const SENT_KEYS = ['summary', 'decisions_for_publication']

function variant(overrides: Record<string, unknown> = {}) {
  return {
    angle: 'Momentum',
    body: 'The campus agreed to publish its findings.',
    hashtags: ['#PatientAdvocacy'],
    claims: [{ text: 'The campus agreed to publish.', sourceFieldKey: 'summary' }],
    ...overrides,
  }
}

describe('validateChannelPostPayload (groundedness)', () => {
  it('accepts a grounded payload', () => {
    const result = validateChannelPostPayload(
      { variants: [variant()], imageDescription: null, omitted: [] },
      SENT_KEYS,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.variants).toHaveLength(1)
      expect(result.payload.variants[0].claims[0].sourceFieldKey).toBe('summary')
    }
  })

  it('rejects a claim citing a source field that was never sent', () => {
    const result = validateChannelPostPayload(
      {
        variants: [variant({ claims: [{ text: 'Invented.', sourceFieldKey: 'transcript' }] })],
        imageDescription: null,
        omitted: [],
      },
      SENT_KEYS,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("'transcript'")
  })

  it('rejects a payload with no variants', () => {
    expect(validateChannelPostPayload({ variants: [] }, SENT_KEYS).ok).toBe(false)
    expect(validateChannelPostPayload(null, SENT_KEYS).ok).toBe(false)
    expect(validateChannelPostPayload('text', SENT_KEYS).ok).toBe(false)
  })

  it('rejects an empty body and a claim without text', () => {
    expect(
      validateChannelPostPayload({ variants: [variant({ body: '  ' })] }, SENT_KEYS).ok,
    ).toBe(false)
    expect(
      validateChannelPostPayload(
        { variants: [variant({ claims: [{ text: '', sourceFieldKey: 'summary' }] })] },
        SENT_KEYS,
      ).ok,
    ).toBe(false)
  })

  it('normalises hashtags to a leading #', () => {
    const result = validateChannelPostPayload(
      { variants: [variant({ hashtags: ['PatientAdvocacy', '#Cancer Research'] })], imageDescription: null, omitted: [] },
      SENT_KEYS,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.variants[0].hashtags).toEqual(['#PatientAdvocacy', '#CancerResearch'])
    }
  })

  it('caps the variant count at maxVariants', () => {
    const result = validateChannelPostPayload(
      { variants: [variant(), variant(), variant(), variant()], imageDescription: null, omitted: [] },
      SENT_KEYS,
      { maxVariants: 2 },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.variants).toHaveLength(2)
  })

  it('carries the image description through for the review UI', () => {
    const result = validateChannelPostPayload(
      { variants: [variant()], imageDescription: 'A conference stand with a banner.', omitted: ['attendee list'] },
      SENT_KEYS,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.imageDescription).toBe('A conference stand with a banner.')
      expect(result.payload.omitted).toEqual(['attendee list'])
    }
  })
})
