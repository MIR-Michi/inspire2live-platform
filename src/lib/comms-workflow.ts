import type { Database } from '@/types/database'

type IntakeRow = Database['public']['Tables']['intake_items']['Row']
type CalendarRow = Database['public']['Tables']['content_calendar']['Row']

export type IntakeContentType =
  | 'event_report'
  | 'article_share'
  | 'member_intro'
  | 'initiative_update'
  | 'media_request'
  | 'noise'

export type IntakeFilter =
  | 'all'
  | 'events'
  | 'articles'
  | 'members'
  | 'initiative_updates'
  | 'media_requests'
  | 'peter_messages'
  | 'dismissed'

export type RouteDestination = 'calendar' | 'event' | 'campus_member' | 'media_asset'

export type CalendarChannel = 'linkedin' | 'newsletter' | 'wordpress' | 'podcast' | 'youtube'

export type CalendarStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'

export type EventStage = 'announced' | 'attending' | 'in_progress' | 'post_event' | 'archived'

export const INTAKE_FILTERS: Array<{ key: IntakeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'articles', label: 'Articles' },
  { key: 'members', label: 'Members' },
  { key: 'initiative_updates', label: 'Initiative Updates' },
  { key: 'media_requests', label: 'Media Requests' },
  { key: 'peter_messages', label: "Peter's messages" },
  { key: 'dismissed', label: 'Dismissed' },
]

export const CONTENT_TYPE_META: Record<
  IntakeContentType,
  { label: string; shortLabel: string; tone: 'blue' | 'amber' | 'green' | 'violet' | 'red' | 'neutral' }
> = {
  event_report: { label: 'Event Report', shortLabel: 'Event', tone: 'blue' },
  article_share: { label: 'Article Share', shortLabel: 'Article', tone: 'amber' },
  member_intro: { label: 'Member Introduction', shortLabel: 'Member', tone: 'green' },
  initiative_update: { label: 'Initiative Update', shortLabel: 'Initiative', tone: 'violet' },
  media_request: { label: 'Media Request', shortLabel: 'Media', tone: 'red' },
  noise: { label: 'Miscellaneous', shortLabel: 'Misc', tone: 'neutral' },
}

export const ROUTE_DESTINATION_META: Record<
  RouteDestination,
  { label: string; description: string }
> = {
  calendar: {
    label: 'Content Calendar',
    description: 'Create a draft for newsletter, LinkedIn, WordPress, podcast, or YouTube.',
  },
  event: {
    label: 'Event Pipeline',
    description: 'Create or enrich an event record for follow-up and outputs.',
  },
  campus_member: {
    label: 'World Campus Log',
    description: 'Create a member or welcome signal entry for follow-up.',
  },
  media_asset: {
    label: 'Media Library',
    description: 'Create a media recovery or asset follow-up item.',
  },
}

