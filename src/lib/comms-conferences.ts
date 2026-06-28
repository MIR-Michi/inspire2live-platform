/**
 * lib/comms-conferences.ts
 *
 * Server-side loaders + pure helpers for the Conferences space. Fetches the
 * AI-discovered conference master list joined with the team's visit-pipeline
 * tracking, and provides the filter/search/grouping logic the UI shares with
 * its unit tests.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  CONFERENCE_REGIONS,
  CONFERENCE_REGION_LABELS,
  type ConferenceDetail,
  type ConferenceFormat,
  type ConferenceRegion,
} from '@/lib/conference-types'

// The pipeline stages a shortlisted conference moves through. A conference with
// no tracking row is "discovered" (it only shows in the Upcoming tab).
export const CONFERENCE_STAGES = ['intended', 'registered', 'ongoing', 'follow_up', 'archived'] as const
export type ConferenceStage = (typeof CONFERENCE_STAGES)[number]

export const CONFERENCE_STAGE_LABELS: Record<ConferenceStage, string> = {
  intended: 'Intended to visit',
  registered: 'Registered',
  ongoing: 'Ongoing',
  follow_up: 'Follow-up',
  archived: 'Archived',
}

export type ConferenceTracking = {
  stage: ConferenceStage
  notes: string | null
  addedAt: string
  updatedAt: string
}

export type ConferenceAssignedContact = {
  id: string
  fullName: string
  email: string | null
  whatsappId: string | null
  meta: string | null
  assignmentId: string
  role: string
  notificationStatus: string
  notificationDetail: string | null
  assignedAt: string
}

export type ConferenceView = {
  id: string
  name: string
  organizer: string | null
  region: ConferenceRegion
  regionLabel: string
  location: string | null
  mainFocus: string | null
  topics: string[]
  format: ConferenceFormat
  startDate: string | null
  endDate: string | null
  websiteUrl: string | null
  sourceUrl: string | null
  summary: string | null
  relevance: number
  detail: ConferenceDetail | null
  detailStatus: 'none' | 'loading' | 'ready' | 'error'
  /** Present once the conference has been added to the pipeline. */
  tracking: ConferenceTracking | null
  assignedContacts?: ConferenceAssignedContact[]
}

export type ConferenceFilters = {
  region?: string
  focus?: string
  format?: string
  search?: string
}

export type ConferencesData = {
  conferences: ConferenceView[]
  regions: Array<{ value: ConferenceRegion; label: string; count: number }>
  focuses: string[]
}

const CONFERENCE_COLUMNS =
  'id, name, organizer, region, location, main_focus, topics, format, start_date, end_date, website_url, source_url, summary, relevance, detail, detail_status, discovered_at'
const TRACKING_COLUMNS = 'conference_id, stage, notes, added_at, updated_at'
const ASSIGNMENT_COLUMNS = 'id, conference_id, contact_id, role, notification_status, notification_detail, assigned_at'
const CONTACT_COLUMNS = 'id, full_name, email, whatsapp_id, title, organisation'

type DbError = { message: string }
type Row = Record<string, unknown>
type RowsResult = Promise<{ data: Row[] | null; error: DbError | null }>
type RowResult = Promise<{ data: Row | null; error: DbError | null }>

function normalizeStage(value: unknown): ConferenceStage {
  return (CONFERENCE_STAGES as readonly string[]).includes(value as string) ? (value as ConferenceStage) : 'intended'
}

function cleanText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function contactMeta(row: Row): string | null {
  return [cleanText(row.title), cleanText(row.organisation), cleanText(row.email)].filter(Boolean).join(' · ') || null
}

function rowToView(
  row: Row,
  tracking: Map<string, ConferenceTracking>,
  assignedContacts: Map<string, ConferenceAssignedContact[]>
): ConferenceView {
  const region = (CONFERENCE_REGIONS as readonly string[]).includes(String(row.region))
    ? (String(row.region) as ConferenceRegion)
    : 'global'
  const id = String(row.id)
  return {
    id,
    name: String(row.name ?? 'Untitled conference'),
    organizer: (row.organizer as string | null) ?? null,
    region,
    regionLabel: CONFERENCE_REGION_LABELS[region],
    location: (row.location as string | null) ?? null,
    mainFocus: (row.main_focus as string | null) ?? null,
    topics: Array.isArray(row.topics) ? (row.topics as string[]) : [],
    format: (['in_person', 'virtual', 'hybrid'].includes(String(row.format)) ? String(row.format) : 'in_person') as ConferenceFormat,
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    relevance: typeof row.relevance === 'number' ? row.relevance : 50,
    detail: (row.detail as ConferenceDetail | null) ?? null,
    detailStatus: (['none', 'loading', 'ready', 'error'].includes(String(row.detail_status)) ? String(row.detail_status) : 'none') as ConferenceView['detailStatus'],
    tracking: tracking.get(id) ?? null,
    assignedContacts: assignedContacts.get(id) ?? [],
  }
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, opts: { ascending: boolean; nullsFirst?: boolean }) => RowsResult
      eq: (column: string, value: string) => { maybeSingle: () => RowResult }
      in: (column: string, values: string[]) => { limit: (n: number) => RowsResult }
    }
  }
}

