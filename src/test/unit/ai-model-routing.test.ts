import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AI_EFFORT,
  DEFAULT_AI_MODEL,
  estimateAiCostUsd,
  getAiModelCatalogEntry,
  getAiWorkloadPolicy,
  getAiWorkloadSelection,
  getRecommendedSelection,
  isAiModelId,
  isAiReasoningEffort,
  isAiWorkloadId,
  normalizeAiEffort,
  normalizeAiModel,
  normalizeAiModelSelection,
  normalizeAiWorkloadOverrides,
  validateAiModelEffort,
  type AiModelSelection,
} from '@/lib/ai/models'

describe('AI model routing helpers', () => {
  it('normalizes model and effort selections against the catalog', () => {
    expect(isAiModelId('claude-haiku-4-5')).toBe(true)
    expect(isAiModelId('not-a-model')).toBe(false)
    expect(isAiReasoningEffort('medium')).toBe(true)
    expect(isAiReasoningEffort('extreme')).toBe(false)

    expect(normalizeAiModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    expect(normalizeAiModel('not-a-model')).toBe(DEFAULT_AI_MODEL)
    expect(normalizeAiEffort('claude-haiku-4-5', 'high')).toBe('none')
    expect(normalizeAiEffort('claude-sonnet-4-6', 'max')).toBe('max')

    expect(normalizeAiModelSelection('claude-haiku-4-5', 'high')).toEqual({
      model: 'claude-haiku-4-5',
      effort: 'none',
    })
    expect(normalizeAiModelSelection(null, null)).toEqual({ model: DEFAULT_AI_MODEL, effort: DEFAULT_AI_EFFORT })
  })

  it('validates supported model and effort pairings', () => {
    expect(getAiModelCatalogEntry('claude-opus-4-8')?.label).toBe('Claude Opus 4.8')
    expect(getAiModelCatalogEntry('missing')).toBeNull()

    expect(validateAiModelEffort('claude-sonnet-4-6', 'medium')).toEqual({ ok: true })
    expect(validateAiModelEffort('missing', 'medium')).toMatchObject({ ok: false })
    expect(validateAiModelEffort('claude-haiku-4-5', 'medium')).toMatchObject({
      ok: false,
      message: 'Claude Haiku 4.5 supports only: none',
    })
    expect(validateAiModelEffort('claude-sonnet-4-6', 'extreme')).toMatchObject({ ok: false })
  })

  it('resolves workload recommendations and saved overrides before global defaults', () => {
    const globalDefault: AiModelSelection = { model: 'claude-opus-4-8', effort: 'high' }
    const overrides = normalizeAiWorkloadOverrides({
      intake_structure: { model: 'claude-sonnet-4-6', effort: 'low' },
      org_newsfeed: { model: 'invalid-model', effort: 'max' },
      unknown_workload: { model: 'claude-haiku-4-5', effort: 'none' },
    })

    expect(isAiWorkloadId('meeting_summary')).toBe(true)
    expect(isAiWorkloadId('unknown_workload')).toBe(false)
    expect(getAiWorkloadPolicy('conference_detail')?.section).toBe('Conferences')
    expect(getAiWorkloadPolicy('unknown_workload')).toBeNull()

    expect(getAiWorkloadSelection('intake_structure', overrides, globalDefault)).toEqual({
      model: 'claude-sonnet-4-6',
      effort: 'low',
    })
    expect(getAiWorkloadSelection('meeting_summary_chunk', overrides, globalDefault)).toEqual({
      model: 'claude-sonnet-4-6',
      effort: 'medium',
    })
    expect(getAiWorkloadSelection(undefined, overrides, globalDefault)).toEqual(globalDefault)
    expect(getRecommendedSelection('lightweight_backfill')).toEqual({ model: 'claude-haiku-4-5', effort: 'none' })
  })

  it('estimates token cost using model-specific pricing and prompt caching', () => {
    expect(estimateAiCostUsd({
      model: 'claude-haiku-4-5',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
    })).toBe(7.35)

    expect(estimateAiCostUsd({ model: 'claude-sonnet-4-6', inputTokens: 500_000, outputTokens: 100_000 })).toBe(3)
  })
})
