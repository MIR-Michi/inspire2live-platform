import { describe, expect, it } from 'vitest'
import { fingerprintSource, isSourceStale } from '@/kernel/publishing'
import type { PublishableSource } from '@/kernel/publishing'

type FingerprintInput = Omit<PublishableSource, 'fingerprint'>

function base(): FingerprintInput {
  return {
    sourceType: 'campus_session',
    sourceId: 'abc',
    title: 'June session',
    occurredAt: '2026-06-24',
    reviewHref: '/x',
    publicUrl: null,
    fields: [
      { key: 'theme', label: 'Theme', value: 'Early detection', intent: 'fact' },
      { key: 'summary', label: 'Session summary', value: 'We agreed on the pilot.', intent: 'copy' },
    ],
    images: [],
    people: [{ name: 'A. Presenter', role: 'Presenter', consent: 'public' }],
    links: [],
    rights: null,
  }
}

describe('fingerprintSource (staleness signal)', () => {
  it('is deterministic for the same payload', () => {
    expect(fingerprintSource(base())).toBe(fingerprintSource(base()))
  })

  it('is insensitive to object key order', () => {
    const reordered = JSON.parse(JSON.stringify(base())) as FingerprintInput
    reordered.fields = reordered.fields.map((field) => ({
      intent: field.intent,
      value: field.value,
      label: field.label,
      key: field.key,
    }))
    expect(fingerprintSource(reordered)).toBe(fingerprintSource(base()))
  })

  it('changes when publishable material changes', () => {
    const edited = base()
    edited.fields[1] = { ...edited.fields[1], value: 'We postponed the pilot.' }
    expect(fingerprintSource(edited)).not.toBe(fingerprintSource(base()))
  })

  it('changes when a person is added', () => {
    const withPerson = base()
    withPerson.people = [...(withPerson.people ?? []), { name: 'B. Guest', consent: 'granted' }]
    expect(fingerprintSource(withPerson)).not.toBe(fingerprintSource(base()))
  })

  it('isSourceStale compares stored vs live fingerprints', () => {
    const fp = fingerprintSource(base())
    expect(isSourceStale(fp, fp)).toBe(false)
    const edited = base()
    edited.title = 'Renamed'
    expect(isSourceStale(fp, fingerprintSource(edited))).toBe(true)
  })
})
