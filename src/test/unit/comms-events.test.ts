import { describe, expect, it } from 'vitest'
import {
  EVENT_TYPE_OPTIONS,
  getDefaultAttendanceKind,
  getEventSetupContent,
  isI2LOwnedEvent,
  normalizeEventType,
  requiresOwnerAssignment,
  supportsAttendanceSetup,
} from '@/lib/comms-events'

describe('communications event setup rules', () => {
  it('only exposes conferences and podcasts as event types', () => {
    expect(EVENT_TYPE_OPTIONS.map((option) => option.value)).toEqual(['conference', 'podcast'])
    expect(normalizeEventType('conference')).toBe('conference')
    expect(normalizeEventType('podcast')).toBe('podcast')
    expect(normalizeEventType('workshop')).toBe('conference')
    expect(normalizeEventType('congress')).toBe('conference')
  })

  it('treats podcasts as I2L-owned events with a required owner', () => {
    expect(
      isI2LOwnedEvent({
        eventType: 'podcast',
        isI2lOrganised: false,
      })
    ).toBe(true)
    expect(
      requiresOwnerAssignment({
        eventType: 'podcast',
        isI2lOrganised: false,
      })
    ).toBe(true)
    expect(
      supportsAttendanceSetup({
        eventType: 'podcast',
        isI2lOrganised: false,
      })
    ).toBe(false)
  })

  it('keeps external conference attendance separate from owned-event ownership', () => {
    expect(
      requiresOwnerAssignment({
        eventType: 'conference',
        isI2lOrganised: false,
      })
    ).toBe(false)
    expect(
      supportsAttendanceSetup({
        eventType: 'conference',
        isI2lOrganised: false,
      })
    ).toBe(true)
    expect(
      getDefaultAttendanceKind({
        eventType: 'conference',
        isI2lOrganised: false,
      })
    ).toBe('visitor')
  })

  it('uses owner-focused wording for I2L-owned conference setups', () => {
    const setup = getEventSetupContent({
      eventType: 'conference',
      isI2lOrganised: true,
    })

    expect(setup.ownerLabel).toBe('Responsible owner')
    expect(setup.attendeeLegend).toBeNull()
    expect(setup.organiserLabel).toBe('Lead organiser / hosting team')
  })
})
