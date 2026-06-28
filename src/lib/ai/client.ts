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
  /** Server tools (e.g. web search). Passed through to the provider verbatim. */
  tools?: Array<Record<string, unknown>>
  /** Wrap the system prompt in an ephemeral cache_control block (prompt caching). */
  cacheSystemPrompt?: boolean
  timeoutMs?: number
  retries?: number
  createdBy?: string | null
  requireFeatureFlag?: boolean
  apiKeyOverride?: string
}

/** Standard Anthropic web-search server tool definition. */
export function webSearchTool(params?: { maxUses?: number; allowedDomains?: string[]; blockedDomains?: string[] }): Record<string, unknown> {
  // Use the basic web-search tool. The dynamic-filtering variant requires code
  // execution to be enabled on the request, which these AI calls do not use.
  const tool: Record<string, unknown> = { type: 'web_search_20250305', name: 'web_search' }
  if (params?.maxUses) tool.max_uses = params.maxUses
  if (params?.allowedDomains && params.allowedDomains.length > 0) tool.allowed_domains = params.allowedDomains
  if (params?.blockedDomains && params.blockedDomains.length > 0) tool.blocked_domains = params.blockedDomains
  return tool
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
  // Cap retries for long calls so a slow request can't retry-compound past the
  // serverless duration limit (SDK default is 2).
  const requestOptions = input.retries !== undefined ? { maxRetries: input.retries } : undefined

  try {
    const rawResponse = await client.messages.create(request as never, requestOptions)
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

export function buildMessageRequest(input: RunAiMessageInput, config: AiConfig): Record<string, unknown> {
  const request: Record<string, unknown> = {
    model: config.model,
    max_tokens: input.maxTokens ?? 1024,
    messages: input.messages,
  }
  const outputConfig: Record<string, unknown> = {}
  const hasTools = Boolean(input.tools && input.tools.length > 0)

  if (input.system) {
    request.system = input.cacheSystemPrompt
      ? [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }]
      : input.system
  }
  if (input.tools && input.tools.length > 0) request.tools = input.tools
  if (config.effort !== 'none' && !hasTools) {
    request.thinking = { type: 'adaptive' }
    outputConfig.effort = config.effort
    // Anthropic rejects thinking/adaptive requests with any explicit
    // temperature other than 1. Preserve caller temperature only for
    // non-thinking models; for thinking calls, normalize it to the valid value.
    if (typeof input.temperature === 'number') request.temperature = 1
  } else if (typeof input.temperature === 'number') {
    request.temperature = input.temperature
  }
  // Provider structured-output mode is intentionally skipped when server tools
  // are present. Web-search calls return ordinary text JSON and are parsed below;
  // combining tool use with output_config has caused zero-candidate runs.
  if (input.structuredFormat && !hasTools) outputConfig.format = buildOutputFormat(input.structuredFormat)
  if (Object.keys(outputConfig).length > 0) request.output_config = outputConfig

  return request
}

/**
 * Build the `output_config.format` payload. The provider only permits `type`
 * and `schema` here — `name`/`description` on AiStructuredFormat are for our own
 * documentation and must NOT be sent ("output_config.format.name: Extra inputs
 * are not permitted"). The schema is also sanitized of unsupported keywords.
 */
export function buildOutputFormat(format: AiStructuredFormat): { type: string; schema: Record<string, unknown> } {
  return {
    type: format.type,
    schema: sanitizeStructuredSchema(format.schema),
  }
}

// Anthropic structured outputs accept only a subset of JSON Schema. Validation
// keywords like `maxItems`/`minLength`/`minimum` are rejected
// ("For 'array' type, property 'maxItems' is not supported"). We keep them in
// our local schemas (and re-validate the parsed output ourselves), but strip
// them from the schema actually sent to the provider.
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minProperties',
  'maxProperties',
])

export function sanitizeStructuredSchema<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map((entry) => sanitizeStructuredSchema(entry)) as unknown as T
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue
      // `properties` keys are arbitrary field names — never treat them as
      // schema keywords; only sanitize each field's nested schema.
      if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
        const props: Record<string, unknown> = {}
        for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
          props[propName] = sanitizeStructuredSchema(propSchema)
        }
        out[key] = props
      } else {
        out[key] = sanitizeStructuredSchema(value)
      }
    }
    return out as T
  }
  return schema
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
  return parseStructuredJson<T>(text)
}

function parseStructuredJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const objectStart = text.indexOf('{')
    const objectEnd = text.lastIndexOf('}')
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(text.slice(objectStart, objectEnd + 1)) as T
      } catch {
        // Fall through to returning the original text for diagnostics.
      }
    }

    const arrayStart = text.indexOf('[')
    const arrayEnd = text.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(text.slice(arrayStart, arrayEnd + 1)) as T
      } catch {
        // Fall through to returning the original text for diagnostics.
      }
    }

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