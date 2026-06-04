import { EVENT_DUPLICATE_WINDOW_DAYS, KNOWN_COUNTRIES, PETER_KAPITEIN_ALIASES } from '@/lib/comms-constants'
import { normalizeEventType } from '@/lib/comms-events'

type EventLike = {
  id: string
  name: string
  start_date: string
}

type IntakeLike = {
  sender_name: string
  raw_content: string
  captured_at: string
  is_peter_kapitein?: boolean
}

type MemberSignalPayload = {
  sender_name: string
  raw_content: string
  routed_to_type?: string | null
  routed_to_id?: string | null
}

type CalendarSignalPayload = {
  title: string
  body_draft: string | null
  tags: string[] | null
  source_intake_id?: string | null
}

type ExistingCampusMember = {
  country: string | null
  organisation: string | null
  role_description: string | null
  notes: string | null
  welcomed_by_peter: boolean
  date_welcomed: string | null
  last_channel_activity: string | null
  initiative_affiliations: string[] | null
}

export type ParsedCampusMemberDraft = {
  name: string
  country: string
  organisation: string
  roleDescription: string
  welcomedByPeter: boolean
}

export type ParsedEventDraft = {
  name: string
  eventType: string
  startDate: string
  endDate: string
  organiser: string
  locationCity: string
  locationCountry: string
  notes: string
  isAnnualCongress: boolean
}

export function normalizeSignalText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanExtractedValue(value: string | null | undefined) {
  return value?.replace(/[.,;:!?]+$/g, '').trim() ?? ''
}

function mergeTextBlocks(existing: string | null | undefined, addition: string) {
  const base = existing?.trim()
  const next = addition.trim()
  if (!base) return next
  if (!next || base.includes(next)) return base
  return `${base}\n\n${next}`
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[]
}

function getLatestTimestamp(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[]
  if (valid.length === 0) return null
  return valid.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  )
}

export function hasSpecificPersonName(name: string) {
  return normalizeSignalText(name).split(' ').filter(Boolean).length >= 2
}

