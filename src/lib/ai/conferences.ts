import 'server-only'

import { runAiMessage, webSearchTool, wrapExternalData } from './client'
import type { AiModelId, AiReasoningEffort } from './models'

// Discovery is a web-search aggregation job (find real conferences with real
// dates and URLs), best served by the fast balanced model rather than the
// heavy reasoning default — same policy as the org news feed.
const CONFERENCE_MODEL: AiModelId = 'claude-sonnet-4-6'

// ── Region taxonomy (mirrors the DB check constraint + filter dropdown) ──────
export const CONFERENCE_REGIONS = [
  'europe',
  'north_america',
  'latin_america',
  'asia_pacific',
  'middle_east_africa',
  'global',
] as const
export type ConferenceRegion = (typeof CONFERENCE_REGIONS)[number]

export const CONFERENCE_REGION_LABELS: Record<ConferenceRegion, string> = {
  europe: 'Europe',
  north_america: 'North America',
  latin_america: 'Latin America',
  asia_pacific: 'Asia-Pacific',
  middle_east_africa: 'Middle East & Africa',
  global: 'Global / Virtual',
}

export const CONFERENCE_FORMATS = ['in_person', 'virtual', 'hybrid'] as const
export type ConferenceFormat = (typeof CONFERENCE_FORMATS)[number]

export type DiscoveredConference = {
  name: string
  organizer: string | null
  region: ConferenceRegion
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
  /** Stable dedupe key (normalized name + start month). */
  dedupeKey: string
}

export type ConferenceDetailFact = { label: string; value: string }

export type ConferenceDetail = {
  overview: string | null
  whyRelevant: string | null
  audience: string | null
  keyTopics: string[]
  notableSpeakers: string[]
  registration: string | null
  registrationDeadline: string | null
  fees: string | null
  facts: ConferenceDetailFact[]
  links: Array<{ label: string; url: string }>
}

export type DiscoverConferencesResult = {
  conferences: DiscoveredConference[]
  model: string | null
  effort: AiReasoningEffort | null
  candidateCount: number
  validatedCount: number
  outputWasJson: boolean
  groupCount: number
  groupErrors: number
}

export type DiscoverConferencesInput = {
  /** Conferences already stored — their names help the model avoid repeats. */
  existingNames?: string[]
  monthsAhead?: number
  createdBy?: string | null
  /** Restrict discovery to specific regions (defaults to all). */
  regions?: ConferenceRegion[]
}

// ── Structured schemas ───────────────────────────────────────────────────────
// (maxItems/minLength/etc. are stripped by sanitizeStructuredSchema in the
// client before the request — kept here only as documentation of intent.)

export const CONFERENCE_LIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['conferences'],
  properties: {
    conferences: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 240 },
          organizer: { type: ['string', 'null'], maxLength: 200 },
          location: { type: ['string', 'null'], maxLength: 200 },
          mainFocus: { type: ['string', 'null'], maxLength: 160 },
          topics: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 80 } },
          format: { type: ['string', 'null'], enum: ['in_person', 'virtual', 'hybrid', null] },
          startDate: { type: ['string', 'null'], maxLength: 40 },
          endDate: { type: ['string', 'null'], maxLength: 40 },
          websiteUrl: { type: ['string', 'null'], maxLength: 1000 },
          sourceUrl: { type: ['string', 'null'], maxLength: 1000 },
          summary: { type: ['string', 'null'], maxLength: 600 },
          relevance: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const

export const CONFERENCE_DETAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overview'],
  properties: {
    overview: { type: ['string', 'null'], maxLength: 1200 },
    whyRelevant: { type: ['string', 'null'], maxLength: 800 },
    audience: { type: ['string', 'null'], maxLength: 400 },
    keyTopics: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 120 } },
    notableSpeakers: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 160 } },
    registration: { type: ['string', 'null'], maxLength: 600 },
    registrationDeadline: { type: ['string', 'null'], maxLength: 80 },
    fees: { type: ['string', 'null'], maxLength: 400 },
    facts: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: {
          label: { type: 'string', maxLength: 80 },
          value: { type: 'string', maxLength: 240 },
        },
      },
    },
    links: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'url'],
        properties: {
          label: { type: 'string', maxLength: 120 },
          url: { type: 'string', maxLength: 1000 },
        },
      },
    },
  },
} as const

