import { describe, it, expect } from 'vitest'
import { deriveAttention } from '@/lib/admin-dashboard-data'

describe('deriveAttention', () => {
  it('returns an empty list when everything is healthy', () => {
    const items = deriveAttention({
      onboardingPending: 0,
      openFeedback: 0,
      emailFailures7d: 0,
      aiErrors7d: 0,
      aiConfigured: true,
    })
    expect(items).toEqual([])
  })

  it('only surfaces signals that are actually actionable', () => {
    const items = deriveAttention({
      onboardingPending: 3,
      openFeedback: 0,
      emailFailures7d: 0,
      aiErrors7d: 0,
      aiConfigured: true,
    })
    expect(items.map((i) => i.id)).toEqual(['onboarding'])
    expect(items[0].count).toBe(3)
    expect(items[0].href).toBe('/app/admin/users')
  })

  it('flags a missing AI credential as a neutral item', () => {
    const items = deriveAttention({
      onboardingPending: 0,
      openFeedback: 0,
      emailFailures7d: 0,
      aiErrors7d: 0,
      aiConfigured: false,
    })
    expect(items.map((i) => i.id)).toEqual(['ai-config'])
    expect(items[0].tone).toBe('neutral')
  })

  it('sorts red before amber before neutral', () => {
    const items = deriveAttention({
      onboardingPending: 2, // amber
      openFeedback: 1, // amber
      emailFailures7d: 4, // red
      aiErrors7d: 1, // red
      aiConfigured: false, // neutral
    })
    expect(items.map((i) => i.tone)).toEqual(['red', 'red', 'amber', 'amber', 'neutral'])
  })
})
