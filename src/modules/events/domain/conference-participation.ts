export type AssignedContactInput = {
  id: string
  fullName: string
  email: string | null
  role: string
}

export type GuestReportInput = {
  id: string
  submitterName: string
  submitterEmail: string | null
  role: string
  isRegistered: boolean
  status: 'pending' | 'approved' | 'rejected'
  files: Array<{
    id: string
    fileType: 'photo' | 'presentation' | 'document'
    fileName: string
    publicUrl: string | null
  }>
}

export type ConferenceParticipant = {
  key: string
  name: string
  email: string | null
  roleLabel: string
  attendanceLabel: 'Assigned by team' | 'Intends to attend' | 'Registered'
  source: 'team' | 'guest' | 'team_and_guest'
}

export type ConferencePhoto = {
  key: string
  url: string
  fileName: string
  author: string | null
  source: 'team' | 'guest'
  downloadable: boolean
}

function clean(value: string | null | undefined): string | null {
  const result = value?.trim()
  return result || null
}

function normalizedEmail(value: string | null | undefined): string | null {
  return clean(value)?.toLowerCase() ?? null
}

function normalizedName(value: string | null | undefined): string {
  return clean(value)?.toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function personKey(email: string | null | undefined, name: string | null | undefined, fallback: string): string {
  const normalized = normalizedEmail(email)
  if (normalized) return `email:${normalized}`
  const nameKey = normalizedName(name)
  return nameKey ? `name:${nameKey}` : fallback
}

export function conferenceRoleLabel(value: string | null | undefined): string {
  switch (clean(value)?.toLowerCase()) {
    case 'speaker':
    case 'panelist':
    case 'presenter':
      return 'Presenter'
    case 'organizer':
      return 'Organizer'
    case 'other':
      return 'Other'
    default:
      return 'Attendee'
  }
}

/**
 * Merge team assignments with guest attendance responses into one conference
 * roster. A guest response is visible immediately, even while its report is
 * pending review; rejected responses are omitted.
 */
export function buildConferenceParticipants(
  assignedContacts: AssignedContactInput[],
  guestReports: GuestReportInput[]
): ConferenceParticipant[] {
  const participants = new Map<string, ConferenceParticipant>()

  for (const contact of assignedContacts) {
    const key = personKey(contact.email, contact.fullName, `assigned:${contact.id}`)
    participants.set(key, {
      key,
      name: clean(contact.fullName) ?? 'Unnamed attendee',
      email: normalizedEmail(contact.email),
      roleLabel: conferenceRoleLabel(contact.role),
      attendanceLabel: 'Assigned by team',
      source: 'team',
    })
  }

  for (const report of guestReports) {
    if (report.status === 'rejected') continue
    const key = personKey(report.submitterEmail, report.submitterName, `guest:${report.id}`)
    const existing = participants.get(key)
    const attendanceLabel = report.isRegistered ? 'Registered' : 'Intends to attend'

    participants.set(key, {
      key,
      name: clean(report.submitterName) ?? existing?.name ?? 'Guest attendee',
      email: normalizedEmail(report.submitterEmail) ?? existing?.email ?? null,
      roleLabel: conferenceRoleLabel(report.role),
      attendanceLabel:
        existing?.attendanceLabel === 'Registered' || attendanceLabel === 'Registered'
          ? 'Registered'
          : attendanceLabel,
      source: existing ? 'team_and_guest' : 'guest',
    })
  }

  return [...participants.values()].sort((a, b) => {
    const rank = (person: ConferenceParticipant) => person.attendanceLabel === 'Registered' ? 0 : person.attendanceLabel === 'Intends to attend' ? 1 : 2
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  })
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').filter(Boolean).at(-1)
    return segment ? decodeURIComponent(segment) : 'conference-photo'
  } catch {
    return 'conference-photo'
  }
}

/** Guest uploads take precedence over their mirrored conference_prep URL. */
export function buildConferencePhotos(
  teamPhotoUrls: string[],
  guestReports: GuestReportInput[]
): ConferencePhoto[] {
  const photos = new Map<string, ConferencePhoto>()

  for (const report of guestReports) {
    if (report.status === 'rejected') continue
    for (const file of report.files) {
      const url = clean(file.publicUrl)
      if (file.fileType !== 'photo' || !url) continue
      photos.set(url, {
        key: file.id || url,
        url,
        fileName: clean(file.fileName) ?? fileNameFromUrl(url),
        author: clean(report.submitterName),
        source: 'guest',
        downloadable: true,
      })
    }
  }

  for (const rawUrl of teamPhotoUrls) {
    const url = clean(rawUrl)
    if (!url || photos.has(url)) continue
    photos.set(url, {
      key: url,
      url,
      fileName: fileNameFromUrl(url),
      author: null,
      source: 'team',
      downloadable: false,
    })
  }

  return [...photos.values()]
}
