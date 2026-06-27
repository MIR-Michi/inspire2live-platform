import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { buildMessageRequest, type AiConfig, type RunAiMessageInput } from '@/lib/ai/client'

const baseInput: RunAiMessageInput = {
  feature: 'unit_test',
  messages: [{ role: 'user', content: 'Summarize this meeting.' }],
  maxTokens: 512,
}

function config(effort: AiConfig['effort']): AiConfig {
  return {
    apiKey: 'test-key',
    model: effort === 'none' ? 'claude-haiku-4-5' : 'claude-sonnet-4-6',
    effort,
    source: 'environment',
  }
}

describe('buildMessageRequest', () => {
  it('normalizes explicit temperature when Anthropic thinking is enabled', () => {
    const request = buildMessageRequest({ ...baseInput, temperature: 0 }, config('low'))

    expect(request.temperature).toBe(1)
    expect(request.thinking).toEqual({ type: 'adaptive' })
    expect(request.output_config).toMatchObject({ effort: 'low' })
  })

  it('preserves explicit temperature when thinking is disabled', () => {
    const request = buildMessageRequest({ ...baseInput, temperature: 0 }, config('none'))

    expect(request.temperature).toBe(0)
    expect(request).not.toHaveProperty('thinking')
    expect(request).not.toHaveProperty('output_config')
  })

  it('does not add temperature to thinking requests unless the caller set one', () => {
    const request = buildMessageRequest(baseInput, config('high'))

    expect(request).not.toHaveProperty('temperature')
    expect(request.thinking).toEqual({ type: 'adaptive' })
    expect(request.output_config).toMatchObject({ effort: 'high' })
  })
})
