export type AiModelId =
  | 'claude-opus-4-8'
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'claude-fable-5'

export type AiReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

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

export const DEFAULT_AI_MODEL: AiModelId = 'claude-opus-4-8'
export const DEFAULT_AI_EFFORT: AiReasoningEffort = 'high'

export const AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    description: 'Default for complex strategy, long transcripts, and reasoning-heavy monitoring.',
    defaultEffort: 'high',
    allowedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    inputCostPerMillionTokens: 15,
    outputCostPerMillionTokens: 75,
    cacheReadCostPerMillionTokens: 1.5,
    cacheWriteCostPerMillionTokens: 18.75,
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    description: 'High-quality fallback for complex reasoning workloads.',
    defaultEffort: 'high',
    allowedEfforts: ['low', 'medium', 'high', 'xhigh'],
    inputCostPerMillionTokens: 15,
    outputCostPerMillionTokens: 75,
    cacheReadCostPerMillionTokens: 1.5,
    cacheWriteCostPerMillionTokens: 18.75,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Balanced model for frequent classification, extraction, and short summaries.',
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
    description: 'Lowest-latency option for lightweight classification only.',
    defaultEffort: 'none',
    allowedEfforts: ['none'],
    inputCostPerMillionTokens: 0.8,
    outputCostPerMillionTokens: 4,
    cacheReadCostPerMillionTokens: 0.08,
    cacheWriteCostPerMillionTokens: 1,
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

export function getAiModelCatalogEntry(model: string): AiModelCatalogEntry | null {
  return AI_MODEL_CATALOG.find((entry) => entry.id === model) ?? null
}

export function isAiModelId(model: string): model is AiModelId {
  return getAiModelCatalogEntry(model) !== null
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
