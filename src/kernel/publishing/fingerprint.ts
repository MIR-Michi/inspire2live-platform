/**
 * kernel/publishing/fingerprint.ts
 *
 * Deterministic fingerprint over a source payload — the staleness signal
 * (ADR-0014, concept §6). Kernel because every provider computes it while
 * building its `PublishableSource`, and the `publishing` component compares it
 * at draft time. Pure and dependency-free (FNV-1a over canonical JSON) so a
 * fingerprint never depends on runtime, locale or key order.
 */

import type { PublishableSource } from '@/kernel/publishing/types'

type FingerprintInput = Omit<PublishableSource, 'fingerprint'>

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v === undefined) continue
      out[key] = canonical(v)
    }
    return out
  }
  return value ?? null
}

/** 64-bit FNV-1a as two 32-bit lanes, hex-encoded. */
function fnv1a(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0xcbf29ce4
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ ((c >> 8) ^ (c + i)), 0x01000193) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/** Fingerprint the publishable payload (everything the drafter may see). */
export function fingerprintSource(source: FingerprintInput): string {
  const subject = canonical({
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    occurredAt: source.occurredAt,
    publicUrl: source.publicUrl ?? null,
    fields: source.fields,
    images: source.images ?? [],
    people: source.people ?? [],
    links: source.links ?? [],
    rights: source.rights ?? null,
  })
  return fnv1a(JSON.stringify(subject))
}

/** True when a draft's stored fingerprint no longer matches the live source. */
export function isSourceStale(draftFingerprint: string, currentFingerprint: string): boolean {
  return draftFingerprint !== currentFingerprint
}