function uniqueByOrder(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  return values
    .map((value) => cleanExtractedValue(value))
    .filter((value) => {
      if (!value) return false
      const key = normalizeSignalText(value)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function isPeterKapiteinSignal(senderName: string) {
  const sender = normalizeSignalText(senderName)
  return PETER_KAPITEIN_ALIASES.some((alias) => sender === normalizeSignalText(alias))
}

export function getPeterAwareClassificationConfidence(senderName: string) {
  return isPeterKapiteinSignal(senderName) ? 'high' : 'medium'
}

export function extractCountryFromText(rawContent: string) {
  const text = rawContent.trim()

  for (const country of KNOWN_COUNTRIES) {
    const matcher = new RegExp(`\\b${country.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (matcher.test(text)) return country
  }

  const explicitMatch = text.match(/\bfrom\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)\b/)
  return explicitMatch ? cleanExtractedValue(explicitMatch[1]) : ''
}

export function parseCampusMemberDraft(input: IntakeLike): ParsedCampusMemberDraft {
  const text = input.raw_content.trim()
  const welcomedByPeter = Boolean(input.is_peter_kapitein)

  const welcomeMatches = uniqueByOrder([
    text.match(/\bwelcome\s+to\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\s+from\b/i)?.[1],
    text.match(/\bwarm welcome to\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\s+from\b/i)?.[1],
    text.match(/\bwelcome\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\s+from\b/i)?.[1],
  ])

  const joinMatches = uniqueByOrder([
    text.match(/\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\s+joins?\b/)?.[1],
    text.match(/\bI am\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\b/)?.[1],
    text.match(/\bThis is\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\b/)?.[1],
  ])

  const name = welcomedByPeter
    ? welcomeMatches[0] || joinMatches[0] || input.sender_name
    : joinMatches[0] || input.sender_name

  const organisation = cleanExtractedValue(
    text.match(/\bfrom\s+([A-Z][A-Za-z0-9&.\- ]{3,80}?)(?:\s+with|\s+and|\s+who|\.)/i)?.[1]
  )

  const roleDescription = cleanExtractedValue(
    text.match(/\bbackground in\s+([A-Za-z ,\-]+?)(?:\.|$)/i)?.[1] ||
      text.match(/\blook forward to supporting\s+([A-Za-z ,\-]+?)(?:\.|$)/i)?.[1]
  )

  return {
    name,
    country: extractCountryFromText(text),
    organisation,
    roleDescription,
    welcomedByPeter,
  }
}

function extractEventNameCandidate(rawContent: string) {
  const text = rawContent.replace(/\s+/g, ' ').trim()
  const patterns = [
    /\b([A-Z][A-Za-z0-9.&/\-]+(?:\s+[A-Z][A-Za-z0-9.&/\-]+){0,5}\s+(?:Podcast|Episode))\b/,
    /\b([A-Z][A-Za-z0-9.&/\-]+(?:\s+[A-Z][A-Za-z0-9.&/\-]+){0,5}\s+(?:General Assembly|Workshop|Congress|Meeting|Forum|Summit|Conference))\b/,
    /\b(latest\s+[A-Z][A-Za-z0-9.&/\-]+(?:\s+[A-Z][A-Za-z0-9.&/\-]+){0,4}\s+(?:podcast|episode|workshop|conference|meeting))\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return cleanExtractedValue(match[1].replace(/^latest\s+/i, ''))
  }

  if (/annual congress/i.test(text)) return 'Annual Congress'
  return cleanExtractedValue(text.split(/[.!?]/)[0]?.slice(0, 72))
}

function extractEventLocation(rawContent: string) {
  const text = rawContent.trim()
  const cityMatch =
    text.match(/\bfrom the\s+([A-Z][A-Za-z.\-]+)\s+meeting\b/)?.[1] ||
    text.match(/\bin\s+([A-Z][A-Za-z.\-]+)\s+meeting\b/)?.[1] ||
    text.match(/\bin\s+([A-Z][A-Za-z.\-]+)\b/)?.[1]

  return cleanExtractedValue(cityMatch)
}

export function buildEventDraftFromIntake(input: IntakeLike): ParsedEventDraft {
  const name = extractEventNameCandidate(input.raw_content) || input.sender_name
  const startDate = input.captured_at.slice(0, 10)
  const isAnnualCongress = /annual congress/i.test(input.raw_content) || /annual congress/i.test(name)
  const isPodcast = /podcast|episode|recording session/i.test(`${name} ${input.raw_content}`)

  return {
    name,
    eventType: normalizeEventType(
      isPodcast
        ? 'podcast'
        : /workshop/i.test(name)
          ? 'workshop'
          : isAnnualCongress
            ? 'congress'
            : /forum|meeting|summit/i.test(name)
              ? 'symposium'
              : 'conference'
    ),
    startDate,
    endDate: '',
    organiser: cleanExtractedValue(input.sender_name),
    locationCity: extractEventLocation(input.raw_content),
    locationCountry: extractCountryFromText(input.raw_content),
    notes: input.raw_content,
    isAnnualCongress,
  }
}

export function findDuplicateEventMatch(
  candidate: Pick<ParsedEventDraft, 'name' | 'startDate'>,
  events: EventLike[]
) {
  const targetName = normalizeSignalText(candidate.name)
  const targetDate = new Date(candidate.startDate)

  return events.find((event) => {
    const eventName = normalizeSignalText(event.name)
    const eventDate = new Date(event.start_date)
    const dayDelta = Math.abs(Math.round((eventDate.getTime() - targetDate.getTime()) / 86_400_000))

    return dayDelta <= EVENT_DUPLICATE_WINDOW_DAYS && (eventName === targetName || eventName.includes(targetName) || targetName.includes(eventName))
  }) ?? null
}

export function mergeCampusMemberUpdate(
  existing: ExistingCampusMember,
  parsed: ParsedCampusMemberDraft,
  intake: Pick<IntakeLike, 'raw_content' | 'captured_at'>,
  linkedInitiativeId?: string | null
) {
  return {
    country: parsed.country || existing.country,
    organisation: parsed.organisation || existing.organisation,
    role_description: parsed.roleDescription || existing.role_description,
    notes: mergeTextBlocks(existing.notes, intake.raw_content),
    welcomed_by_peter: Boolean(existing.welcomed_by_peter || parsed.welcomedByPeter),
    date_welcomed: existing.date_welcomed || intake.captured_at.slice(0, 10),
    last_channel_activity: getLatestTimestamp(existing.last_channel_activity, intake.captured_at),
    initiative_affiliations: linkedInitiativeId
      ? uniqueTextValues([...(existing.initiative_affiliations ?? []), linkedInitiativeId])
      : existing.initiative_affiliations,
  }
}

export function memberMatchesSignal(
  member: { id: string; name: string },
  payload: MemberSignalPayload
) {
  if (payload.routed_to_type === 'campus_member' && payload.routed_to_id === member.id) return true

  const memberName = member.name.trim()
  const memberKey = normalizeSignalText(memberName)
  const sender = normalizeSignalText(payload.sender_name)

  if (sender === memberKey) return true
  if (!hasSpecificPersonName(memberName)) return false

  const body = normalizeSignalText(payload.raw_content)
  return body.includes(memberKey)
}

export function memberAppearsInCalendar(
  member: { id: string; name: string },
  payload: CalendarSignalPayload,
  relatedIntakeIds: Set<string>
) {
  if (payload.source_intake_id && relatedIntakeIds.has(payload.source_intake_id)) return true
  if (!hasSpecificPersonName(member.name)) return false

  const memberKey = normalizeSignalText(member.name)
  const tags = (payload.tags ?? []).map((tag) => normalizeSignalText(tag)).join(' ')
  const body = normalizeSignalText(`${payload.title} ${payload.body_draft ?? ''} ${tags}`)
  return body.includes(memberKey)
}
