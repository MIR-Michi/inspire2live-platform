/**
 * publishing/domain/claims.ts — structured output schema + groundedness validator.
 *
 * Hand-written JSON Schema plus a hand-written validator, matching the
 * `INTAKE_STRUCTURE_JSON_SCHEMA` pattern (the repo takes no schema-library
 * dependency). `claims` is the answer to the real risk — not bad prose but a
 * plausible sentence nobody can support: every factual assertion must cite a
 * source field that was actually sent, and a variant citing anything else is
 * rejected before a row is written.
 */

import type { DraftClaim } from '@/modules/publishing/domain/types'

export type DraftVariantPayload = {
  angle: string
  body: string
  hashtags: string[]
  claims: DraftClaim[]
}

export type ChannelPostPayload = {
  variants: DraftVariantPayload[]
  /** What the model saw, when an image was sent — how a reviewer spots a misread screenshot. */
  imageDescription: string | null
  /** Material deliberately left out (shown behind progressive disclosure). */
  omitted: string[]
}

export const CHANNEL_POST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['variants', 'imageDescription', 'omitted'],
  properties: {
    variants: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['angle', 'body', 'hashtags', 'claims'],
        properties: {
          angle: { type: 'string', minLength: 1, maxLength: 60 },
          body: { type: 'string', minLength: 1 },
          hashtags: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 60 } },
          claims: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'sourceFieldKey'],
              properties: {
                text: { type: 'string', minLength: 1, maxLength: 300 },
                sourceFieldKey: { type: 'string', minLength: 1, maxLength: 80 },
              },
            },
          },
        },
      },
    },
    imageDescription: { type: ['string', 'null'], maxLength: 1000 },
    omitted: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 200 } },
  },
} as const

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHashtag(value: unknown): string | null {
  const raw = asString(value).replace(/\s+/g, '')
  if (!raw) return null
  return raw.startsWith('#') ? raw : `#${raw}`
}

export type ClaimsValidation =
  | { ok: true; payload: ChannelPostPayload }
  | { ok: false; error: string }

/**
 * Validate the parsed model output against the field keys that were actually
 * sent. Rejects (rather than repairs) a fabricated `sourceFieldKey` — a hard,
 * visible failure is the honest behaviour for prose (concept §7.6).
 */
export function validateChannelPostPayload(
  value: unknown,
  sentFieldKeys: readonly string[],
  options?: { maxVariants?: number },
): ClaimsValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'The model did not return a JSON object.' }
  }
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.variants) || raw.variants.length === 0) {
    return { ok: false, error: 'The model returned no variants.' }
  }

  const keySet = new Set(sentFieldKeys)
  const maxVariants = options?.maxVariants ?? 5
  const variants: DraftVariantPayload[] = []

  for (const entry of raw.variants.slice(0, maxVariants)) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'A variant is not an object.' }
    }
    const v = entry as Record<string, unknown>
    const angle = asString(v.angle)
    const body = asString(v.body)
    if (!body) return { ok: false, error: 'A variant has an empty body.' }

    const hashtags = Array.isArray(v.hashtags)
      ? v.hashtags.map(normalizeHashtag).filter((tag): tag is string => Boolean(tag)).slice(0, 8)
      : []

    const claims: DraftClaim[] = []
    if (v.claims !== undefined && !Array.isArray(v.claims)) {
      return { ok: false, error: 'A variant carries malformed claims.' }
    }
    for (const claimEntry of (Array.isArray(v.claims) ? v.claims : []).slice(0, 20)) {
      if (!claimEntry || typeof claimEntry !== 'object') {
        return { ok: false, error: 'A claim is not an object.' }
      }
      const claim = claimEntry as Record<string, unknown>
      const text = asString(claim.text)
      const sourceFieldKey = asString(claim.sourceFieldKey)
      if (!text || !sourceFieldKey) {
        return { ok: false, error: 'A claim is missing its text or source field.' }
      }
      if (!keySet.has(sourceFieldKey)) {
        return {
          ok: false,
          error: `A variant cites source field '${sourceFieldKey}', which was never sent to the model.`,
        }
      }
      claims.push({ text: text.slice(0, 300), sourceFieldKey })
    }

    variants.push({ angle: angle.slice(0, 60) || 'Draft', body, hashtags, claims })
  }

  const imageDescription = asString(raw.imageDescription) || null
  const omitted = Array.isArray(raw.omitted)
    ? raw.omitted.map(asString).filter(Boolean).slice(0, 12)
    : []

  return { ok: true, payload: { variants, imageDescription, omitted } }
}
