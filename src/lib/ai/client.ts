import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptAiSecret } from './crypto'
import { requireAiEnabled } from './feature-flag'
import {
  DEFAULT_AI_EFFORT,
  DEFAULT_AI_MODEL,
  estimateAiCostUsd,
  normalizeAiEffort,
  normalizeAiModel,
  validateAiModelEffort,
  type AiModelId,
  type AiReasoningEffort,
} from './models'

type AiSettingsRow = {
  api_key_ciphertext: string | null
  model: string | null
  effort: string | null
}

export type AiConfig = {
  apiKey: string
  model: AiModelId
  effort: AiReasoningEffort
  source: 'database' | 'environment'
}

export type AiStructuredFormat = {
  type: 'json_schema'
  name: string
  description?: string
  schema: Record<string, unknown>
}

export type AiMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type RunAiMessageInput = {
  feature: string
  messages: AiMessage[]
  system?: string
  model?: AiModelId
  effort?: AiReasoningEffort
  maxTokens?: number
  temperature?: number
  structuredFormat?: AiStructuredFormat
  timeoutMs?: number
  retries?: number
  createdBy?: string | null
  requireFeatureFlag?: boolean
  apiKeyOverride?: string
}

export type AiUsage = {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  estimatedCostUsd: number
  latencyMs: number
}

export type AiRunResult<T = string> = {
  output: T
  rawResponse: unknown
  config: Omit<AiConfig, 'apiKey'>
  usage: AiUsage
}

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiConfigurationError'
  }
}

export class AiProviderError extends Error {
  code: string

  constructor(message: string, code = 'provider_error') {
    super(message)
    this.name = 'AiProviderError'
    this.code = code
  }
}

let cachedClient: { apiKey: string; timeoutMs: number; client: Anthropic } | null = null

function getAnthropicClient(apiKey: string, timeoutMs: number): Anthropic {
  if (cachedClient?.apiKey === apiKey && cachedClient.timeoutMs === timeoutMs) return cachedClient.client
  const client = new Anthropic({ apiKey, timeout: timeoutMs })
  cachedClient = { apiKey, timeoutMs, client }
  return client
}

export async function resolveAiConfig(overrides?: {
  apiKeyOverride?: string
  model?: AiModelId
  effort?: AiReasoningEffort
}): Promise<AiConfig> {
  if (overrides?.apiKeyOverride) {
    const model = overrides.model ?? DEFAULT_AI_MODEL
    const effort = normalizeAiEffort(model, overrides.effort ?? DEFAULT_AI_EFFORT)
    return { apiKey: overrides.apiKeyOverride, model, effort, source: 'environment' }
  }

  const db = createAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: AiSettingsRow | null; error: { message: string } | null }> }
      }
    }
  }

  const { data, error } = await db
    .from('ai_settings')
    .select('api_key_ciphertext, model, effort')
    .eq('singleton', true)
    .maybeSingle()

  if (error) throw new AiConfigurationError(`Failed to load AI settings: ${error.message}`)

  const model = normalizeAiModel(overrides?.model ?? data?.model ?? DEFAULT_AI_MODEL)
  const effort = normalizeAiEffort(model, overrides?.effort ?? data?.effort ?? DEFAULT_AI_EFFORT)

  if (data?.api_key_ciphertext) {
    return { apiKey: decryptAiSecret(data.api_key_ciphertext), model, effort, source: 'database' }
  }

  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!envKey) throw new AiConfigurationError('Anthropic is not configured')
  return { apiKey: envKey, model, effort, source: 'environment' }
}

export function zodToOutputConfig(params: {
  name: string
  description?: string
  schema: { toJSONSchema?: () => unknown; toJSON?: () => unknown } | Record<string, unknown>
}): { format: AiStructuredFormat } {
  const rawSchema = 'toJSONSchema' in params.schema && typeof params.schema.toJSONSchema === 'function'
    ? params.schema.toJSONSchema()
    : 'toJSON' in params.schema && typeof params.schema.toJSON === 'function'
      ? params.schema.toJSON()
      : params.schema

  if (!rawSchema || typeof rawSchema !== 'object') {
    throw new AiConfigurationError('Structured AI output requires a JSON-schema-compatible object')
  }

  return {
    format: {
      type: 'json_schema',
      name: params.name,
      description: params.description,
      schema: rawSchema as Record<string, unknown>,
    },
  }
}

