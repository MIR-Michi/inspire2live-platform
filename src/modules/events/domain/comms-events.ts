export const EVENT_TYPE_OPTIONS = [
  { value: 'conference', label: 'Conference' },
  { value: 'podcast', label: 'Podcast' },
] as const

export type EventType = (typeof EVENT_TYPE_OPTIONS)[number]['value']
export type EventSetupMode = 'attendance' | 'i2l_owned' | 'podcast'

export const ATTENDANCE_KIND_OPTIONS = [
  { value: 'visitor', label: 'Visitor' },
  { value: 'presenter', label: 'Presenter' },
  { value: 'chair', label: 'Chair' },
  { value: 'organiser', label: 'Organiser' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'speaker', label: 'Speaker' },
] as const

export type AttendanceKind = (typeof ATTENDANCE_KIND_OPTIONS)[number]['value']

export const PODCAST_RECORDING_MODE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'in_person', label: 'In person' },
  { value: 'studio', label: 'Studio' },
  { value: 'hybrid', label: 'Hybrid' },
] as const

export type PodcastRecordingMode = (typeof PODCAST_RECORDING_MODE_OPTIONS)[number]['value']

export const PODCAST_DISTRIBUTION_CHANNEL_OPTIONS = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_podcasts', label: 'Apple Podcasts' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'website', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'newsletter', label: 'Newsletter' },
] as const

export type PodcastDistributionChannel = (typeof PODCAST_DISTRIBUTION_CHANNEL_OPTIONS)[number]['value']

export const PODCAST_WORKFLOW_SECTIONS = [
  {
    key: 'setup',
    title: 'Setup',
    description: 'Prepare the brief, lock guests, and make sure production logistics are ready.',
    items: [
      { field: 'podcast_brief_ready', label: 'Brief and goals agreed' },
      { field: 'podcast_guest_confirmed', label: 'Guest confirmed' },
      { field: 'podcast_release_form_ready', label: 'Release/consent handled' },
      { field: 'podcast_equipment_ready', label: 'Equipment and platform checked' },
    ],
  },
  {
    key: 'run',
    title: 'Run',
    description: 'Capture the episode cleanly and secure the raw assets immediately after recording.',
    items: [
      { field: 'podcast_recording_completed', label: 'Recording completed' },
      { field: 'podcast_backup_completed', label: 'Backup stored' },
      { field: 'podcast_edit_completed', label: 'Edit completed' },
      { field: 'podcast_transcript_completed', label: 'Transcript prepared' },
    ],
  },
  {
    key: 'follow_up',
    title: 'Follow-up',
    description: 'Package the episode, distribute it, and complete guest/community follow-up.',
    items: [
      { field: 'podcast_show_notes_completed', label: 'Show notes and metadata ready' },
      { field: 'podcast_published', label: 'Published or scheduled' },
      { field: 'podcast_followup_completed', label: 'Guest and audience follow-up done' },
    ],
  },
] as const

export type PodcastWorkflowField =
  (typeof PODCAST_WORKFLOW_SECTIONS)[number]['items'][number]['field']

const EVENT_TYPE_SET = new Set<EventType>(EVENT_TYPE_OPTIONS.map((option) => option.value))
const ATTENDANCE_KIND_SET = new Set<AttendanceKind>(
  ATTENDANCE_KIND_OPTIONS.map((option) => option.value)
)
const PODCAST_RECORDING_MODE_SET = new Set<PodcastRecordingMode>(
  PODCAST_RECORDING_MODE_OPTIONS.map((option) => option.value)
)
const PODCAST_DISTRIBUTION_CHANNEL_SET = new Set<PodcastDistributionChannel>(
  PODCAST_DISTRIBUTION_CHANNEL_OPTIONS.map((option) => option.value)
)
const PODCAST_WORKFLOW_FIELD_SET = new Set<PodcastWorkflowField>(
  PODCAST_WORKFLOW_SECTIONS.flatMap((section) => section.items.map((item) => item.field))
)

export function isEventType(value: string): value is EventType {
  return EVENT_TYPE_SET.has(value as EventType)
}

export function normalizeEventType(value: string) {
  return isEventType(value) ? value : 'conference'
}

export function isAttendanceKind(value: string): value is AttendanceKind {
  return ATTENDANCE_KIND_SET.has(value as AttendanceKind)
}

export function normalizeAttendanceKind(value: string) {
  return isAttendanceKind(value) ? value : 'visitor'
}

export function isPodcastEventType(value: string | null | undefined) {
  return value === 'podcast'
}

export function isI2LOwnedEvent(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return Boolean(input.isI2lOrganised || isPodcastEventType(input.eventType))
}

export function normalizeI2LOwnedFlag(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return isI2LOwnedEvent(input)
}

export function getEventSetupMode(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}): EventSetupMode {
  if (isPodcastEventType(input.eventType)) return 'podcast'
  if (isI2LOwnedEvent(input)) return 'i2l_owned'
  return 'attendance'
}

export function supportsAttendanceSetup(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return getEventSetupMode(input) === 'attendance'
}

export function supportsInternalParticipantSelection(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return supportsAttendanceSetup(input)
}

export function requiresOwnerAssignment(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return getEventSetupMode(input) !== 'attendance'
}