const ORG_PROFILE = `Inspire2Live is an international patient-driven cancer organization. Its patient advocates attend and present at oncology and cancer-research conferences worldwide to build partnerships, share patient perspectives, and bring research back to patients.`

/**
 * Stable, cacheable system prefix shared by every discovery lane. The specific
 * region + oncology focus is supplied per lane in the user message.
 */
export function buildDiscoverySystemPrompt(monthsAhead: number): string {
  return [
    'You find real, upcoming oncology and cancer-research conferences for the Inspire2Live communications team.',
    ORG_PROFILE,
    '',
    `Only include conferences whose start date is in the future, within roughly the next ${monthsAhead} months.`,
    '',
    'Rules:',
    '- Use the web_search tool to find REAL conferences. Never invent a conference, a date, or a URL.',
    '- Every result must have a real future startDate and either websiteUrl or sourceUrl.',
    '- Prefer the official conference website for websiteUrl; copy sourceUrl from a real search result.',
    '- Include major global congresses and smaller regionally important oncology, cancer research, patient advocacy, survivorship, palliative oncology, nursing, radiotherapy, surgical oncology, and tumor-specific meetings.',
    '- Use at most 3 searches for this lane, then return ONLY schema-valid JSON — nothing else.',
    '- Dates must be ISO (YYYY-MM-DD). If only a month is known, use the first day of that month.',
    '- Set mainFocus to the primary oncology theme ("Breast cancer", "Immuno-oncology", "General oncology", …).',
    '- relevance is 0-100 for how valuable the conference is to a patient-advocacy organization.',
  ].join('\n')
}

// ── Pure helpers (exported for unit tests) ───────────────────────────────────

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableString(value: unknown, max: number): string | null {
  const text = asString(value)
  return text ? text.slice(0, max) : null
}

function clampRelevance(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Coerce a model date into a plain ISO date (YYYY-MM-DD), or null. */
export function toIsoDate(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  const ms = Date.parse(text)
  if (Number.isNaN(ms)) return null
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  if (year < 2000 || year > 2100) return null
  return date.toISOString().slice(0, 10)
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanUrl(value: unknown): string | null {
  const text = asString(value)
  if (!text || !isHttpUrl(text)) return null
  return text.slice(0, 1000)
}

function normalizeRegion(value: unknown): ConferenceRegion {
  const text = asString(value).toLowerCase().replace(/[\s-]+/g, '_')
  return (CONFERENCE_REGIONS as readonly string[]).includes(text) ? (text as ConferenceRegion) : 'global'
}

function normalizeFormat(value: unknown): ConferenceFormat {
  const text = asString(value).toLowerCase().replace(/[\s-]+/g, '_')
  return (CONFERENCE_FORMATS as readonly string[]).includes(text) ? (text as ConferenceFormat) : 'in_person'
}

function normalizeTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const topic = asString(entry).slice(0, 80)
    if (!topic) continue
    const key = topic.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(topic)
    if (out.length >= 8) break
  }
  return out
}

/**
 * Stable dedupe key from the conference identity: normalized name + start month
 * (so the same event found in two regions, or re-found next month, collapses).
 */
export function conferenceDedupeKey(name: string, startDate: string | null): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
  const month = startDate ? startDate.slice(0, 7) : 'tbd'
  return `${slug}:${month}`.slice(0, 200)
}

function normalizeConference(value: unknown, region: ConferenceRegion): DiscoveredConference | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const name = asString(raw.name)
  if (!name) return null

  const startDate = toIsoDate(raw.startDate)
  const endDate = toIsoDate(raw.endDate)
  const websiteUrl = cleanUrl(raw.websiteUrl)
  const sourceUrl = cleanUrl(raw.sourceUrl) ?? websiteUrl

  return {
    name: name.slice(0, 240),
    organizer: nullableString(raw.organizer, 200),
    region: raw.region ? normalizeRegion(raw.region) : region,
    location: nullableString(raw.location, 200),
    mainFocus: nullableString(raw.mainFocus, 160),
    topics: normalizeTopics(raw.topics),
    format: normalizeFormat(raw.format),
    startDate,
    endDate,
    websiteUrl,
    sourceUrl,
    summary: nullableString(raw.summary, 600),
    relevance: clampRelevance(raw.relevance),
    dedupeKey: conferenceDedupeKey(name, startDate),
  }
}

