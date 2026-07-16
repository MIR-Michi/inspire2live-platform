import { describe, expect, it } from 'vitest'

import {
  CONFERENCE_REQUIREMENTS,
  deriveConferencePhase,
  deriveRequirementStatus,
  isPresenting,
  rollUpTileStatus,
  tileProgress,
  tileRequirementStatuses,
  toAttendingType,
  type RequirementContext,
  type RequirementInputs,
} from '@/modules/events/domain/conference-requirements'

const emptyInputs: RequirementInputs = {
  hasAbstract: false,
  hasDeck: false,
  delivered: false,
  hasPhotos: false,
  hasTakeaways: false,
  reportDone: false,
}

function req(key: string) {
  const found = CONFERENCE_REQUIREMENTS.find((r) => r.key === key)
  if (!found) throw new Error(`no requirement ${key}`)
  return found
}

describe('deriveConferencePhase', () => {
  const feb = (day: number) => new Date(`2026-02-${String(day).padStart(2, '0')}T12:00:00Z`)

  it('is before when today precedes the start date', () => {
    expect(deriveConferencePhase('2026-02-10', '2026-02-12', 'ongoing', feb(5))).toBe('before')
  })

  it('is during within the inclusive date window', () => {
    expect(deriveConferencePhase('2026-02-10', '2026-02-12', 'intended', feb(11))).toBe('during')
    // last day still counts
    expect(deriveConferencePhase('2026-02-10', '2026-02-12', 'intended', feb(12))).toBe('during')
  })

  it('is after once the end date has passed', () => {
    expect(deriveConferencePhase('2026-02-10', '2026-02-12', 'registered', feb(20))).toBe('after')
  })

  it('falls back to the stage when there are no dates', () => {
    expect(deriveConferencePhase(null, null, 'ongoing')).toBe('during')
    expect(deriveConferencePhase(null, null, 'follow_up')).toBe('after')
    expect(deriveConferencePhase(null, null, null)).toBe('before')
  })
})

describe('toAttendingType', () => {
  it('maps guest roles', () => {
    expect(toAttendingType({ role: 'speaker' })).toBe('presenter')
    expect(toAttendingType({ role: 'panelist' })).toBe('presenter')
    expect(toAttendingType({ role: 'organizer' })).toBe('organizer')
    expect(toAttendingType({ role: 'attendee' })).toBe('attendee')
  })

  it('maps the internal has_presentation boolean', () => {
    expect(toAttendingType({ hasPresentation: true })).toBe('presenter')
    expect(toAttendingType({ hasPresentation: false })).toBe('attendee')
    expect(toAttendingType({ hasPresentation: null })).toBe('attendee')
  })

  it('isPresenting is true for presenter and organizer', () => {
    expect(isPresenting('presenter')).toBe(true)
    expect(isPresenting('organizer')).toBe(true)
    expect(isPresenting('attendee')).toBe(false)
  })
})

describe('deriveRequirementStatus', () => {
  const ctx = (over: Partial<RequirementContext> = {}): RequirementContext => ({
    phase: 'before',
    attendingType: 'presenter',
    ...over,
  })

  it('hides presentation requirements for pure attendees', () => {
    expect(deriveRequirementStatus(req('abstract'), ctx({ attendingType: 'attendee' }), emptyInputs)).toBe('na')
    expect(deriveRequirementStatus(req('delivered'), ctx({ attendingType: 'attendee' }), emptyInputs)).toBe('na')
  })

  it('marks a missing abstract as due before the event for a presenter', () => {
    expect(deriveRequirementStatus(req('abstract'), ctx({ phase: 'before' }), emptyInputs)).toBe('due')
  })

  it('marks provided material green regardless of phase', () => {
    expect(
      deriveRequirementStatus(req('abstract'), ctx({ phase: 'before' }), { ...emptyInputs, hasAbstract: true })
    ).toBe('provided')
  })

  it('never shows photos as due before the conference', () => {
    // photos apply to everyone, but only become due "during"
    expect(deriveRequirementStatus(req('photos'), ctx({ attendingType: 'attendee', phase: 'before' }), emptyInputs)).toBe('upcoming')
    expect(deriveRequirementStatus(req('photos'), ctx({ attendingType: 'attendee', phase: 'during' }), emptyInputs)).toBe('due')
    expect(deriveRequirementStatus(req('photos'), ctx({ attendingType: 'attendee', phase: 'after' }), emptyInputs)).toBe('due')
  })

  it('report is only due after the event', () => {
    expect(deriveRequirementStatus(req('report'), ctx({ phase: 'during' }), emptyInputs)).toBe('upcoming')
    expect(deriveRequirementStatus(req('report'), ctx({ phase: 'after' }), emptyInputs)).toBe('due')
  })
})

describe('tile roll-up', () => {
  it('rolls up empty when everything is n/a', () => {
    const statuses = tileRequirementStatuses(
      'presentation',
      { phase: 'before', attendingType: 'attendee' },
      emptyInputs
    ).map((s) => s.status)
    expect(rollUpTileStatus(statuses)).toBe('empty')
  })

  it('rolls up due when any applicable item is due', () => {
    const statuses = tileRequirementStatuses(
      'onsite',
      { phase: 'during', attendingType: 'attendee' },
      emptyInputs
    ).map((s) => s.status)
    expect(rollUpTileStatus(statuses)).toBe('due')
  })

  it('rolls up provided when all applicable items are provided', () => {
    const statuses = tileRequirementStatuses(
      'onsite',
      { phase: 'during', attendingType: 'attendee' },
      { ...emptyInputs, hasPhotos: true, hasTakeaways: true }
    ).map((s) => s.status)
    expect(rollUpTileStatus(statuses)).toBe('provided')
    expect(tileProgress(statuses)).toEqual({ done: 2, total: 2 })
  })

  it('rolls up upcoming before anything is due', () => {
    const statuses = tileRequirementStatuses(
      'onsite',
      { phase: 'before', attendingType: 'attendee' },
      emptyInputs
    ).map((s) => s.status)
    expect(rollUpTileStatus(statuses)).toBe('upcoming')
  })
})
