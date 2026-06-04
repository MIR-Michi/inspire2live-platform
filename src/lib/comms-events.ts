export const EVENT_TYPE_OPTIONS = [
  { value: 'conference', label: 'Conference' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'congress', label: 'Congress' },
  { value: 'symposium', label: 'Symposium' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'other', label: 'Other' },
] as const

export type EventType = (typeof EVENT_TYPE_OPTIONS)[number]['value']

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
