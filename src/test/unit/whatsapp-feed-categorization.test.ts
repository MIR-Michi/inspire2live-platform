import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  runAiMessage: vi.fn(),
}))

vi.mock('@/kernel/ai-client/client', () => ({
  runAiMessage: mocks.runAiMessage,
  wrapExternalData: (label: string, value: string) =>
    [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n'),
}))

import {
  WHATSAPP_CATEGORIES,
  isWhatsAppCategory,
  deriveDefaultWindow,
  formatWhatsAppFeed,
  validateCategorization,
  categorizeWhatsAppFeed,
  type WhatsAppFeedMessage,
} from '@/lib/ai/whatsapp-feed-categorization'

const messages: WhatsAppFeedMessage[] = [
  { id: 'a1', senderName: 'Peter', text: 'Happy birthday Maria!', timestamp: '2026-02-02T09:00:00.000Z' },
  { id: 'b2', senderName: 'Maria', text: 'Thank you all 🎉', timestamp: '2026-02-02T09:05:00.000Z' },
  { id: 'c3', senderName: 'Admin', text: 'Please welcome our new member, Jon.', timestamp: '2026-02-03T10:00:00.000Z' },
]

beforeEach(() => {
  mocks.runAiMessage.mockReset()
})

describe('category vocabulary', () => {
  it('exposes the seven agreed categories', () => {
    expect(WHATSAPP_CATEGORIES).toEqual([
      'birthday',
      'new_member',
      'event',
      'question',
      'news',
      'i2l_initiative',
      'other',
    ])
  })

  it('guards category values', () => {
    expect(isWhatsAppCategory('birthday')).toBe(true)
    expect(isWhatsAppCategory('nonsense')).toBe(false)
    expect(isWhatsAppCategory(42)).toBe(false)
  })
})

describe('deriveDefaultWindow', () => {
  it('takes the two most recent campus meeting dates as [start, end]', () => {
    expect(deriveDefaultWindow(['2026-01-04', '2026-02-01', '2025-12-07'])).toEqual({
      start: '2026-01-04',
      end: '2026-02-01',
    })
  })

  it('ignores blanks and invalid dates', () => {
    expect(deriveDefaultWindow(['2026-02-01', '', null, 'not-a-date', '2026-01-04'])).toEqual({
      start: '2026-01-04',
      end: '2026-02-01',
    })
  })

  it('returns null when fewer than two valid dates exist', () => {
    expect(deriveDefaultWindow(['2026-02-01'])).toBeNull()
    expect(deriveDefaultWindow([])).toBeNull()
  })
})

describe('formatWhatsAppFeed', () => {
  it('assigns stable oldest-first refs and maps them to intake ids', () => {
    const { prompt, refToId } = formatWhatsAppFeed(messages)
    expect(refToId.get('m1')).toBe('a1')
    expect(refToId.get('m3')).toBe('c3')
    // Oldest first, each line carries its ref.
    expect(prompt.split('\n')[0]).toContain('[m1]')
    expect(prompt).toContain('Peter: Happy birthday Maria!')
  })

  it('orders out-of-order input chronologically', () => {
    const shuffled = [messages[2], messages[0], messages[1]]
    const { refToId } = formatWhatsAppFeed(shuffled)
    expect(refToId.get('m1')).toBe('a1') // earliest timestamp wins m1
  })
})

describe('validateCategorization', () => {
  const refToId = formatWhatsAppFeed(messages).refToId

  it('resolves source refs to intake ids and keeps only grounded items', () => {
    const result = validateCategorization(
      {
        tldr: 'A birthday and a new member.',
        monthlySummary: null,
        items: [
          { category: 'birthday', title: 'Birthday — Maria', person: 'Maria', date: null, detail: null, sourceRefs: ['m1', 'm2'] },
          { category: 'new_member', title: 'New member — Jon', person: 'Jon', date: null, detail: null, sourceRefs: ['m3'] },
        ],
      },
      refToId
    )
    expect(result?.items).toHaveLength(2)
    expect(result?.items[0].sourceMessageIds).toEqual(['a1', 'b2'])
    expect(result?.items[1].category).toBe('new_member')
  })

  it('drops items with no verifiable source and unknown refs', () => {
    const result = validateCategorization(
      {
        tldr: 'x',
        monthlySummary: null,
        items: [
          { category: 'news', title: 'Invented', sourceRefs: ['m99'] }, // unknown ref → dropped
          { category: 'other', title: 'No source', sourceRefs: [] }, // empty → dropped
        ],
      },
      refToId
    )
    expect(result?.items).toHaveLength(0)
  })

  it('rejects invalid categories and empty titles', () => {
    const result = validateCategorization(
      {
        tldr: 'x',
        monthlySummary: null,
        items: [
          { category: 'bogus', title: 'Bad category', sourceRefs: ['m1'] },
          { category: 'event', title: '', sourceRefs: ['m1'] },
        ],
      },
      refToId
    )
    expect(result?.items).toHaveLength(0)
  })

  it('returns null when tldr is missing', () => {
    expect(validateCategorization({ items: [] }, refToId)).toBeNull()
    expect(validateCategorization(null, refToId)).toBeNull()
  })

  it('de-duplicates repeated source refs', () => {
    const result = validateCategorization(
      {
        tldr: 'x',
        monthlySummary: 'Monthly rollup.',
        items: [{ category: 'birthday', title: 'B', sourceRefs: ['m1', 'm1'] }],
      },
      refToId
    )
    expect(result?.items[0].sourceMessageIds).toEqual(['a1'])
    expect(result?.monthlySummary).toBe('Monthly rollup.')
  })
})

describe('categorizeWhatsAppFeed', () => {
  it('short-circuits an empty feed without calling the model', async () => {
    const result = await categorizeWhatsAppFeed({ messages: [] })
    expect(mocks.runAiMessage).not.toHaveBeenCalled()
    expect(result.items).toEqual([])
    expect(result.tldr).toMatch(/no whatsapp messages/i)
  })

  it('routes monthly runs to the monthly workload and resolves source ids', async () => {
    mocks.runAiMessage.mockResolvedValue({
      output: {
        tldr: 'Birthday and welcome.',
        monthlySummary: 'This month the community celebrated a birthday and welcomed a new member.',
        items: [{ category: 'birthday', title: 'Birthday — Maria', person: 'Maria', date: null, detail: null, sourceRefs: ['m1'] }],
      },
      rawResponse: { id: 'msg_x' },
      config: { model: 'claude-sonnet-5', effort: 'low', source: 'database' },
      usage: { inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedCostUsd: 0, latencyMs: 1 },
    })

    const result = await categorizeWhatsAppFeed({ messages, monthly: true })
    expect(mocks.runAiMessage).toHaveBeenCalledTimes(1)
    expect(mocks.runAiMessage.mock.calls[0][0].workload).toBe('whatsapp_feed_monthly_summary')
    expect(result.items[0].sourceMessageIds).toEqual(['a1'])
    expect(result.monthlySummary).toContain('welcomed a new member')
    expect(result.model).toBe('claude-sonnet-5')
  })

  it('throws when the model returns a schema-invalid payload', async () => {
    mocks.runAiMessage.mockResolvedValue({
      output: { not: 'valid' },
      rawResponse: {},
      config: { model: 'claude-sonnet-5', effort: 'low', source: 'database' },
      usage: { inputTokens: 1, outputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedCostUsd: 0, latencyMs: 1 },
    })
    await expect(categorizeWhatsAppFeed({ messages })).rejects.toThrow(/schema-valid/i)
  })
})
