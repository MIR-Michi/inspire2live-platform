export type AiModelId =
  | 'claude-opus-4-8'
  | 'claude-opus-4-7'
  | 'claude-sonnet-5'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'claude-fable-5'

export type AiReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type AiModelSelection = {
  model: AiModelId
  effort: AiReasoningEffort
}

export type AiModelCatalogEntry = {
  id: AiModelId
  label: string
  description: string
  defaultEffort: AiReasoningEffort
  allowedEfforts: readonly AiReasoningEffort[]
  inputCostPerMillionTokens: number
  outputCostPerMillionTokens: number
  cacheReadCostPerMillionTokens?: number
  cacheWriteCostPerMillionTokens?: number
}

export type AiWorkloadId =
  | 'intake_structure'
  | 'meeting_summary'
  | 'meeting_summary_chunk'
  | 'org_newsfeed'
  | 'conference_discovery'
  | 'conference_detail'
  | 'personal_monitoring'
  | 'lightweight_backfill'

export type AiWorkloadPolicy = {
  id: AiWorkloadId
  section: string
  label: string
  description: string
  recommendedModel: AiModelId
  recommendedEffort: AiReasoningEffort
  recommendation: string
}

export type AiWorkloadOverrides = Partial<Record<AiWorkloadId, AiModelSelection>>

export const DEFAULT_AI_MODEL: AiModelId = 'claude-opus-4-8'
export const DEFAULT_AI_EFFORT: AiReasoningEffort = 'high'

export const AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    description: 'Default for complex strategy, long transcripts, and reasoning-heavy monitoring.',
    defaultEffort: 'high',
    allowedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    inputCostPerMillionTokens: 5,
    outputCostPerMillionTokens: 25,
    cacheReadCostPerMillionTokens: 0.5,
    cacheWriteCostPerMillionTokens: 6.25,
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    description: 'High-quality fallback for complex reasoning workloads.',
    defaultEffort: 'high',
    allowedEfforts: ['low', 'medium', 'high', 'xhigh'],
    inputCostPerMillionTokens: 5,
    outputCostPerMillionTokens: 25,
    cacheReadCostPerMillionTokens: 0.5,
    cacheWriteCostPerMillionTokens: 6.25,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    description: 'Current Sonnet — near-Opus quality on coding, classification, extraction, and summaries at Sonnet cost.',
    defaultEffort: 'medium',
    allowedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    inputCostPerMillionTokens: 3,
    outputCostPerMillionTokens: 15,
    cacheReadCostPerMillionTokens: 0.3,
    cacheWriteCostPerMillionTokens: 3.75,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Previous-generation Sonnet for frequent classification, extraction, search, and short summaries.',
    defaultEffort: 'medium',
    allowedEfforts: ['low', 'medium', 'high', 'max'],
    inputCostPerMillionTokens: 3,
    outputCostPerMillionTokens: 15,
    cacheReadCostPerMillionTokens: 0.3,
    cacheWriteCostPerMillionTokens: 3.75,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    description: 'Lowest-latency option for lightweight classification and simple backfills.',
    defaultEffort: 'none',
    allowedEfforts: ['none'],
    inputCostPerMillionTokens: 1,
    outputCostPerMillionTokens: 5,
    cacheReadCostPerMillionTokens: 0.1,
    cacheWriteCostPerMillionTokens: 1.25,
  },
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    description: 'Reserved catalog slot for future narrative or writing-heavy workloads.',
    defaultEffort: 'medium',
    allowedEfforts: ['low', 'medium', 'high'],
    inputCostPerMillionTokens: 5,
    outputCostPerMillionTokens: 25,
    cacheReadCostPerMillionTokens: 0.5,
    cacheWriteCostPerMillionTokens: 6.25,
  },
] as const

export const AI_WORKLOAD_POLICIES: readonly AiWorkloadPolicy[] = [
  {
    id: 'intake_structure',
    section: 'Intake',
    label: 'Structure incoming content',
    description: 'Classifies WhatsApp/email/shared-link intake items and proposes a reviewable destination.',
    recommendedModel: 'claude-haiku-4-5',
    recommendedEffort: 'none',
    recommendation: 'Haiku is sufficient for high-volume, low-risk classification because deterministic fallback and human review remain in place.',
  },
  {
    id: 'meeting_summary',
    section: 'Meetings',
    label: 'Meeting transcript summaries',
    description: 'Creates TL;DR, decisions, action items, speakers, and a publication blurb from uploaded transcripts.',
    recommendedModel: 'claude-opus-4-8',
    recommendedEffort: 'high',
    recommendation: 'Use Opus for long or important transcripts where attribution and missing decisions matter. Sonnet can be selected for routine short meetings.',
  },
  {
    id: 'meeting_summary_chunk',
    section: 'Meetings',
    label: 'Long transcript chunk notes',
    description: 'Summarizes individual chunks before the final reduce pass for very long transcripts.',
    recommendedModel: 'claude-sonnet-4-6',
    recommendedEffort: 'medium',
    recommendation: 'Sonnet is a good cost/quality balance for chunk notes; the final reduce can stay on Opus.',
  },
  {
    id: 'org_newsfeed',
    section: 'News feed',
    label: 'Organization news feed',
    description: 'Runs cited web-search groups for organization topics, themes, and public mentions.',
    recommendedModel: 'claude-sonnet-4-6',
    recommendedEffort: 'low',
    recommendation: 'Sonnet handles search, citation filtering, and relevance ranking more reliably than Haiku while staying cost-conscious.',
  },
  {
    id: 'conference_discovery',
    section: 'Conferences',
    label: 'Conference discovery',
    description: 'Finds real upcoming oncology conferences with dates, regions, URLs, and relevance scores.',
    recommendedModel: 'claude-sonnet-4-6',
    recommendedEffort: 'low',
    recommendation: 'Sonnet is recommended because the job needs factual search, date validation, dedupe, and citation discipline.',
  },
  {
    id: 'conference_detail',
    section: 'Conferences',
    label: 'Conference detail enrichment',
    description: 'Enriches one conference with overview, relevance, speakers, registration deadlines, fees, and links.',
    recommendedModel: 'claude-sonnet-4-6',
    recommendedEffort: 'low',
    recommendation: 'Sonnet gives more reliable factual enrichment than Haiku for registration and fee details.',
  },
  {
    id: 'personal_monitoring',
    section: 'Monitoring',
    label: 'Per-user public monitoring',
    description: 'Finds public mentions for user watches, tracked people, topics, and CRM-linked contacts.',
    recommendedModel: 'claude-sonnet-4-6',
    recommendedEffort: 'medium',
    recommendation: 'Use Sonnet for relevance filtering and lower false positives. Public monitoring should stay cited and reviewable.',
  },
  {
    id: 'lightweight_backfill',
    section: 'Backfills',
    label: 'Historical lightweight backfills',
    description: 'Bulk reclassification or simple extraction where latency does not matter and results are reviewable.',
    recommendedModel: 'claude-haiku-4-5',
    recommendedEffort: 'none',
    recommendation: 'Haiku keeps backfill costs low; use Batch API where possible for additional savings.',
  },
] as const

