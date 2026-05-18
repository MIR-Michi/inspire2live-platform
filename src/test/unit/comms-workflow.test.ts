import { describe, expect, it } from 'vitest'
import {
  assertCalendarTransition,
  canTransitionCalendarStatus,
  getSuggestedDestination,
  type IntakeContentType,
} from '@/lib/comms-workflow'

describe('communications routing logic', () => {
  const expectations: Array<{ type: IntakeContentType; destination: string | null }> = [
    { type: 'event_report', destination: 'calendar' },
    { type: 'article_share', destination: 'calendar' },
    { type: 'member_intro', destination: 'campus_member' },
    { type: 'initiative_update', destination: 'event' },
    { type: 'media_request', destination: 'media_asset' },
    { type: 'noise', destination: null },
  ]

  for (const entry of expectations) {
    it(`routes ${entry.type} to ${entry.destination ?? 'archive'}`, () => {
      expect(getSuggestedDestination(entry.type)).toBe(entry.destination)
    })
  }
})

describe('calendar status transition state machine', () => {
  it('allows the forward publishing path', () => {
    expect(canTransitionCalendarStatus('draft', 'in_review')).toBe(true)
    expect(canTransitionCalendarStatus('in_review', 'scheduled')).toBe(true)
    expect(canTransitionCalendarStatus('scheduled', 'published')).toBe(true)
    expect(canTransitionCalendarStatus('published', 'archived')).toBe(true)
  })

  it('blocks invalid jumps', () => {
    expect(canTransitionCalendarStatus('draft', 'published')).toBe(false)
    expect(canTransitionCalendarStatus('published', 'draft')).toBe(false)
    expect(() => assertCalendarTransition('draft', 'published')).toThrow(/Invalid calendar status transition/)
  })
})
