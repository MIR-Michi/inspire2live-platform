import { describe, expect, it } from 'vitest'

import {
  matchOwner,
  parseDueDate,
  proposeFollowUpTasks,
  type CommsTeamMember,
} from '@/lib/ai/follow-up-tasks'
import type { MeetingActionItem } from '@/lib/ai/meeting-summary'

const members: CommsTeamMember[] = [
  { id: 'u1', label: 'Jane Doe', email: 'jane.doe@inspire2live.org', role: 'Comms' },
  { id: 'u2', label: 'Peter Kapitein', email: 'peter@inspire2live.org', role: 'Comms' },
  { id: 'u3', label: 'John Smith', email: 'john.smith@inspire2live.org', role: 'PlatformAdmin' },
]

describe('matchOwner', () => {
  it('matches on exact full name', () => {
    expect(matchOwner('Jane Doe', members)).toMatchObject({ id: 'u1', match: 'matched' })
  })

  it('matches case- and accent-insensitively', () => {
    expect(matchOwner('PETER kapitein', members)).toMatchObject({ id: 'u2', match: 'matched' })
  })

  it('matches on email local part', () => {
    expect(matchOwner('john.smith', members)).toMatchObject({ id: 'u3', match: 'matched' })
  })

  it('matches on a unique first name', () => {
    expect(matchOwner('Jane', members)).toMatchObject({ id: 'u1', match: 'matched' })
  })

  it('returns unmatched for an unknown owner but preserves the raw label', () => {
    expect(matchOwner('Some External Person', members)).toEqual({
      id: null,
      label: 'Some External Person',
      match: 'unmatched',
    })
  })

  it('returns unmatched for empty input', () => {
    expect(matchOwner('', members)).toEqual({ id: null, label: null, match: 'unmatched' })
    expect(matchOwner(null, members)).toEqual({ id: null, label: null, match: 'unmatched' })
  })
})

describe('parseDueDate', () => {
  it('extracts an ISO date', () => {
    expect(parseDueDate('2026-07-01')).toBe('2026-07-01')
    expect(parseDueDate('by 2026-12-31 latest')).toBe('2026-12-31')
  })

  it('returns null for natural-language hints and invalid dates', () => {
    expect(parseDueDate('end of next week')).toBeNull()
    expect(parseDueDate('2026-13-40')).toBeNull()
    expect(parseDueDate(null)).toBeNull()
  })
})

describe('proposeFollowUpTasks', () => {
  const actionItems: MeetingActionItem[] = [
    { title: 'Draft the newsletter blurb', owner: 'Jane', dueDate: '2026-07-01', notes: 'Use the publication blurb' },
    { title: 'Book the recording studio', owner: 'External AV vendor', dueDate: 'next Friday', notes: null },
    { title: 'Draft the newsletter blurb', owner: 'Jane Doe', dueDate: null, notes: null }, // duplicate title
    { title: '', owner: 'Peter Kapitein', dueDate: null, notes: null }, // empty title dropped
  ]

  it('maps action items to proposals with owner matching and date parsing', () => {
    const proposals = proposeFollowUpTasks({ actionItems, members })
    expect(proposals).toHaveLength(2) // duplicate + empty dropped

    expect(proposals[0]).toMatchObject({
      title: 'Draft the newsletter blurb',
      proposedOwnerId: 'u1',
      ownerMatch: 'matched',
      dueDate: '2026-07-01',
      description: 'Use the publication blurb',
    })

    expect(proposals[1]).toMatchObject({
      title: 'Book the recording studio',
      proposedOwnerId: null,
      ownerMatch: 'unmatched',
      proposedOwnerLabel: 'External AV vendor',
      dueDate: null,
      rawDue: 'next Friday',
    })
  })

  it('returns an empty array when there are no usable action items', () => {
    expect(proposeFollowUpTasks({ actionItems: [], members })).toEqual([])
    expect(proposeFollowUpTasks({ actionItems: [{ title: '   ', owner: null, dueDate: null, notes: null }], members })).toEqual([])
  })
})