export function getDefaultAttendanceKind(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  return supportsAttendanceSetup(input) ? 'visitor' : 'organiser'
}

export function getEventSetupContent(input: {
  eventType: string | null | undefined
  isI2lOrganised?: boolean | null | undefined
  isAnnualCongress?: boolean | null | undefined
}) {
  const mode = getEventSetupMode(input)

  if (mode === 'podcast') {
    return {
      mode,
      typeHint:
        'Podcast setup is treated as an I2L-owned production workflow with one responsible owner.',
      ownerLabel: 'Responsible owner',
      ownerHelp: 'Assign the person accountable for planning, recording, publishing, and follow-up.',
      organiserLabel: 'Publishing channel / production partner',
      organiserPlaceholder: 'Example: Inspire2Live, studio partner, or distribution partner',
      websiteLabel: 'Episode landing page',
      websitePlaceholder: 'https://example.org/podcast-episode',
      imageLabel: 'Cover art / guest image link',
      imagePlaceholder: 'Example: episode artwork, guest photo, or SharePoint image URL',
      summaryLabel: 'Episode summary / editorial angle',
      summaryPlaceholder:
        'Capture the episode angle, hook, target audience, and key talking points.',
      assetLabel: 'Brief / script / asset link',
      assetPlaceholder:
        'Example: recording brief, script, or shared production folder',
      attendeeLegend: null,
      attendeeChipPrefix: null,
      attendeeEmptyLabel: null,
      attendanceKindLabel: null,
      showPodcastWorkflow: true,
    }
  }

  if (mode === 'i2l_owned') {
    return {
      mode,
      typeHint:
        'I2L-owned conferences use accountable ownership instead of attendee tracking.',
      ownerLabel: 'Responsible owner',
      ownerHelp: 'Assign the person responsible for delivery, coordination, and follow-up.',
      organiserLabel: 'Lead organiser / hosting team',
      organiserPlaceholder: 'Example: Inspire2Live events team',
      websiteLabel: 'Conference website',
      websitePlaceholder: 'https://example.org/conference',
      imageLabel: 'Conference image link',
      imagePlaceholder: 'Example: invitation image, agenda visual, or SharePoint image URL',
      summaryLabel: 'Conference brief / production summary',
      summaryPlaceholder:
        'Capture the purpose, audience, runbook highlights, and communication angle.',
      assetLabel: 'Runbook / deck / support asset',
      assetPlaceholder: 'Example: runbook, deck, or internal planning folder',
      attendeeLegend: null,
      attendeeChipPrefix: null,
      attendeeEmptyLabel: null,
      attendanceKindLabel: null,
      showPodcastWorkflow: false,
    }
  }

  return {
    mode,
    typeHint:
      'External conferences track how I2L participates and who attends from the team.',
    ownerLabel: null,
    ownerHelp: null,
    organiserLabel: 'External organiser',
    organiserPlaceholder: 'Example: conference host or partner organisation',
    websiteLabel: 'Conference website',
    websitePlaceholder: 'https://example.org/conference',
    imageLabel: 'Picture upload / image link',
    imagePlaceholder: 'Example: conference photo, invitation image, or SharePoint image URL',
    summaryLabel: 'Presentation summary',
    summaryPlaceholder: 'Required when attending as presenter.',
    assetLabel: 'Presentation / slide link',
    assetPlaceholder: 'Example: deck, PDF, or SharePoint presentation URL',
    attendeeLegend: 'I2L attendees',
    attendeeChipPrefix: 'Attending',
    attendeeEmptyLabel: 'I2L attendee: Unassigned',
    attendanceKindLabel: 'Kind of attending',
    showPodcastWorkflow: false,
  }
}

export function isPodcastRecordingMode(value: string): value is PodcastRecordingMode {
  return PODCAST_RECORDING_MODE_SET.has(value as PodcastRecordingMode)
}

export function normalizePodcastRecordingMode(value: string) {
  return isPodcastRecordingMode(value) ? value : 'remote'
}

export function isPodcastDistributionChannel(value: string): value is PodcastDistributionChannel {
  return PODCAST_DISTRIBUTION_CHANNEL_SET.has(value as PodcastDistributionChannel)
}

export function isPodcastWorkflowField(value: string): value is PodcastWorkflowField {
  return PODCAST_WORKFLOW_FIELD_SET.has(value as PodcastWorkflowField)
}

export function parseDelimitedList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export function formatDelimitedList(values: string[] | null | undefined) {
  return (values ?? []).join(', ')
}

export function parsePodcastDistributionChannels(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(isPodcastDistributionChannel))
  )
}

export function formatTokenLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getEventTypeLabel(value: string) {
  return EVENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? formatTokenLabel(value)
}

export function getPodcastWorkflowProgress(
  source: Partial<Record<PodcastWorkflowField, boolean | null | undefined>>
) {
  const total = PODCAST_WORKFLOW_SECTIONS.reduce((count, section) => count + section.items.length, 0)
  const completed = PODCAST_WORKFLOW_SECTIONS.reduce(
    (count, section) =>
      count + section.items.filter((item) => Boolean(source[item.field])).length,
    0
  )

  return { completed, total }
}