export const CHANNEL_META: Record<CalendarChannel, { label: string; color: string; dot: string }> = {
  linkedin: {
    label: 'LinkedIn',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
  newsletter: {
    label: 'Newsletter',
    color: 'border-teal-200 bg-teal-50 text-teal-700',
    dot: 'bg-teal-500',
  },
  wordpress: {
    label: 'WordPress',
    color: 'border-orange-200 bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
  },
  podcast: {
    label: 'Podcast',
    color: 'border-violet-200 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
  },
  youtube: {
    label: 'YouTube',
    color: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
}

export const CALENDAR_STATUS_META: Record<
  CalendarStatus,
  { label: string; tone: 'neutral' | 'amber' | 'blue' | 'green' | 'violet' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In Review', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  published: { label: 'Published', tone: 'green' },
  archived: { label: 'Archived', tone: 'violet' },
}

export const EVENT_STAGE_META: Record<
  EventStage,
  { label: string; tone: 'neutral' | 'amber' | 'blue' | 'green' | 'violet' }
> = {
  announced: { label: 'Announced', tone: 'neutral' },
  attending: { label: 'Attending', tone: 'blue' },
  in_progress: { label: 'In Progress', tone: 'amber' },
  post_event: { label: 'Post-event', tone: 'green' },
  archived: { label: 'Archived', tone: 'violet' },
}

const FILTER_TYPE_MAP: Record<Exclude<IntakeFilter, 'all' | 'dismissed' | 'peter_messages'>, IntakeContentType[]> = {
  events: ['event_report'],
  articles: ['article_share'],
  members: ['member_intro'],
  initiative_updates: ['initiative_update'],
  media_requests: ['media_request'],
}

const ROUTING_MAP: Record<IntakeContentType, RouteDestination | null> = {
  event_report: 'calendar',
  article_share: 'calendar',
  member_intro: 'campus_member',
  initiative_update: 'event',
  media_request: 'media_asset',
  noise: null,
}

const ROUTING_OPTIONS_MAP: Record<IntakeContentType, RouteDestination[]> = {
  event_report: ['calendar', 'event', 'media_asset'],
  article_share: ['calendar', 'media_asset'],
  member_intro: ['campus_member'],
  initiative_update: ['event', 'campus_member', 'calendar'],
  media_request: ['media_asset', 'calendar'],
  noise: [],
}

const ALLOWED_STATUS_TRANSITIONS: Record<CalendarStatus, CalendarStatus[]> = {
  draft: ['in_review', 'scheduled', 'archived'],
  in_review: ['draft', 'scheduled', 'archived'],
  scheduled: ['draft', 'in_review', 'published', 'archived'],
  published: ['archived'],
  archived: ['draft'],
}

export function getIntakeTypeMeta(type: string | null | undefined) {
  return CONTENT_TYPE_META[(type ?? 'noise') as IntakeContentType] ?? CONTENT_TYPE_META.noise
}

export function getSuggestedDestination(type: IntakeContentType): RouteDestination | null {
  return ROUTING_MAP[type]
}

export function getRoutingOptions(type: IntakeContentType): RouteDestination[] {
  return ROUTING_OPTIONS_MAP[type] ?? []
}

export function getDestinationLabel(type: IntakeContentType): string {
  const destination = getSuggestedDestination(type)
  return destination ? ROUTE_DESTINATION_META[destination].label : 'Archive'
}

export function matchesIntakeFilter(
  item: Pick<IntakeRow, 'status' | 'content_type' | 'captured_at' | 'is_peter_kapitein'>,
  filter: IntakeFilter,
  now = new Date()
) {
  if (filter === 'all') return item.status !== 'dismissed'
  if (filter === 'peter_messages') return item.status !== 'dismissed' && Boolean(item.is_peter_kapitein)
  if (filter === 'dismissed') {
    if (item.status !== 'dismissed') return false
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    return new Date(item.captured_at) >= ninetyDaysAgo
  }

  return item.status !== 'dismissed' && FILTER_TYPE_MAP[filter].includes(item.content_type as IntakeContentType)
}

export function summarizeRawContent(rawContent: string, maxLength = 180) {
  const collapsed = rawContent.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLength) return collapsed
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`
}

export function createCalendarTitleFromIntake(item: Pick<IntakeRow, 'content_type' | 'sender_name' | 'raw_content'>) {
  const summary = summarizeRawContent(item.raw_content, 72)
  switch (item.content_type as IntakeContentType) {
    case 'article_share':
      return `Newsletter candidate: ${summary}`
    case 'event_report':
      return `Event report draft: ${summary}`
    case 'initiative_update':
      return `Initiative update: ${summary}`
    case 'media_request':
      return `Media follow-up: ${summary}`
    default:
      return `${item.sender_name}: ${summary}`
  }
}

export function getDefaultChannelsForIntakeType(type: IntakeContentType): CalendarChannel[] {
  switch (type) {
    case 'event_report':
      return ['linkedin', 'newsletter']
    case 'article_share':
      return ['newsletter']
    case 'initiative_update':
      return ['linkedin', 'newsletter']
    case 'media_request':
      return ['newsletter']
    default:
      return ['newsletter']
  }
}

export function buildCalendarDraftFromIntake(
  item: Pick<
    IntakeRow,
    'content_type' | 'sender_name' | 'raw_content' | 'source_url' | 'attached_media_ref' | 'is_peter_kapitein'
  >
) {
  const type = item.content_type as IntakeContentType
  return {
    title: createCalendarTitleFromIntake(item),
    channels: getDefaultChannelsForIntakeType(type),
    status: 'draft' as CalendarStatus,
    source_link: item.source_url,
    attached_media_refs: item.attached_media_ref ? [item.attached_media_ref] : [],
    body_draft: item.raw_content,
    tags: buildTagsFromIntake(item),
  }
}

export function buildTagsFromIntake(item: Pick<IntakeRow, 'content_type' | 'is_peter_kapitein' | 'sender_name'>) {
  const tags = new Set<string>([item.content_type.replace('_', '-')])
  if (item.is_peter_kapitein) tags.add('peter-signal')
  if (item.sender_name) tags.add(item.sender_name.toLowerCase().replace(/\s+/g, '-'))
  return Array.from(tags)
}

export function canTransitionCalendarStatus(current: CalendarStatus, next: CalendarStatus) {
  return ALLOWED_STATUS_TRANSITIONS[current]?.includes(next) ?? false
}

export function getNextCalendarStatuses(current: CalendarStatus) {
  return ALLOWED_STATUS_TRANSITIONS[current] ?? []
}

export function assertCalendarTransition(current: CalendarStatus, next: CalendarStatus) {
  if (!canTransitionCalendarStatus(current, next)) {
    throw new Error(`Invalid calendar status transition: ${current} -> ${next}`)
  }
}

export function parseTagList(raw: string) {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function parseChannelList(values: FormDataEntryValue[]) {
  return values
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter((value): value is CalendarChannel => value in CHANNEL_META)
}

export function getCalendarEntryDayKey(row: Pick<CalendarRow, 'scheduled_at' | 'published_at' | 'created_at'>) {
  return (row.scheduled_at ?? row.published_at ?? row.created_at).slice(0, 10)
}

export function groupCalendarEntriesByDay<
  T extends Pick<CalendarRow, 'scheduled_at' | 'published_at' | 'created_at'>
>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const key = getCalendarEntryDayKey(row)
    acc[key] ??= []
    acc[key].push(row)
    return acc
  }, {})
}

export function getDigestTime(notificationPrefs: Database['public']['Tables']['profiles']['Row']['notification_prefs']) {
  const prefs =
    notificationPrefs && typeof notificationPrefs === 'object' && !Array.isArray(notificationPrefs)
      ? notificationPrefs
      : null
  const value = prefs && 'digestDeliveryTime' in prefs ? prefs.digestDeliveryTime : null
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : '08:00'
}

export function getDigestWindowLabel(count: number) {
  return count === 1 ? '1 new intake item' : `${count} new intake items`
}
