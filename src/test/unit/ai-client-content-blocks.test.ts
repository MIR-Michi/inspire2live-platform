/**
 * S21-T04: `AiMessage.content` accepts content blocks as well as a plain
 * string, and `buildMessageRequest` forwards both shapes verbatim — no
 * existing caller changes, and an image block reaches the provider untouched.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import {
  buildMessageRequest,
  type AiConfig,
  type AiContentBlock,
  type AiMessage,
  type RunAiMessageInput,
} from '@/kernel/ai-client/client'

const config: AiConfig = {
  apiKey: 'test-key',
  model: 'claude-sonnet-5',
  effort: 'medium',
  source: 'environment',
}

describe('buildMessageRequest with both AiMessage.content shapes', () => {
  it('forwards a plain-string message unchanged (existing callers)', () => {
    const messages: AiMessage[] = [{ role: 'user', content: 'Summarize this meeting.' }]
    const request = buildMessageRequest({ feature: 'unit_test', messages }, config)
    expect(request.messages).toBe(messages)
    expect((request.messages as AiMessage[])[0].content).toBe('Summarize this meeting.')
  })

  it('forwards content blocks (text + base64 image) verbatim', () => {
    const blocks: AiContentBlock[] = [
      { type: 'text', text: 'Describe the attached screenshot.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
    ]
    const messages: AiMessage[] = [{ role: 'user', content: blocks }]
    const request = buildMessageRequest({ feature: 'unit_test', messages }, config)

    const forwarded = (request.messages as AiMessage[])[0].content
    expect(forwarded).toBe(blocks)
    expect(forwarded).toEqual([
      { type: 'text', text: 'Describe the attached screenshot.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
    ])
  })

  it('mixed shapes coexist in one request', () => {
    const input: RunAiMessageInput = {
      feature: 'unit_test',
      messages: [
        { role: 'user', content: 'First turn as a string.' },
        { role: 'assistant', content: 'Reply.' },
        { role: 'user', content: [{ type: 'text', text: 'Now with blocks.' }] },
      ],
    }
    const request = buildMessageRequest(input, config)
    expect(request.messages).toBe(input.messages)
  })
})
