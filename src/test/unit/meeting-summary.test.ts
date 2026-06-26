import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/client', () => ({
  runAiMessage: vi.fn(),
  wrapExternalData: (label: string, value: string) => [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n'),
}))

import {
  chunkTranscript,
  detectSpeakers,
  validateMeetingSummary,
  MAX_CHUNK_CHARS,
} from '@/lib/ai/meeting-summary'

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
