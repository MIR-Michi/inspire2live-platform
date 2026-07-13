import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/kernel/ai-client/client', () => ({
  runAiMessage: vi.fn(),
  wrapExternalData: (label: string, value: string) => `${label}:${value}`,
}))

import { campusWindowIso, isWithinWindow, resolveCurrentMeetingDate } from '@/lib/campus-metrics'

describe('campusWindowIso', () => {
  it('maps a dated window to ISO bounds (start inclusive, end-of-day)', () => {
    expect(campusWindowIso({ start: '2026-01-04', end: '2026-02-01' })).toEqual({
      startIso: '2026-01-04T00:00:00.000Z',
      endIso: '2026-02-01T23:59:59.999Z',
    })
  })
  it('omits the lower bound when there is no previous meeting', () => {
    expect(campusWindowIso({ start: null, end: '2026-02-01' })).toEqual({
      startIso: undefined,
      endIso: '2026-02-01T23:59:59.999Z',
    })
  })
})

describe('isWithinWindow', () => {
  const window = { start: '2026-01-04', end: '2026-02-01' }
  it('includes messages inside the window (end-of-day inclusive)', () => {
    expect(isWithinWindow('2026-01-15T12:00:00Z', window)).toBe(true)
    expect(isWithinWindow('2026-02-01T20:00:00Z', window)).toBe(true)
  })
  it('excludes messages before the start or after the meeting day', () => {
    expect(isWithinWindow('2026-01-03T23:00:00Z', window)).toBe(false)
    expect(isWithinWindow('2026-02-02T00:00:00Z', window)).toBe(false)
  })
  it('with a null start, counts everything up to the meeting day', () => {
    expect(isWithinWindow('2020-01-01T00:00:00Z', { start: null, end: '2026-02-01' })).toBe(true)
  })
  it('rejects invalid timestamps', () => {
    expect(isWithinWindow('nonsense', window)).toBe(false)
  })
})

describe('resolveCurrentMeetingDate', () => {
  const dates = ['2025-12-07', '2026-01-04', '2026-02-01', '2026-03-01']
  it('picks the earliest meeting on/after today (the upcoming one)', () => {
    expect(resolveCurrentMeetingDate(dates, new Date('2026-01-20T00:00:00Z'))).toBe('2026-02-01')
  })
  it('picks today when a meeting is today', () => {
    expect(resolveCurrentMeetingDate(dates, new Date('2026-02-01T09:00:00Z'))).toBe('2026-02-01')
  })
  it('falls back to the most recent past meeting when none is upcoming', () => {
    expect(resolveCurrentMeetingDate(dates, new Date('2026-06-01T00:00:00Z'))).toBe('2026-03-01')
  })
  it('ignores blanks/invalid and returns null when empty', () => {
    expect(resolveCurrentMeetingDate(['', null, 'bad'])).toBeNull()
    expect(resolveCurrentMeetingDate([])).toBeNull()
  })
})
