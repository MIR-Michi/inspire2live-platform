import 'server-only'

import { runAiMessage, webSearchTool, wrapExternalData } from './client'
import type { AiModelId, AiReasoningEffort } from './models'
import type { OrgFeedConfig } from './org-feed-config'

// Per the model-per-workload policy: the news feed is a web-search aggregation
// job, best served by a fast balanced model, not the heavy reasoning default.
const NEWSFEED_MODEL: AiModelId = 'claude-sonnet-4-6'
// Web search + compilation is slow; allow well beyond the 60s wrapper default
// (but under the 300s serverless cap).
const NEWSFEED_TIMEOUT_MS = 280_000

export type NewsFeedItem = {
  headline: string
  summary: string | null
  category: string
  region: string | null
  sourceUrl: string
  sourceName: string | null
  relevance: number
  publishedAt: string | null
  mentionOf: string | null
}

export type WatchedEntities = {
  organizations: string[]
  people: string[]
}

export type OrgNewsfeedResult = {
  items: NewsFeedItem[]
  model: string | null
  effort: AiReasoningEffort | null
  // Diagnostics: how many items the model returned, how many were valid, and
  // whether the output was non-JSON — so a 0-result run is explainable.
  candidateCount: number
  validatedCount: number
  outputWasJson: boolean
  rawResponse?: unknown
}

export type GenerateOrgNewsfeedInput = {
  config: OrgFeedConfig
  watched?: WatchedEntities
  existingUrls?: string[]
  existingHeadlines?: string[]
  maxItems?: number
  createdBy?: string | null
  model?: AiModelId
  effort?: AiReasoningEffort
}

const NEWS_CATEGORIES = ['medical', 'research', 'policy', 'advocacy', 'funding', 'event', 'mention', 'other']

export const NEWS_FEED_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'sourceUrl', 'category', 'relevance'],
        properties: {
          headline: { type: 'string', minLength: 1, maxLength: 240 },
          summary: { type: ['string', 'null'], maxLength: 600 },
          category: { type: 'string', enum: NEWS_CATEGORIES },
          region: { type: ['string', 'null'], maxLength: 120 },
          // Mandatory citation — every item must be traceable to a source.
          sourceUrl: { type: 'string', minLength: 1, maxLength: 1000 },
          sourceName: { type: ['string', 'null'], maxLength: 160 },
          relevance: { type: 'integer', minimum: 0, maximum: 100 },
          publishedAt: { type: ['string', 'null'], maxLength: 40 },
          // The watched entity (org alias or person) the item mentions, if any.
          mentionOf: { type: ['string', 'null'], maxLength: 160 },
        },
      },
    },
  },
} as const

const ORG_PROFILE = `Inspire2Live is an international patient-driven cancer organization. Its mission is to turn cancer into a curable or chronically manageable disease, working through patient advocates, World Campus collaborations, research initiatives, and global partnerships.`

/**
 * The stable, cacheable system prefix: org profile + the admin's feed config.
 * Reused verbatim across every call in a job so it can be prompt-cached.
 */
