/**
 * publishing/domain/readiness.ts — the readiness gate (concept §7.5).
 *
 * Asking a model to write a post from a theme and nothing else is asking it to
 * invent, so the domain refuses — in the source's own terms — instead of
 * drafting. Pure over the payload; runs in the server action, not only the UI.
 */

import type { PublishableSource } from '@/kernel/publishing'

export type SourceReadiness = { ready: true } | { ready: false; reason: string }

function totalCharacters(source: PublishableSource): number {
  return source.fields.reduce((sum, field) => sum + field.value.trim().length, 0)
}

/**
 * A source is ready when it carries an image plus any description, or at least
 * one prose (`intent: 'copy'`) field and `minimumSourceCharacters` of material.
 */
export function sourceReadiness(
  source: PublishableSource,
  config: { minimumSourceCharacters: number },
): SourceReadiness {
  const filled = source.fields.filter((field) => field.value.trim().length > 0)
  const copyFields = filled.filter((field) => field.intent === 'copy')
  const characters = totalCharacters(source)
  const hasImage = (source.images ?? []).length > 0

  if (hasImage && copyFields.length > 0) return { ready: true }

  if (copyFields.length > 0 && characters >= config.minimumSourceCharacters) {
    return { ready: true }
  }

  // Phrase the refusal in the source's own terms: name what it has and what is missing.
  const has = filled.map((field) => field.label.toLowerCase())
  const hasClause = has.length > 0 ? `has ${formatList(has)}` : 'has no publishable material yet'

  if (hasImage && copyFields.length === 0) {
    return {
      ready: false,
      reason: `Not enough to work with yet. The image needs a line of context before drafting.`,
    }
  }

  const missing =
    copyFields.length === 0
      ? 'no prose intended for publication'
      : `only ${characters} characters of material (needs ${config.minimumSourceCharacters})`
  return {
    ready: false,
    reason: `Not enough to work with yet. ${source.title || 'This source'} ${hasClause}, but ${missing}.`,
  }
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