export function getAiModelCatalogEntry(model: string): AiModelCatalogEntry | null {
  return AI_MODEL_CATALOG.find((entry) => entry.id === model) ?? null
}

export function getAiWorkloadPolicy(workload: string): AiWorkloadPolicy | null {
  return AI_WORKLOAD_POLICIES.find((entry) => entry.id === workload) ?? null
}

export function isAiModelId(model: string): model is AiModelId {
  return getAiModelCatalogEntry(model) !== null
}

export function isAiWorkloadId(workload: string): workload is AiWorkloadId {
  return getAiWorkloadPolicy(workload) !== null
}

export function isAiReasoningEffort(effort: string): effort is AiReasoningEffort {
  return ['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(effort)
}

export function normalizeAiModel(model?: string | null): AiModelId {
  return model && isAiModelId(model) ? model : DEFAULT_AI_MODEL
}

export function normalizeAiEffort(model: AiModelId, effort?: string | null): AiReasoningEffort {
  const catalogEntry = getAiModelCatalogEntry(model)
  if (!catalogEntry) return DEFAULT_AI_EFFORT
  if (effort && isAiReasoningEffort(effort) && catalogEntry.allowedEfforts.includes(effort)) return effort
  return catalogEntry.defaultEffort
}

export function normalizeAiModelSelection(
  model?: string | null,
  effort?: string | null,
  fallback: AiModelSelection = { model: DEFAULT_AI_MODEL, effort: DEFAULT_AI_EFFORT }
): AiModelSelection {
  const normalizedModel = model && isAiModelId(model) ? model : fallback.model
  return { model: normalizedModel, effort: normalizeAiEffort(normalizedModel, effort ?? fallback.effort) }
}

export function getRecommendedSelection(workload: AiWorkloadId): AiModelSelection {
  const policy = getAiWorkloadPolicy(workload)
  if (!policy) return { model: DEFAULT_AI_MODEL, effort: DEFAULT_AI_EFFORT }
  return normalizeAiModelSelection(policy.recommendedModel, policy.recommendedEffort)
}

export function normalizeAiWorkloadOverrides(value: unknown): AiWorkloadOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const out: AiWorkloadOverrides = {}
  for (const policy of AI_WORKLOAD_POLICIES) {
    const raw = (value as Record<string, unknown>)[policy.id]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const entry = raw as Record<string, unknown>
    const fallback = getRecommendedSelection(policy.id)
    out[policy.id] = normalizeAiModelSelection(
      typeof entry.model === 'string' ? entry.model : null,
      typeof entry.effort === 'string' ? entry.effort : null,
      fallback
    )
  }
  return out
}

export function getAiWorkloadSelection(
  workload: AiWorkloadId | undefined,
  overrides: AiWorkloadOverrides,
  globalDefault: AiModelSelection
): AiModelSelection {
  if (!workload) return globalDefault
  return overrides[workload] ?? getRecommendedSelection(workload)
}

export function validateAiModelEffort(model: string, effort: string): { ok: true } | { ok: false; message: string } {
  const catalogEntry = getAiModelCatalogEntry(model)
  if (!catalogEntry) return { ok: false, message: `Unsupported AI model: ${model}` }
  if (!isAiReasoningEffort(effort)) return { ok: false, message: `Unsupported reasoning effort: ${effort}` }
  if (!catalogEntry.allowedEfforts.includes(effort)) {
    return {
      ok: false,
      message: `${catalogEntry.label} supports only: ${catalogEntry.allowedEfforts.join(', ')}`,
    }
  }
  return { ok: true }
}

export function estimateAiCostUsd(params: {
  model: AiModelId
  inputTokens?: number
  outputTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
}): number {
  const entry = getAiModelCatalogEntry(params.model)
  if (!entry) return 0

  const input = (params.inputTokens ?? 0) * entry.inputCostPerMillionTokens
  const output = (params.outputTokens ?? 0) * entry.outputCostPerMillionTokens
  const cacheWrite = (params.cacheCreationInputTokens ?? 0) * (entry.cacheWriteCostPerMillionTokens ?? entry.inputCostPerMillionTokens)
  const cacheRead = (params.cacheReadInputTokens ?? 0) * (entry.cacheReadCostPerMillionTokens ?? entry.inputCostPerMillionTokens)

  return Number(((input + output + cacheWrite + cacheRead) / 1_000_000).toFixed(6))
}