export function buildNewsfeedSystemPrompt(config: OrgFeedConfig, watched?: WatchedEntities): string {
  const organizations = watched?.organizations ?? []
  const people = watched?.people ?? []
  const hasMentions = organizations.length > 0 || people.length > 0

  const lines: Array<string | null> = [
    'You assemble an organization-wide news feed for the Inspire2Live communications team.',
    ORG_PROFILE,
    '',
    'Monitoring configuration (treat as the editorial brief):',
    `- Topics: ${config.topics.length > 0 ? config.topics.join(', ') : '(none specified)'}`,
    `- Themes: ${config.themes.length > 0 ? config.themes.join(', ') : '(none specified)'}`,
    `- Region focus: ${config.region ?? 'global'}`,
    config.allowedSources.length > 0 ? `- Prefer these source domains: ${config.allowedSources.join(', ')}` : null,
    config.blockedSources.length > 0 ? `- Never use these source domains: ${config.blockedSources.join(', ')}` : null,
  ]

  if (hasMentions) {
    lines.push('')
    lines.push('Mention monitoring (also surface recent PUBLIC mentions of these entities — news, articles, press, blogs, and public social-media posts):')
    if (organizations.length > 0) lines.push(`- Organizations: ${organizations.join(', ')}`)
    if (people.length > 0) lines.push(`- People: ${people.join(', ')}`)
    lines.push('For a mention item, set category to "mention" and mentionOf to the exact watched entity it is about. Only public information — never private accounts or personal data.')
  }

  lines.push('')
  lines.push('Rules:')
  lines.push('- Use the web_search tool to find recent, real items. Never invent a story or a URL.')
  lines.push('- Every item MUST include a working sourceUrl copied from a real search result (mandatory citation).')
  lines.push('- Tailor relevance (0-100) to how directly the item serves the topics, themes, mission, and watched entities.')
  lines.push('- Prefer reputable sources. Exclude blocked domains entirely.')
  lines.push('- Keep headlines factual; summaries are 1-2 neutral sentences.')
  lines.push('- Set mentionOf to null for general topical news that is not about a watched entity.')
  lines.push('- Return only schema-valid JSON.')

  return lines.filter((line) => line !== null).join('\n')
}

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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Normalize a URL for dedupe: lowercase host, drop fragment + trailing slash. */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim())
    url.hash = ''
    let normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.search}`
    normalized = normalized.replace(/\/$/, '')
    return normalized.toLowerCase()
  } catch {
    return raw.trim().toLowerCase().replace(/\/$/, '')
  }
}

function hostFromUrl(raw: string): string | null {
  try {
    return new URL(raw).host.replace(/^www\./, '')
  } catch {
    return null
  }
}

function normalizeCategory(value: unknown): string {
  const text = asString(value).toLowerCase()
  return NEWS_CATEGORIES.includes(text) ? text : 'other'
}

function normalizeItem(value: unknown, blockedSources: string[]): NewsFeedItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const headline = asString(raw.headline)
  const sourceUrl = asString(raw.sourceUrl)
  if (!headline || !sourceUrl || !isHttpUrl(sourceUrl)) return null

  // Enforce the blocked-source list even if the model ignored it.
  const host = hostFromUrl(sourceUrl)
  if (host && blockedSources.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null

  return {
    headline: headline.slice(0, 240),
    summary: nullableString(raw.summary, 600),
    category: normalizeCategory(raw.category),
    region: nullableString(raw.region, 120),
    sourceUrl: sourceUrl.slice(0, 1000),
    sourceName: nullableString(raw.sourceName, 160) ?? host,
    relevance: clampRelevance(raw.relevance),
    publishedAt: nullableString(raw.publishedAt, 40),
    mentionOf: nullableString(raw.mentionOf, 160),
  }
}

function itemsArray(value: unknown): unknown[] {
  const container = value && typeof value === 'object' && 'items' in value ? (value as { items?: unknown }).items : value
  return Array.isArray(container) ? container : []
}

/** Validate the raw model output into a clean list of news items. */
export function validateNewsFeedItems(value: unknown, blockedSources: string[] = []): NewsFeedItem[] {
  return itemsArray(value)
    .map((item) => normalizeItem(item, blockedSources))
    .filter((item): item is NewsFeedItem => Boolean(item))
}

/**
 * Drop items whose URL already exists (against stored items) or repeats within
 * the batch. Returns the deduped list.
 */
export function dedupeNewsItems(items: NewsFeedItem[], existingUrls: string[] = []): NewsFeedItem[] {
  const seen = new Set(existingUrls.map(normalizeUrl))
  const out: NewsFeedItem[] = []
  for (const item of items) {
    const key = normalizeUrl(item.sourceUrl)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/**
 * Assemble an org-wide news feed via web search + structured output, driven by
 * the admin's feed config. Citations are mandatory and stored as source_url.
 */
export async function generateOrgNewsfeed(input: GenerateOrgNewsfeedInput): Promise<OrgNewsfeedResult> {
  const { config, watched } = input
  const maxItems = input.maxItems ?? 12
  const hasMentions = (watched?.organizations.length ?? 0) > 0 || (watched?.people.length ?? 0) > 0

  const existingContext = wrapExternalData(
    'newsfeed.existing',
    JSON.stringify({
      existingHeadlines: (input.existingHeadlines ?? []).slice(0, 60),
      note: 'Do not repeat items already covered by these headlines or their URLs.',
    })
  )

  const result = await runAiMessage<unknown>({
    feature: 'org_newsfeed',
    model: input.model ?? NEWSFEED_MODEL,
    effort: input.effort ?? 'medium',
    maxTokens: 6000,
    timeoutMs: NEWSFEED_TIMEOUT_MS,
    retries: 1,
    createdBy: input.createdBy,
    system: buildNewsfeedSystemPrompt(config, watched),
    cacheSystemPrompt: true,
    tools: [
      // NB: allowed_domains is a HARD restriction in the web-search tool and
      // starves results when only a few domains are listed (e.g. google.com).
      // We keep allowed domains as a SOFT preference in the prompt and only use
      // blocked_domains as a hard filter here.
      webSearchTool({
        maxUses: 6,
        blockedDomains: config.blockedSources,
      }),
    ],
    structuredFormat: {
      type: 'json_schema',
      name: 'org_news_feed',
      description: 'A list of recent, citation-backed news items for the organization feed.',
      schema: NEWS_FEED_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    messages: [
      {
        role: 'user',
        content: [
          `Find up to ${maxItems} recent items that match the monitoring brief — a mix of topical news${hasMentions ? ' and recent public mentions of the watched organizations and people' : ''}. Search the web, then return the structured JSON. Each item needs a real sourceUrl.`,
          existingContext,
        ].join('\n\n'),
      },
    ],
  })

  const candidateCount = itemsArray(result.output).length
  const validated = validateNewsFeedItems(result.output, config.blockedSources)
  const deduped = dedupeNewsItems(validated, input.existingUrls).slice(0, maxItems)

  return {
    items: deduped,
    model: result.config.model,
    effort: result.config.effort,
    candidateCount,
    validatedCount: validated.length,
    outputWasJson: typeof result.output !== 'string',
    rawResponse: result.rawResponse,
  }
}
