import 'server-only'

import { runAiMessage, webSearchTool, wrapExternalData } from './client'
import type { AiModelId, AiReasoningEffort } from './models'
import type { OrgFeedConfig } from './org-feed-config'

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
  /** The configured topic/theme/mention group this item was found for. */
  topic: string | null
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
  groupCount: number
  groupErrors: number
  rawResponse?: unknown
}

export type SearchGroupKind = 'topic' | 'theme' | 'mention'
export type SearchGroup = { key: string; label: string; kind: SearchGroupKind; query: string }

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
 * The stable, cacheable system prefix shared across every per-group search in a
 * run (org profile, region, source preferences, rules). The specific
 * topic/theme/mention to search for is supplied per group in the user message,
 * so this prefix is identical across calls and gets prompt-cached.
 */
export function buildNewsfeedSystemPrompt(config: OrgFeedConfig): string {
  const lines: Array<string | null> = [
    'You find recent, citation-backed items for the Inspire2Live communications team news feed.',
    ORG_PROFILE,
    '',
    `Region focus: ${config.region ?? 'global'}.`,
    config.allowedSources.length > 0 ? `Prefer these source domains (not exclusive): ${config.allowedSources.join(', ')}.` : null,
    config.blockedSources.length > 0 ? `Never use these source domains: ${config.blockedSources.join(', ')}.` : null,
    '',
    'Rules (each request is small and bounded — do not over-search):',
    '- Use the web_search tool to find real, recent items. Never invent a story or a URL.',
    '- Every item MUST include a working sourceUrl copied from a real search result (mandatory citation).',
    '- Use at most 2 searches, then return ONLY schema-valid JSON — nothing else.',
    '- Keep headlines factual; summaries are 1-2 neutral sentences. Tailor relevance 0-100.',
    '- Prefer reputable sources; exclude blocked domains. Set mentionOf to null unless the request is about a specific watched entity.',
  ]
  return lines.filter((line) => line !== null).join('\n')
}

// Mention monitoring fans out across several groups so many tracked names get
// real coverage (a single group with a long name list dilutes the search).
const MENTION_BATCH = 5
const MAX_MENTION_GROUPS = 4

/**
 * Split the editorial brief into small, focused search groups: one per topic,
 * one per theme, and several mention groups (the org + tracked people batched).
 * Bounded by `max` so a big config can't spawn an unbounded number of calls;
 * mentions are prioritised so they're never dropped.
 */
