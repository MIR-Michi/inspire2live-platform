import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  runAiMessage: vi.fn(),
}))

vi.mock('@/lib/ai/client', () => ({
  runAiMessage: mocks.runAiMessage,
  wrapExternalData: (label: string, value: string) => [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n'),
}))

import {
  chunkTranscript,
  detectSpeakers,
  validateMeetingSummary,
  summarizeMeeting,
  MAX_CHUNK_CHARS,
} from '@/lib/ai/meeting-summary'

const validSummary = {
  tldr: 'Campus meeting summary.',
  decisions: [{ decision: 'Publish the campus update.', owner: 'Alice', context: null }],
  actionItems: [{ title: 'Prepare follow-up tasks', owner: 'Bob', dueDate: null, notes: null }],
  publicationBlurb: 'Inspire2Live World Campus discussed progress and next steps.',
  speakers: ['Alice', 'Bob'],
}

beforeEach(() => {
  mocks.runAiMessage.mockReset()
  mocks.runAiMessage.mockResolvedValue({
    output: validSummary,
    rawResponse: { id: 'msg_test' },
    config: { model: 'claude-sonnet-4-6', effort: 'low', source: 'database' },
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      estimatedCostUsd: 0.001,
      latencyMs: 25,
    },
  })
})

describe('detectSpeakers', () => {
  it('collects unique Name: prefixed speakers in order', () => {
    const transcript = ['Alice Smith: Welcome', 'Bob: Thanks', 'Alice Smith: Lets begin', 'Dr. Lee: Agreed'].join('\n')
    expect(detectSpeakers(transcript)).toEqual(['Alice Smith', 'Bob', 'Dr. Lee'])
  })

  it('ignores lines without a speaker label', () => {
    expect(detectSpeakers('just some narrative text\nwith no speakers')).toEqual([])
  })
})

describe('chunkTranscript', () => {
  it('returns a single chunk when under the limit', () => {
    expect(chunkTranscript('short transcript')).toEqual(['short transcript'])
  })

  it('splits long transcripts on line boundaries within the budget', () => {
    const line = 'Speaker: ' + 'x'.repeat(200)
    const transcript = Array.from({ length: 2000 }, () => line).join('\n')
    const chunks = chunkTranscript(transcript, 5000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(5000)
    // No content lost.
    expect(chunks.join('\n').replace(/\n+/g, '\n')).toContain(line)
  })

  it('hard-splits a single oversized line', () => {
    const giant = 'y'.repeat(MAX_CHUNK_CHARS + 500)
    const chunks = chunkTranscript(giant, 1000)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= 1000)).toBe(true)
  })
})

describe('validateMeetingSummary', () => {
  it('accepts and normalizes a valid summary', () => {
    const result = validateMeetingSummary({
      tldr: 'The team aligned on the Q3 campaign.',
      decisions: [
        { decision: 'Ship the newsletter Friday', owner: 'Alice', context: 'pending final copy' },
        { decision: '', owner: 'Bob' }, // dropped — empty decision
      ],
      actionItems: [
        { title: 'Draft the blurb', owner: 'Bob', dueDate: '2026-07-01', notes: null },
        { owner: 'Carol' }, // dropped — no title
      ],
      publicationBlurb: 'Inspire2Live aligned on its Q3 outreach this week.',
      speakers: ['Alice', 'Bob'],
    })

    expect(result).not.toBeNull()
    expect(result?.decisions).toHaveLength(1)
    expect(result?.actionItems).toHaveLength(1)
    expect(result?.actionItems[0]).toMatchObject({ title: 'Draft the blurb', owner: 'Bob', dueDate: '2026-07-01' })
    expect(result?.speakers).toEqual(['Alice', 'Bob'])
  })

  it('rejects a summary without a TL;DR', () => {
    expect(
      validateMeetingSummary({ tldr: '', decisions: [], actionItems: [], publicationBlurb: 'x', speakers: [] })
    ).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(validateMeetingSummary('nope')).toBeNull()
    expect(validateMeetingSummary(null)).toBeNull()
  })

  it('coerces missing arrays to empty', () => {
    const result = validateMeetingSummary({ tldr: 'Short meeting.', publicationBlurb: 'Blurb.' })
    expect(result).toMatchObject({ decisions: [], actionItems: [], speakers: [] })
  })
})

describe('summarizeMeeting', () => {
  it('defers model and effort to configured AI settings by default', async () => {
    await summarizeMeeting({
      title: 'World Campus',
      transcript: 'Alice: We should publish the campus update.\nBob: I will prepare follow-up tasks.',
    })

    expect(mocks.runAiMessage).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'meeting_summary',
      model: undefined,
      effort: undefined,
      temperature: 0,
    }))
  })

  it('passes explicit model and effort overrides when provided', async () => {
    await summarizeMeeting({
      title: 'World Campus',
      transcript: 'Alice: We should publish the campus update.\nBob: I will prepare follow-up tasks.',
      model: 'claude-haiku-4-5',
      effort: 'none',
    })

    expect(mocks.runAiMessage).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5',
      effort: 'none',
    }))
  })
})
