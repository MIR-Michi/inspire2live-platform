import { describe, expect, it } from 'vitest'
import { fingerprintSource } from '@/kernel/publishing'
import type { PublishableField, PublishableSource } from '@/kernel/publishing'
import { sourceReadiness } from '@/modules/publishing/domain/readiness'

function source(fields: PublishableField[], images = 0): PublishableSource {
  const base = {
    sourceType: 'campus_session',
    sourceId: 'abc',
    title: 'June session',
    occurredAt: '2026-06-24',
    reviewHref: '/x',
    fields,
    images: Array.from({ length: images }, (_, i) => ({
      bucket: 'publishing-uploads',
      storagePath: `p/${i}.png`,
      mediaType: 'image/png',
      alt: '',
    })),
  }
  return { ...base, fingerprint: fingerprintSource(base) }
}

const config = { minimumSourceCharacters: 120 }

describe('sourceReadiness', () => {
  it('refuses an empty source', () => {
    const result = sourceReadiness(source([]), config)
    expect(result.ready).toBe(false)
    if (!result.ready) expect(result.reason).toMatch(/Not enough to work with yet/)
  })

  it('refuses a theme-only source, naming what it has in its own terms', () => {
    const result = sourceReadiness(
      source([{ key: 'theme', label: 'Theme', value: 'Early detection', intent: 'fact' }]),
      config,
    )
    expect(result.ready).toBe(false)
    if (!result.ready) {
      expect(result.reason).toContain('theme')
      expect(result.reason).toContain('no prose intended for publication')
    }
  })

  it('refuses prose below the character threshold and names the numbers', () => {
    const result = sourceReadiness(
      source([{ key: 'summary', label: 'Session summary', value: 'Short note.', intent: 'copy' }]),
      config,
    )
    expect(result.ready).toBe(false)
    if (!result.ready) expect(result.reason).toContain('needs 120')
  })

  it('accepts enough prose', () => {
    const result = sourceReadiness(
      source([{ key: 'summary', label: 'Session summary', value: 'x'.repeat(150), intent: 'copy' }]),
      config,
    )
    expect(result.ready).toBe(true)
  })

  it('accepts an image plus any description', () => {
    const result = sourceReadiness(
      source([{ key: 'description', label: 'Description', value: 'Our stand at ESMO.', intent: 'copy' }], 1),
      config,
    )
    expect(result.ready).toBe(true)
  })

  it('refuses an image without a line of context', () => {
    const result = sourceReadiness(source([], 1), config)
    expect(result.ready).toBe(false)
    if (!result.ready) expect(result.reason).toMatch(/needs a line of context/)
  })

  it('whitespace-only fields count as absent', () => {
    const result = sourceReadiness(
      source([{ key: 'summary', label: 'Session summary', value: '   \n  ', intent: 'copy' }]),
      config,
    )
    expect(result.ready).toBe(false)
  })
})