async function loadAssignedContacts(db: LooseDb): Promise<Map<string, ConferenceAssignedContact[]>> {
  const assignmentResult = await db
    .from('conference_contact_assignments')
    .select(ASSIGNMENT_COLUMNS)
    .order('assigned_at', { ascending: false })

  if (assignmentResult.error) return new Map()

  const assignments = assignmentResult.data ?? []
  const contactIds = Array.from(new Set(assignments.map((row) => String(row.contact_id ?? '')).filter(Boolean)))
  if (contactIds.length === 0) return new Map()

  const contactResult = await db
    .from('comms_crm_contacts')
    .select(CONTACT_COLUMNS)
    .in('id', contactIds)
    .limit(Math.max(contactIds.length, 1))

  if (contactResult.error) return new Map()

  const contacts = new Map((contactResult.data ?? []).map((row) => [String(row.id), row]))
  const byConference = new Map<string, ConferenceAssignedContact[]>()

  for (const assignment of assignments) {
    const contact = contacts.get(String(assignment.contact_id))
    if (!contact) continue
    const conferenceId = String(assignment.conference_id)
    byConference.set(conferenceId, [
      ...(byConference.get(conferenceId) ?? []),
      {
        id: String(contact.id),
        fullName: String(contact.full_name ?? 'Unnamed contact'),
        email: cleanText(contact.email),
        whatsappId: cleanText(contact.whatsapp_id),
        meta: contactMeta(contact),
        assignmentId: String(assignment.id),
        role: String(assignment.role ?? 'attendee'),
        notificationStatus: String(assignment.notification_status ?? 'queued'),
        notificationDetail: cleanText(assignment.notification_detail),
        assignedAt: String(assignment.assigned_at),
      },
    ])
  }

  return byConference
}

/** Load every discovered conference joined with its pipeline tracking. */
export async function loadConferencesData(supabase: SupabaseClient<Database>): Promise<ConferencesData> {
  const db = supabase as unknown as LooseDb
  try {
    const [conferencesResult, trackingResult, assignedContacts] = await Promise.all([
      db.from('conferences').select(CONFERENCE_COLUMNS).order('start_date', { ascending: true, nullsFirst: false }),
      db.from('conference_tracking').select(TRACKING_COLUMNS).order('updated_at', { ascending: false }),
      loadAssignedContacts(db),
    ])

    const trackingMap = new Map<string, ConferenceTracking>()
    for (const row of trackingResult.data ?? []) {
      trackingMap.set(String(row.conference_id), {
        stage: normalizeStage(row.stage),
        notes: (row.notes as string | null) ?? null,
        addedAt: String(row.added_at),
        updatedAt: String(row.updated_at),
      })
    }

    const conferences = (conferencesResult.data ?? []).map((row) => rowToView(row, trackingMap, assignedContacts))

    // Region facets (only regions that actually have conferences).
    const regionCounts = new Map<ConferenceRegion, number>()
    const focuses = new Set<string>()
    for (const conf of conferences) {
      regionCounts.set(conf.region, (regionCounts.get(conf.region) ?? 0) + 1)
      if (conf.mainFocus) focuses.add(conf.mainFocus)
    }
    const regions = CONFERENCE_REGIONS.filter((r) => regionCounts.has(r)).map((value) => ({
      value,
      label: CONFERENCE_REGION_LABELS[value],
      count: regionCounts.get(value) ?? 0,
    }))

    return { conferences, regions, focuses: [...focuses].sort((a, b) => a.localeCompare(b)) }
  } catch (error) {
    console.error('[conferences] loadConferencesData failed', error)
    return { conferences: [], regions: [], focuses: [] }
  }
}

/** Load one conference by id (for the detail enrichment action). */
export async function loadConference(supabase: SupabaseClient<Database>, id: string): Promise<ConferenceView | null> {
  const db = supabase as unknown as LooseDb
  try {
    const { data } = await db.from('conferences').select(CONFERENCE_COLUMNS).eq('id', id).maybeSingle()
    if (!data) return null
    return rowToView(data, new Map(), new Map())
  } catch (error) {
    console.error('[conferences] loadConference failed', error)
    return null
  }
}

// ── Pure filtering / grouping (shared with unit tests) ───────────────────────

/** Apply the region / focus / format / search filters to a conference list. */
export function filterConferences(conferences: ConferenceView[], filters: ConferenceFilters): ConferenceView[] {
  const region = filters.region && filters.region !== 'all' ? filters.region : null
  const focus = filters.focus && filters.focus !== 'all' ? filters.focus.toLowerCase() : null
  const format = filters.format && filters.format !== 'all' ? filters.format : null
  const search = filters.search?.trim().toLowerCase() || null

  return conferences.filter((conf) => {
    if (region && conf.region !== region) return false
    if (focus && (conf.mainFocus?.toLowerCase() ?? '') !== focus) return false
    if (format && conf.format !== format) return false
    if (search) {
      const haystack = [conf.name, conf.organizer, conf.location, conf.mainFocus, conf.summary, ...conf.topics]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/** The four tabs the Conferences space is organized into. */
export type ConferenceTab = 'upcoming' | 'shortlist' | 'pipeline' | 'archive'

/** Which tab a conference belongs to, based on its tracking stage. */
export function partitionConferences(conferences: ConferenceView[]): Record<ConferenceTab, ConferenceView[]> {
  const upcoming: ConferenceView[] = []
  const shortlist: ConferenceView[] = []
  const pipeline: ConferenceView[] = []
  const archive: ConferenceView[] = []

  for (const conf of conferences) {
    const stage = conf.tracking?.stage
    if (!stage) {
      upcoming.push(conf)
    } else if (stage === 'archived') {
      archive.push(conf)
    } else if (stage === 'intended') {
      shortlist.push(conf)
      upcoming.push(conf) // shortlisted items still appear in Upcoming (flagged)
    } else {
      // registered / ongoing / follow_up
      pipeline.push(conf)
    }
  }

  return { upcoming, shortlist, pipeline, archive }
}
