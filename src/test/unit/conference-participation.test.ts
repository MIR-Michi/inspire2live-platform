import { describe, expect, it } from 'vitest'
import {
  buildConferenceParticipants,
  buildConferencePhotos,
  conferenceRoleLabel,
} from '@/modules/events/domain/conference-participation'

describe('conference participation', () => {
  it('shows pending guest responses as intended attendees', () => {
    const participants = buildConferenceParticipants([], [
      {
        id: 'guest-1',
        submitterName: 'Michael Wittinger',
        submitterEmail: 'Michael@example.org',
        role: 'speaker',
        isRegistered: false,
        status: 'pending',
        files: [],
      },
    ])

    expect(participants).toEqual([
      expect.objectContaining({
        name: 'Michael Wittinger',
        email: 'michael@example.org',
        roleLabel: 'Presenter',
        attendanceLabel: 'Intends to attend',
        source: 'guest',
      }),
    ])
  })

  it('merges a guest response with an existing team assignment by email', () => {
    const participants = buildConferenceParticipants(
      [{ id: 'contact-1', fullName: 'Michael Wittinger', email: 'michael@example.org', role: 'attendee' }],
      [{
        id: 'guest-1',
        submitterName: 'Michael Wittinger',
        submitterEmail: 'MICHAEL@example.org',
        role: 'panelist',
        isRegistered: true,
        status: 'approved',
        files: [],
      }]
    )

    expect(participants).toHaveLength(1)
    expect(participants[0]).toMatchObject({
      roleLabel: 'Presenter',
      attendanceLabel: 'Registered',
      source: 'team_and_guest',
    })
  })

  it('omits rejected attendance reports', () => {
    const participants = buildConferenceParticipants([], [
      {
        id: 'guest-1',
        submitterName: 'Rejected Guest',
        submitterEmail: 'rejected@example.org',
        role: 'attendee',
        isRegistered: true,
        status: 'rejected',
        files: [],
      },
    ])

    expect(participants).toEqual([])
  })

  it('deduplicates a guest upload mirrored into team photo links', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/congress-guest-uploads/photo.jpg'
    const photos = buildConferencePhotos([url], [
      {
        id: 'guest-1',
        submitterName: 'Guest',
        submitterEmail: 'guest@example.org',
        role: 'attendee',
        isRegistered: true,
        status: 'pending',
        files: [{ id: 'file-1', fileType: 'photo', fileName: 'event.jpg', publicUrl: url }],
      },
    ])

    expect(photos).toEqual([
      expect.objectContaining({
        url,
        fileName: 'event.jpg',
        author: 'Guest',
        source: 'guest',
        downloadable: true,
      }),
    ])
  })

  it('normalizes conference roles for display', () => {
    expect(conferenceRoleLabel('speaker')).toBe('Presenter')
    expect(conferenceRoleLabel('panelist')).toBe('Presenter')
    expect(conferenceRoleLabel('organizer')).toBe('Organizer')
    expect(conferenceRoleLabel('unknown')).toBe('Attendee')
  })
})
