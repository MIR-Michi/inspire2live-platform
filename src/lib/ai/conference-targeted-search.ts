import 'server-only'

import { runAiMessage, webSearchTool, wrapExternalData } from './client'
import type { AiModelId } from './models'
import {
  CONFERENCE_LIST_SCHEMA,
  CONFERENCE_REGION_LABELS,
  CONFERENCE_REGIONS,
  buildDiscoverySystemPrompt,
  dedupeConferences,
  validateConferences,
  type ConferenceRegion,
  type DiscoverConferencesResult,
} from './conferences'

const TARGETED_CONFERENCE_MODEL: AiModelId = 'claude-sonnet-4-6'
const TARGETED_MONTHS_AHEAD = 12
const TARGETED_LIMIT = 18

export type TargetedConferenceSearchInput = {
  region?: ConferenceRegion | 'all' | null
  country?: string | null
  keywords?: string | null
  existingNames?: string[]
  monthsAhead?: number
  createdBy?: string | null
}

function listFrom(value: unknown, key: string): unknown[] {
  const container = value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : value
  return Array.isArray(container) ? container : []
}

function normalizeRegion(value: TargetedConferenceSearchInput['region']): ConferenceRegion | null {
  if (!value || value === 'all') return null
  return (CONFERENCE_REGIONS as readonly string[]).includes(value) ? value : null
}

function cleanText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim()
  return text ? text.slice(0, max) : null
}

function buildTargetedInstruction(input: TargetedConferenceSearchInput, region: ConferenceRegion | null, monthsAhead: number): string {
  const country = cleanText(input.country, 80)
  const keywords = cleanText(input.keywords, 180)
  const regionLabel = region ? CONFERENCE_REGION_LABELS[region] : 'any global region'
  const geography = country
    ? `taking place in ${country}${region ? ` (${regionLabel})` : ''}`
    : `taking place in ${regionLabel}`

  return [
    `Find up to ${TARGETED_LIMIT} real upcoming oncology or cancer-research conferences ${geography}, starting within the next ${monthsAhead} months.`,
    keywords
      ? `Use this user query as the primary targeting signal: ${keywords}. It may be a disease area, exact conference name or acronym, organizer, speaker, chair, researcher, city, treatment modality, advocacy theme, or audience. If it is a person name, find oncology conferences where that person is listed as speaker, chair, faculty, organizer, or programme committee member.`
      : 'Cover relevant oncology, cancer research, patient advocacy, survivorship, palliative/supportive care, nursing, radiotherapy, surgical oncology, and tumor-specific meetings.',
    region ? `Set region to "${region}" for every result unless the event is fully global/virtual.` : 'Infer the best region for each result using the allowed region taxonomy.',
    'Use focused searches only: one official society/calendar search, one query-specific search using the exact conference/person/topic terms, and one verification search if needed.',
    'For exact conference names or acronyms, prioritize the official conference page over directory pages. For speaker names, prefer programme/faculty pages that connect the person to a real conference.',
    'Do not repeat conferences from the existing list. Never invent a conference, date, speaker relationship, or URL. Return fewer results if necessary, but each result must be a real conference-scale event.',
    'Return ONLY schema-valid JSON.',
  ].join(' ')
}

export async function findTargetedConferences(input: TargetedConferenceSearchInput): Promise<DiscoverConferencesResult> {
  const monthsAhead = input.monthsAhead ?? TARGETED_MONTHS_AHEAD
  const region = normalizeRegion(input.region)
  const fallbackRegion = region ?? 'global'
  const system = buildDiscoverySystemPrompt(monthsAhead)
  const existingNames = input.existingNames ?? []
  const existingContext = wrapExternalData(
    'conferences.existing',
    JSON.stringify({ existingNames: existingNames.slice(0, 80), note: 'Do not repeat these.' })
  )

  const result = await runAiMessage<unknown>({
    feature: 'conference_targeted_search',
    model: TARGETED_CONFERENCE_MODEL,
    effort: 'low',
    maxTokens: 3500,
    timeoutMs: 45_000,
    retries: 0,
    createdBy: input.createdBy ?? null,
    system,
    cacheSystemPrompt: true,
    tools: [webSearchTool({ maxUses: 3 })],
    structuredFormat: {
      type: 'json_schema',
      name: 'conference_targeted_list',
      description: 'Real upcoming oncology conferences matching targeted user criteria.',
      schema: CONFERENCE_LIST_SCHEMA as unknown as Record<string, unknown>,
    },
    messages: [
      { role: 'user', content: [buildTargetedInstruction(input, region, monthsAhead), existingContext].join('\n\n') },
    ],
  })

  const candidateCount = listFrom(result.output, 'conferences').length
  const validated = validateConferences(result.output, fallbackRegion, monthsAhead)
  const conferences = dedupeConferences(validated).slice(0, TARGETED_LIMIT)

  return {
    conferences,
    model: TARGETED_CONFERENCE_MODEL,
    effort: 'low',
    candidateCount,
    validatedCount: validated.length,
    outputWasJson: typeof result.output !== 'string',
    groupCount: 1,
    groupErrors: 0,
  }
}