export function buildSearchGroups(config: OrgFeedConfig, watched?: WatchedEntities, max = 8): SearchGroup[] {
  const mentionGroups: SearchGroup[] = []
  const mentionNames = [...(watched?.organizations ?? []), ...(watched?.people ?? [])]
  for (let i = 0; i < mentionNames.length && mentionGroups.length < MAX_MENTION_GROUPS; i += MENTION_BATCH) {
    const batch = mentionNames.slice(i, i + MENTION_BATCH)
    mentionGroups.push({
      key: `mentions:${i}`,
      label: 'Mentions',
      kind: 'mention',
      query: batch.join('; '),
    })
  }

  const topicGroups: SearchGroup[] = config.topics.map((topic) => ({
    key: `topic:${topic.toLowerCase()}`,
    label: topic,
    kind: 'topic',
    query: `recent cancer / patient-advocacy news about "${topic}"`,
  }))
  const themeGroups: SearchGroup[] = config.themes.map((theme) => ({
    key: `theme:${theme.toLowerCase()}`,
    label: theme,
    kind: 'theme',
    query: `recent developments relevant to the theme "${theme}"`,
  }))

  // Mentions first (prioritised), then topics, then themes — capped.
  return [...mentionGroups, ...topicGroups, ...themeGroups].slice(0, max)
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

/**
 * Coerce a model-provided published date into a valid ISO timestamp, or null.
 * The model often returns partial/loose values ("2025", "2025-06", "June 2025")
 * that a Postgres timestamptz column rejects. Date.parse handles those (a bare
 * year becomes Jan 1), and anything unparseable or implausible becomes null.
 */
export function toIsoTimestamp(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  const ms = Date.parse(text)
  if (Number.isNaN(ms)) return null
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  if (year < 1990 || year > 2100) return null
  return date.toISOString()
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
    publishedAt: toIsoTimestamp(raw.publishedAt),
    mentionOf: nullableString(raw.mentionOf, 160),
    topic: null,
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

// Per-group tuning. Each group is a small, fast, bounded search; they run with
// limited concurrency so the whole fan-out completes inside the 300s function.
const GROUP_TIMEOUT_MS = 60_000
const GROUP_ITEMS = 4
const MENTION_GROUP_ITEMS = 8
const GROUP_CONCURRENCY = 4
const TOTAL_ITEM_CAP = 40

type GroupResult = {
  items: NewsFeedItem[]
  candidates: number
  validated: number
  outputWasJson: boolean
  error: boolean
  model: string | null
  effort: AiReasoningEffort | null
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

function buildTopicInstruction(query: string): string {
  return `Find up to ${GROUP_ITEMS} recent, high-relevance items: ${query}. Use at most 2 searches, then return the JSON. Fewer well-cited items is fine.`
}

/**
 * Mention monitoring is deliberately broad: any public reference to the name —
 * across news, articles, press AND social media (LinkedIn, X/Twitter, etc.) —
 * including posts ABOUT the person, posts that TAG/quote/interview them, panels,
 * awards, and announcements. More results is fine; they get filtered later.
 */
function buildMentionInstruction(names: string): string {
  return [
    `Search for ANY recent public mention of these people/organizations: ${names}.`,
    'Look across news, articles, press releases, blogs, AND social media — LinkedIn, X/Twitter, YouTube, etc. Include posts ABOUT them, posts where they are TAGGED, quoted, or interviewed, panel/conference appearances, awards, and announcements.',
    'Match the name even when no email or affiliation is given — a name match is enough. Cast a wide net: return up to ' + MENTION_GROUP_ITEMS + ' items, err toward including rather than excluding (low-relevance is OK, it will be filtered later).',
    'For each item set category to "mention" and mentionOf to the exact matched name. Use at most 2 searches, then return the JSON.',
  ].join(' ')
}

/** Run one focused search group and tag its items with the group label. */
async function generateGroup(
  group: SearchGroup,
  config: OrgFeedConfig,
  system: string,
  existingHeadlines: string[],
  createdBy: string | null,
  model?: AiModelId,
  effort?: AiReasoningEffort
): Promise<GroupResult> {
  const existingContext = wrapExternalData(
    'newsfeed.existing',
    JSON.stringify({ existingHeadlines: existingHeadlines.slice(0, 40), note: 'Do not repeat these.' })
  )
  try {
    const result = await runAiMessage<unknown>({
      feature: 'org_newsfeed_group',
      workload: 'org_newsfeed',
      model,
      effort,
      maxTokens: group.kind === 'mention' ? 3500 : 2500,
      timeoutMs: GROUP_TIMEOUT_MS,
      retries: 0,
      createdBy,
      system,
      cacheSystemPrompt: true,
      tools: [webSearchTool({ maxUses: 2, blockedDomains: config.blockedSources })],
      structuredFormat: {
        type: 'json_schema',
        name: 'org_news_feed',
        description: 'Recent, citation-backed news items for one topic.',
        schema: NEWS_FEED_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
      messages: [
        {
          role: 'user',
          content: [group.kind === 'mention' ? buildMentionInstruction(group.query) : buildTopicInstruction(group.query), existingContext].join('\n\n'),
        },
      ],
    })
    const candidates = itemsArray(result.output).length
    const validated = validateNewsFeedItems(result.output, config.blockedSources)
    const items = validated.map((item) => ({ ...item, topic: group.label }))
    return {
      items,
      candidates,
      validated: validated.length,
      outputWasJson: typeof result.output !== 'string',
      error: false,
      model: result.config.model,
      effort: result.config.effort,
    }
  } catch (error) {
    console.error(`[newsfeed] group "${group.label}" failed`, error)
    return { items: [], candidates: 0, validated: 0, outputWasJson: true, error: true, model: null, effort: null }
  }
}

/**
 * Assemble an org-wide news feed by fanning out into small, focused per-group
 * searches (one per topic/theme + one for mentions), then consolidating and
 * deduplicating. Each group is bounded and resilient — one slow/failed group
 * does not sink the others. Citations are mandatory and stored as source_url.
 */
export async function generateOrgNewsfeed(input: GenerateOrgNewsfeedInput): Promise<OrgNewsfeedResult> {
  const { config, watched } = input
  const groups = buildSearchGroups(config, watched)
  const system = buildNewsfeedSystemPrompt(config)
  const existingHeadlines = input.existingHeadlines ?? []

  const groupResults = await mapWithConcurrency(groups, GROUP_CONCURRENCY, (group) =>
    generateGroup(group, config, system, existingHeadlines, input.createdBy ?? null, input.model, input.effort)
  )

  let candidateCount = 0
  let validatedCount = 0
  let outputWasJson = true
  let groupErrors = 0
  let model: string | null = null
  let effort: AiReasoningEffort | null = null
  const allItems: NewsFeedItem[] = []
  for (const result of groupResults) {
    candidateCount += result.candidates
    validatedCount += result.validated
    if (!result.outputWasJson) outputWasJson = false
    if (result.error) groupErrors += 1
    if (!model && result.model) model = result.model
    if (!effort && result.effort) effort = result.effort
    allItems.push(...result.items)
  }

  const deduped = dedupeNewsItems(allItems, input.existingUrls).slice(0, input.maxItems ?? TOTAL_ITEM_CAP)

  return {
    items: deduped,
    model,
    effort,
    candidateCount,
    validatedCount,
    outputWasJson,
    groupCount: groups.length,
    groupErrors,
  }
}