function listFrom(value: unknown, key: string): unknown[] {
  const container = value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : value
  return Array.isArray(container) ? container : []
}

/** Drop past-dated conferences and anything outside the discovery window. */
function withinWindow(conf: DiscoveredConference, monthsAhead: number): boolean {
  if (!conf.startDate) return false
  if (!conf.websiteUrl && !conf.sourceUrl) return false
  const start = Date.parse(conf.startDate)
  if (Number.isNaN(start)) return false
  const now = Date.now()
  // Allow a small grace for events that started yesterday/today.
  const grace = 2 * 24 * 60 * 60 * 1000
  const horizon = now + (monthsAhead + 1) * 31 * 24 * 60 * 60 * 1000
  return start >= now - grace && start <= horizon
}

export function validateConferences(value: unknown, region: ConferenceRegion, monthsAhead: number): DiscoveredConference[] {
  return listFrom(value, 'conferences')
    .map((item) => normalizeConference(item, region))
    .filter((conf): conf is DiscoveredConference => Boolean(conf) && withinWindow(conf as DiscoveredConference, monthsAhead))
}

/** Dedupe a batch by dedupe key, keeping the highest-relevance variant. */
export function dedupeConferences(conferences: DiscoveredConference[], existingKeys: string[] = []): DiscoveredConference[] {
  const seen = new Set(existingKeys)
  const byKey = new Map<string, DiscoveredConference>()
  for (const conf of conferences) {
    if (seen.has(conf.dedupeKey)) continue
    const current = byKey.get(conf.dedupeKey)
    if (!current || conf.relevance > current.relevance) byKey.set(conf.dedupeKey, conf)
  }
  return [...byKey.values()]
}

export function normalizeDetail(value: unknown): ConferenceDetail {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const stringList = (input: unknown, max: number, itemMax: number): string[] => {
    if (!Array.isArray(input)) return []
    const out: string[] = []
    for (const entry of input) {
      const text = asString(entry).slice(0, itemMax)
      if (text) out.push(text)
      if (out.length >= max) break
    }
    return out
  }
  const facts: ConferenceDetailFact[] = []
  if (Array.isArray(raw.facts)) {
    for (const entry of raw.facts) {
      if (!entry || typeof entry !== 'object') continue
      const label = asString((entry as Record<string, unknown>).label).slice(0, 80)
      const val = asString((entry as Record<string, unknown>).value).slice(0, 240)
      if (label && val) facts.push({ label, value: val })
      if (facts.length >= 12) break
    }
  }
  const links: Array<{ label: string; url: string }> = []
  if (Array.isArray(raw.links)) {
    for (const entry of raw.links) {
      if (!entry || typeof entry !== 'object') continue
      const label = asString((entry as Record<string, unknown>).label).slice(0, 120)
      const url = cleanUrl((entry as Record<string, unknown>).url)
      if (label && url) links.push({ label, url })
      if (links.length >= 8) break
    }
  }
  return {
    overview: nullableString(raw.overview, 1200),
    whyRelevant: nullableString(raw.whyRelevant, 800),
    audience: nullableString(raw.audience, 400),
    keyTopics: stringList(raw.keyTopics, 12, 120),
    notableSpeakers: stringList(raw.notableSpeakers, 12, 160),
    registration: nullableString(raw.registration, 600),
    registrationDeadline: nullableString(raw.registrationDeadline, 80),
    fees: nullableString(raw.fees, 400),
    facts,
    links,
  }
}

// ── Fan-out discovery ────────────────────────────────────────────────────────
// The comprehensive sweep is a region × focus matrix. Each lane is small and
// bounded, but together the sweep can produce 80+ validated conferences.

const GROUP_TIMEOUT_MS = 55_000
const GROUP_CONCURRENCY = 6
const GROUP_ITEMS = 8
const TOTAL_CAP = 120
const DEFAULT_MONTHS_AHEAD = 12

type DiscoveryLens = {
  key: string
  label: string
  instruction: string
  searchHints: string[]
}

type DiscoveryLane = DiscoveryLens & { region: ConferenceRegion }

