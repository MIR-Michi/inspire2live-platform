import { describe, expect, it } from 'vitest'
import {
  deriveRelationshipHealth,
  getInitials,
  normalizeCrmConsent,
  normalizeCrmInteractionType,
  normalizeCrmLifecycle,
  normalizeProjectLabels,
  parseCrmList,
} from '@/lib/comms-crm'

describe('communications CRM helpers', () => {
  it('derives relationship health from recency', () => {
    const now = new Date('2026-06-04T00:00:00.000Z')

    expect(deriveRelationshipHealth('2026-05-20T00:00:00.000Z', now)).toBe('active')
    expect(deriveRelationshipHealth('2026-03-01T00:00:00.000Z', now)).toBe('nurture')
    expect(deriveRelationshipHealth('2025-12-01T00:00:00.000Z', now)).toBe('follow_up')
    expect(deriveRelationshipHealth(null, now)).toBe('follow_up')
  })

  it('normalizes project labels from ids and raw values', () => {
    const initiativeMap = new Map([
      ['a1', 'Cancer Champions'],
      ['a2', 'World Campus'],
    ])

    expect(normalizeProjectLabels(['a1', 'World Campus', 'a1'], initiativeMap)).toEqual([
      'Cancer Champions',
      'World Campus',
    ])
  })

  it('builds initials for avatar fallbacks', () => {
    expect(getInitials('Anna Maria')).toBe('AM')
    expect(getInitials('Peter')).toBe('P')
  })

  it('normalizes editable CRM state values', () => {
    expect(normalizeCrmLifecycle('archived')).toBe('archived')
    expect(normalizeCrmLifecycle('invalid')).toBe('nurture')
    expect(normalizeCrmConsent('granted')).toBe('granted')
    expect(normalizeCrmConsent('invalid')).toBe('unknown')
    expect(normalizeCrmInteractionType('podcast')).toBe('podcast')
    expect(normalizeCrmInteractionType('invalid')).toBe('note')
  })

  it('parses comma and newline separated CRM tags', () => {
    expect(parseCrmList('patient, researcher\npartner, patient')).toEqual([
      'patient',
      'researcher',
      'partner',
    ])
  })
})
