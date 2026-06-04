import { describe, expect, it } from 'vitest'
import {
  buildEventDraftFromIntake,
  findDuplicateEventMatch,
  getPeterAwareClassificationConfidence,
  isPeterKapiteinSignal,
  memberAppearsInCalendar,
  memberMatchesSignal,
  mergeCampusMemberUpdate,
  parseCampusMemberDraft,
} from '@/lib/comms-routing'

describe('Peter Kapitein signal layer', () => {
  it('detects Peter signals from the sender name only', () => {
    expect(isPeterKapiteinSignal('Peter Kapitein')).toBe(true)
    expect(isPeterKapiteinSignal('peter kapitein')).toBe(true)
    expect(isPeterKapiteinSignal('Peter Lindqvist')).toBe(false)
  })

  it('elevates classification confidence for Peter items', () => {
    expect(getPeterAwareClassificationConfidence('Peter Kapitein')).toBe('high')
    expect(getPeterAwareClassificationConfidence('Stephen Rowley')).toBe('medium')
  })
})

describe('campus member parsing', () => {
  it('parses welcome messages from Peter into a member draft', () => {
    expect(
      parseCampusMemberDraft({
        sender_name: 'Peter Kapitein',
        raw_content:
          'A warm welcome to Michael from Austria. Michael joins our World Campus network with a strong background in patient advocacy and cross-border policy work.',
        captured_at: '2026-05-10T08:00:00Z',
        is_peter_kapitein: true,
      })
    ).toMatchObject({
      name: 'Michael',
      country: 'Austria',
      welcomedByPeter: true,
    })
  })

  it('falls back to the sender for self-introduction messages', () => {
    expect(
      parseCampusMemberDraft({
        sender_name: 'Michael Hofer',
        raw_content:
          'Thank you Peter and everyone for the warm welcome. I am Michael Hofer from Austria and look forward to supporting advocacy and policy efforts.',
        captured_at: '2026-05-11T10:00:00Z',
        is_peter_kapitein: false,
      })
    ).toMatchObject({
      name: 'Michael Hofer',
      country: 'Austria',
      welcomedByPeter: false,
    })
  })
})

describe('campus member safety helpers', () => {
  it('preserves existing member fields when parsed values are empty', () => {
    expect(
      mergeCampusMemberUpdate(
        {
          country: 'Austria',
          organisation: 'Regional policy alliance',
          role_description: 'Advocacy collaborator',
          notes: 'Existing member note',
          welcomed_by_peter: false,
          date_welcomed: '2026-05-01',
          last_channel_activity: '2026-05-10T10:00:00Z',
          initiative_affiliations: ['initiative-1'],
        },
        {
          name: 'Michael Hofer',
          country: '',
          organisation: '',
          roleDescription: '',
          welcomedByPeter: true,
        },
        {
          raw_content: 'Fresh routed intake note',
          captured_at: '2026-05-12T12:00:00Z',
        },
        'initiative-2'
      )
    ).toMatchObject({
      country: 'Austria',
      organisation: 'Regional policy alliance',
      role_description: 'Advocacy collaborator',
      welcomed_by_peter: true,
      date_welcomed: '2026-05-01',
      last_channel_activity: '2026-05-12T12:00:00Z',
      initiative_affiliations: ['initiative-1', 'initiative-2'],
    })
  })

  it('prefers explicit campus-member routing and avoids weak single-name matches', () => {
    expect(
      memberMatchesSignal(
        { id: 'member-1', name: 'Michael' },
        {
          sender_name: 'Peter Kapitein',
          raw_content: 'A warm welcome to Michael from Austria.',
        }
      )
    ).toBe(false)

    expect(
      memberMatchesSignal(
        { id: 'member-1', name: 'Michael' },
        {
          sender_name: 'Peter Kapitein',
          raw_content: 'A warm welcome to Michael from Austria.',
          routed_to_type: 'campus_member',
          routed_to_id: 'member-1',
        }
      )
    ).toBe(true)
  })

  it('uses intake links before text heuristics for calendar appearances', () => {
    expect(
      memberAppearsInCalendar(
        { id: 'member-1', name: 'Michael' },
        {
          title: 'Welcome Michael from Austria to World Campus',
          body_draft: 'Draft spotlight copy',
          tags: ['member-spotlight'],
          source_intake_id: 'intake-1',
        },
        new Set(['intake-1'])
      )
    ).toBe(true)

    expect(
      memberAppearsInCalendar(
        { id: 'member-1', name: 'Michael' },
        {
          title: 'Welcome Michael from Austria to World Campus',
          body_draft: 'Draft spotlight copy',
          tags: ['member-spotlight'],
          source_intake_id: null,
        },
        new Set<string>()
      )
    ).toBe(false)
  })
})

describe('event routing duplicate detection', () => {
  it('builds an event draft from a routed intake item', () => {
    expect(
      buildEventDraftFromIntake({
        sender_name: 'Stephen Rowley',
        raw_content:
          'GUIDE.MRD General Assembly photos and a short caption from the Amsterdam meeting. Strong visual material for a fast LinkedIn recap.',
        captured_at: '2026-05-01T09:00:00Z',
      })
    ).toMatchObject({
      name: 'GUIDE.MRD General Assembly',
      startDate: '2026-05-01',
      locationCity: 'Amsterdam',
    })
  })

  it('detects podcast production signals as podcast events', () => {
    expect(
      buildEventDraftFromIntake({
        sender_name: 'Comms Producer',
        raw_content:
          'Inspire2Live Podcast Episode recording session with Dr. Elena Rossi will happen next week. Please prepare the guest brief and studio link.',
        captured_at: '2026-05-14T09:00:00Z',
      })
    ).toMatchObject({
      name: 'Inspire2Live Podcast Episode',
      eventType: 'podcast',
      startDate: '2026-05-14',
    })
  })

  it('matches existing events by name and nearby date', () => {
    const match = findDuplicateEventMatch(
      {
        name: 'GUIDE.MRD General Assembly',
        startDate: '2026-05-01',
      },
      [
        {
          id: 'event-1',
          name: 'GUIDE.MRD General Assembly',
          start_date: '2026-04-28',
        },
        {
          id: 'event-2',
          name: 'Annual Congress 2026',
          start_date: '2026-06-01',
        },
      ]
    )

    expect(match?.id).toBe('event-1')
  })
})