export function wrapExternalData(label: string, value: string): string {
  return [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n')
}

export async function runAiMessage<T = string>(input: RunAiMessageInput): Promise<AiRunResult<T>> {
  if (input.requireFeatureFlag !== false) requireAiEnabled()

  const startedAt = Date.now()
  const timeoutMs = input.timeoutMs ?? 60_000
  const config = await resolveAiConfig({
    apiKeyOverride: input.apiKeyOverride,
    model: input.model,
    effort: input.effort,
  })

  const validation = validateAiModelEffort(config.model, config.effort)
  if (!validation.ok) throw new AiConfigurationError(validation.message)

  const client = getAnthropicClient(config.apiKey, timeoutMs)
  const request = buildMessageRequest(input, config)

  try {
    const rawResponse = await client.messages.create(request as never)
    const usage = usageFromResponse(rawResponse, config.model, Date.now() - startedAt)
    await logAiUsage({ input, config, usage, success: true })
    return {
      output: parseOutput<T>(rawResponse, Boolean(input.structuredFormat)),
      rawResponse,
      config: { model: config.model, effort: config.effort, source: config.source },
      usage,
    }
  } catch (error) {
    const normalized = normalizeProviderError(error)
    await logAiUsage({
      input,
      config,
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedCostUsd: 0, latencyMs: Date.now() - startedAt },
      success: false,
      error: normalized,
    })
    throw normalized
  }
}

export async function testAiConnection(params?: {
  apiKeyOverride?: string
  model?: AiModelId
  effort?: AiReasoningEffort
}): Promise<{ ok: true; latencyMs: number; model: AiModelId; source: AiConfig['source'] } | { ok: false; error: string }> {
  try {
    const result = await runAiMessage({
      feature: 'admin_connection_test',
      apiKeyOverride: params?.apiKeyOverride,
      model: params?.model,
      effort: params?.effort,
      requireFeatureFlag: false,
      maxTokens: 32,
      messages: [{ role: 'user', content: 'Return the word ok.' }],
    })
    return { ok: true, latencyMs: result.usage.latencyMs, model: result.config.model, source: result.config.source }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function buildMessageRequest(input: RunAiMessageInput, config: AiConfig): Record<string, unknown> {
  const request: Record<string, unknown> = {
    model: config.model,
    max_tokens: input.maxTokens ?? 1024,
    messages: input.messages,
  }

  if (input.system) request.system = input.system
  if (typeof input.temperature === 'number') request.temperature = input.temperature
  if (config.effort !== 'none') request.thinking = { type: 'adaptive', effort: config.effort }
  if (input.structuredFormat) request.output_config = { format: input.structuredFormat }

  return request
}

function usageFromResponse(rawResponse: unknown, model: AiModelId, latencyMs: number): AiUsage {
  const usage = typeof rawResponse === 'object' && rawResponse !== null && 'usage' in rawResponse
    ? (rawResponse as { usage?: Record<string, number | undefined> }).usage
    : undefined

  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const cacheCreationInputTokens = usage?.cache_creation_input_tokens ?? 0
  const cacheReadInputTokens = usage?.cache_read_input_tokens ?? 0

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    estimatedCostUsd: estimateAiCostUsd({ model, inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens }),
    latencyMs,
  }
}

function parseOutput<T>(rawResponse: unknown, parseJson: boolean): T {
  const text = extractText(rawResponse).trim()
  if (!parseJson) return text as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

function extractText(rawResponse: unknown): string {
  if (!rawResponse || typeof rawResponse !== 'object' || !('content' in rawResponse)) return ''
  const content = (rawResponse as { content?: unknown }).content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function normalizeProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error
  if (error instanceof Error) {
    const code = 'status' in error ? String((error as { status?: unknown }).status) : 'provider_error'
    return new AiProviderError(error.message, code)
  }
  return new AiProviderError(String(error), 'provider_error')
}

async function logAiUsage(params: {
  input: RunAiMessageInput
  config: AiConfig
  usage: AiUsage
  success: boolean
  error?: AiProviderError
}): Promise<void> {
  try {
    const db = createAdminClient() as unknown as {
      from: (table: string) => { insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }> }
    }

    await db.from('ai_usage_log').insert({
      feature: params.input.feature,
      model: params.config.model,
      effort: params.config.effort,
      input_tokens: params.usage.inputTokens,
      output_tokens: params.usage.outputTokens,
      cache_creation_input_tokens: params.usage.cacheCreationInputTokens,
      cache_read_input_tokens: params.usage.cacheReadInputTokens,
      estimated_cost_usd: params.usage.estimatedCostUsd,
      latency_ms: params.usage.latencyMs,
      success: params.success,
      error_code: params.error?.code ?? null,
      error_message: params.error?.message ?? null,
      created_by: params.input.createdBy ?? null,
    })
  } catch (error) {
    console.error('[ai] failed to write usage log', error)
  }
}