const DISCOVERY_LENSES: DiscoveryLens[] = [
  {
    key: 'flagship',
    label: 'flagship multidisciplinary oncology meetings',
    instruction: 'major multidisciplinary oncology, cancer research, cancer control, and clinical oncology congresses',
    searchHints: ['annual congress oncology', 'cancer congress', 'medical oncology conference'],
  },
  {
    key: 'tumor_specific',
    label: 'tumor-specific meetings',
    instruction: 'tumor-specific conferences, including breast, lung, GI, GU, gynecologic, hematologic, pediatric, melanoma, and rare cancer meetings',
    searchHints: ['breast cancer symposium', 'lung cancer conference', 'hematology oncology meeting', 'GI cancer symposium'],
  },
  {
    key: 'research_precision',
    label: 'research and precision oncology meetings',
    instruction: 'cancer biology, translational research, immuno-oncology, precision oncology, radiotherapy, surgical oncology, diagnostics, and biomarker meetings',
    searchHints: ['cancer research conference', 'immuno oncology congress', 'precision oncology meeting', 'radiation oncology congress'],
  },
  {
    key: 'advocacy_survivorship',
    label: 'patient care and advocacy meetings',
    instruction: 'patient advocacy, survivorship, palliative oncology, psycho-oncology, oncology nursing, supportive care, public health, and implementation meetings with cancer relevance',
    searchHints: ['cancer survivorship conference', 'oncology nursing congress', 'palliative oncology conference', 'patient advocacy cancer meeting'],
  },
]

const REGION_SEARCH_HINTS: Record<ConferenceRegion, string[]> = {
  europe: ['ESMO', 'EACR', 'European cancer congress', 'European oncology society calendar'],
  north_america: ['ASCO', 'AACR', 'ASTRO', 'ONS', 'NCI cancer conference', 'Canadian oncology conference'],
  latin_america: ['Latin America oncology congress', 'SLACOM', 'LACOG', 'SBOC', 'Mexico oncology congress', 'Argentina oncology congress'],
  asia_pacific: ['ESMO Asia', 'Asia Pacific oncology conference', 'JSMO', 'CSCO', 'KSMO', 'ICON India oncology conference', 'Australia cancer conference'],
  middle_east_africa: ['AORTIC', 'African cancer conference', 'Middle East oncology congress', 'Gulf oncology conference', 'North Africa oncology conference'],
  global: ['global oncology congress', 'virtual oncology conference', 'international cancer research conference', 'world cancer congress'],
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

type GroupResult = { conferences: DiscoveredConference[]; candidates: number; validated: number; outputWasJson: boolean; error: boolean }

function buildDiscoveryLanes(regions: ConferenceRegion[]): DiscoveryLane[] {
  return regions.flatMap((region) => DISCOVERY_LENSES.map((lens) => ({ ...lens, region })))
}

function buildLaneInstruction(lane: DiscoveryLane, monthsAhead: number): string {
  const label = CONFERENCE_REGION_LABELS[lane.region]
  const scope =
    lane.region === 'global'
      ? 'global, international, and fully virtual conferences open to international attendees'
      : `conferences taking place in ${label}`
  const hints = [...REGION_SEARCH_HINTS[lane.region], ...lane.searchHints].join('; ')

  return [
    `Find up to ${GROUP_ITEMS} upcoming ${lane.instruction} for ${scope}, starting within the next ${monthsAhead} months.`,
    `Set region to "${lane.region}" for every result.`,
    `Use search terms and source types like: ${hints}.`,
    'Prefer official society calendars, official conference pages, university or hospital event calendars, and reputable oncology meeting calendars.',
    'Do not repeat conferences from the existing list. Do not include webinars unless they are conference-scale events.',
    'Return fewer results if necessary, but every result must have a future date and a real URL.',
  ].join(' ')
}

async function discoverLane(
  lane: DiscoveryLane,
  system: string,
  monthsAhead: number,
  existingNames: string[],
  createdBy: string | null
): Promise<GroupResult> {
  const existingContext = wrapExternalData(
    'conferences.existing',
    JSON.stringify({ existingNames: existingNames.slice(0, 100), note: 'Do not repeat these.' })
  )
  try {
    const result = await runAiMessage<unknown>({
      feature: 'conference_discovery_lane',
      model: CONFERENCE_MODEL,
      effort: 'low',
      maxTokens: 4500,
      timeoutMs: GROUP_TIMEOUT_MS,
      retries: 0,
      createdBy,
      system,
      cacheSystemPrompt: true,
      tools: [webSearchTool({ maxUses: 3 })],
      structuredFormat: {
        type: 'json_schema',
        name: 'conference_list',
        description: 'Real upcoming oncology conferences for one region/focus lane.',
        schema: CONFERENCE_LIST_SCHEMA as unknown as Record<string, unknown>,
      },
      messages: [
        { role: 'user', content: [buildLaneInstruction(lane, monthsAhead), existingContext].join('\n\n') },
      ],
    })
    const candidates = listFrom(result.output, 'conferences').length
    const validated = validateConferences(result.output, lane.region, monthsAhead)
    return { conferences: validated, candidates, validated: validated.length, outputWasJson: typeof result.output !== 'string', error: false }
  } catch (error) {
    console.error(`[conferences] lane "${lane.region}/${lane.key}" failed`, error)
    return { conferences: [], candidates: 0, validated: 0, outputWasJson: true, error: true }
  }
}

/**
 * Discover upcoming oncology conferences by fanning out a bounded global search
 * matrix, then consolidating + deduping. One slow/failed lane does not sink the
 * others. Real dates + URLs are required.
 */
export async function discoverConferences(input: DiscoverConferencesInput = {}): Promise<DiscoverConferencesResult> {
  const monthsAhead = input.monthsAhead ?? DEFAULT_MONTHS_AHEAD
  const regions = input.regions && input.regions.length > 0 ? input.regions : [...CONFERENCE_REGIONS]
  const lanes = buildDiscoveryLanes(regions)
  const system = buildDiscoverySystemPrompt(monthsAhead)
  const existingNames = input.existingNames ?? []

  const groupResults = await mapWithConcurrency(lanes, GROUP_CONCURRENCY, (lane) =>
    discoverLane(lane, system, monthsAhead, existingNames, input.createdBy ?? null)
  )

  let candidateCount = 0
  let validatedCount = 0
  let outputWasJson = true
  let groupErrors = 0
  const all: DiscoveredConference[] = []
  for (const result of groupResults) {
    candidateCount += result.candidates
    validatedCount += result.validated
    if (!result.outputWasJson) outputWasJson = false
    if (result.error) groupErrors += 1
    all.push(...result.conferences)
  }

  const deduped = dedupeConferences(all)
    .sort((a, b) => {
      // Soonest first; undated last.
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate)
      if (a.startDate) return -1
      if (b.startDate) return 1
      return b.relevance - a.relevance
    })
    .slice(0, TOTAL_CAP)

  return {
    conferences: deduped,
    model: CONFERENCE_MODEL,
    effort: 'low',
    candidateCount,
    validatedCount,
    outputWasJson,
    groupCount: lanes.length,
    groupErrors,
  }
}

