/**
 * publishing/domain/config.ts — resolve the operator-tunable settings
 * (manifest defaults → platform_settings → env; ADR-0010), the same shape as
 * `resolvePlanningConfig`. Degrades to the declared defaults so a settings
 * outage can never take the space down.
 *
 * Note what is NOT here: whether a human must approve before handover. That is
 * fixed in `rights.ts` and is deliberately not a setting (ADR-0014 §8).
 */

import { createClient } from '@/kernel/data/server'
import { componentPanel } from '@/kernel/settings'
import { resolveSetting } from '@/kernel/settings'
import { manifest } from '@/modules/publishing/manifest'
import { DEFAULT_PUBLISHING_CONFIG, type PublishingConfig } from '@/modules/publishing/domain/types'

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function resolvePublishingConfig(): Promise<PublishingConfig> {
  const panel = componentPanel(manifest)
  if (!panel) return DEFAULT_PUBLISHING_CONFIG

  try {
    const supabase = await createClient()
    const read = (key: string) => resolveSetting(supabase, panel, key)
    const [
      variantsPerRun,
      brandVoice,
      bannedPhrases,
      hashtagPolicy,
      fixedHashtags,
      includeSourceLink,
      minimumSourceCharacters,
      maxUploadMegabytes,
      staleDraftBehaviour,
    ] = await Promise.all([
      read('variantsPerRun'),
      read('brandVoice'),
      read('bannedPhrases'),
      read('hashtagPolicy'),
      read('fixedHashtags'),
      read('includeSourceLink'),
      read('minimumSourceCharacters'),
      read('maxUploadMegabytes'),
      read('staleDraftBehaviour'),
    ])

    return {
      variantsPerRun: num(variantsPerRun, DEFAULT_PUBLISHING_CONFIG.variantsPerRun),
      brandVoice: text(brandVoice, DEFAULT_PUBLISHING_CONFIG.brandVoice),
      bannedPhrases: text(bannedPhrases, DEFAULT_PUBLISHING_CONFIG.bannedPhrases),
      hashtagPolicy: oneOf(hashtagPolicy, ['none', 'suggest', 'fixed'] as const, DEFAULT_PUBLISHING_CONFIG.hashtagPolicy),
      fixedHashtags: text(fixedHashtags, DEFAULT_PUBLISHING_CONFIG.fixedHashtags),
      includeSourceLink: bool(includeSourceLink, DEFAULT_PUBLISHING_CONFIG.includeSourceLink),
      minimumSourceCharacters: num(minimumSourceCharacters, DEFAULT_PUBLISHING_CONFIG.minimumSourceCharacters),
      maxUploadMegabytes: num(maxUploadMegabytes, DEFAULT_PUBLISHING_CONFIG.maxUploadMegabytes),
      staleDraftBehaviour: oneOf(staleDraftBehaviour, ['warn', 'block'] as const, DEFAULT_PUBLISHING_CONFIG.staleDraftBehaviour),
    }
  } catch (error) {
    console.error('[publishing] settings unavailable, using declared defaults:', error)
    return DEFAULT_PUBLISHING_CONFIG
  }
}