/**
 * Gather richer detail for one conference on demand (overview, why it matters
 * to patient advocacy, key topics, notable speakers, registration + fees). One
 * bounded call; the result is cached by the caller so the next open is instant.
 */
export async function enrichConference(conference: {
  name: string
  organizer?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  websiteUrl?: string | null
}): Promise<ConferenceDetail> {
  const system = [
    'You gather concise, accurate detail about a specific upcoming oncology conference for the Inspire2Live communications team.',
    ORG_PROFILE,
    'Use the web_search tool to confirm facts. Never invent speakers, dates, fees, or URLs — omit a field rather than guess.',
    'Use at most 3 searches, then return ONLY schema-valid JSON.',
    'whyRelevant explains, in 1-2 sentences, why this conference matters to a patient-advocacy cancer organization.',
  ].join('\n')

  const context = wrapExternalData('conference.target', JSON.stringify(conference))

  try {
    const result = await runAiMessage<unknown>({
      feature: 'conference_detail',
      model: CONFERENCE_MODEL,
      effort: 'low',
      maxTokens: 2500,
      timeoutMs: 90_000,
      retries: 0,
      system,
      cacheSystemPrompt: true,
      tools: [webSearchTool({ maxUses: 3 })],
      structuredFormat: {
        type: 'json_schema',
        name: 'conference_detail',
        description: 'Concise, citation-backed detail about one conference.',
        schema: CONFERENCE_DETAIL_SCHEMA as unknown as Record<string, unknown>,
      },
      messages: [
        {
          role: 'user',
          content: [
            `Gather detail about this conference: ${conference.name}.`,
            context,
          ].join('\n\n'),
        },
      ],
    })
    return normalizeDetail(result.output)
  } catch (error) {
    console.error('[conferences] enrich failed', error)
    throw error instanceof Error ? error : new Error('Conference enrichment failed.')
  }
}