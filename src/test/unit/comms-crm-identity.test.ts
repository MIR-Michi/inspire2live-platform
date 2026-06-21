import { describe, expect, it } from 'vitest'
import {
  deriveContactKind,
  isInternalEmail,
  normalizeContactKind,
  normalizeEmail,
  normalizePlatformStatus,
  segmentFromKind,
} from '@/lib/comms-crm'
import {
  assembleCrmRecords,
  type AssembleInput,
  type RawCampusMemberRow,
  type RawCrmContactRow,
  type RawProfileRow,
} from '@/lib/comms-crm-data'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
  it('trims and lower-cases a valid email', () => {
    expect(normalizeEmail('  Alice@Inspire2Live.org ')).toBe('alice@inspire2live.org')
  })
  it('returns null for blank or non-email input', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('isInternalEmail', () => {
  it('recognises the Inspire2Live domain case-insensitively', () => {
    expect(isInternalEmail('peter@inspire2live.org')).toBe(true)
    expect(isInternalEmail('PETER@INSPIRE2LIVE.ORG')).toBe(true)
  })
  it('rejects third-party domains', () => {
    expect(isInternalEmail('peter@gmail.com')).toBe(false)
    expect(isInternalEmail(null)).toBe(false)
  })
})

describe('deriveContactKind', () => {
  it('is internal_user when a profile is linked', () => {
    expect(deriveContactKind({ profileId: 'p1', email: 'x@gmail.com' })).toBe('internal_user')
  })
  it('is internal_contact for campus members (no platform access)', () => {
    expect(deriveContactKind({ isCampusMember: true })).toBe('internal_contact')
  })
  it('is internal_contact for Inspire2Live emails without a profile', () => {
    expect(deriveContactKind({ email: 'staff@inspire2live.org' })).toBe('internal_contact')
  })
  it('is external for third-party emails', () => {
    expect(deriveContactKind({ email: 'press@example.com' })).toBe('external')
  })
  it('never returns a pending value', () => {
    // "pending" is a platform_status, not a kind.
    const kinds = [
      deriveContactKind({ email: 'a@inspire2live.org' }),
      deriveContactKind({ email: 'b@example.com' }),
      deriveContactKind({ profileId: 'p' }),
    ]
    expect(kinds).not.toContain('internal_pending')
    expect(kinds).not.toContain('pending')
  })
})

describe('segmentFromKind', () => {
  it('maps both internal kinds to the internal segment', () => {
    expect(segmentFromKind('internal_user')).toBe('internal')
    expect(segmentFromKind('internal_contact')).toBe('internal')
    expect(segmentFromKind('external')).toBe('external')
  })
})

describe('normalize guards', () => {
  it('accepts only known contact kinds', () => {
    expect(normalizeContactKind('internal_user')).toBe('internal_user')
    expect(normalizeContactKind('internal_pending')).toBeNull()
    expect(normalizeContactKind('bogus')).toBeNull()
  })
  it('defaults unknown platform status to none', () => {
    expect(normalizePlatformStatus('invited')).toBe('invited')
    expect(normalizePlatformStatus('bogus')).toBe('none')
    expect(normalizePlatformStatus(null)).toBe('none')
  })
})

// ─── Assembler ────────────────────────────────────────────────────────────────

function profile(partial: Partial<RawProfileRow> & { id: string }): RawProfileRow {
  return {
    name: 'Unnamed',
    email: null,
    avatar_url: null,
    bio: null,
    city: null,
    country: 'NL',
    organization: null,
    role: 'PatientAdvocate',
    expertise_tags: [],
    last_active_at: new Date().toISOString(),
    status: 'active',
    onboarding_completed: true,
    ...partial,
  }
}

function campus(partial: Partial<RawCampusMemberRow> & { id: string }): RawCampusMemberRow {
  return {
    name: 'Unnamed',
    organisation: null,
    role_description: null,
    country: null,
    platform_profile_id: null,
    initiative_affiliations: [],
    last_channel_activity: null,
    date_welcomed: null,
    welcomed_by_peter: false,
    notes: null,
    whatsapp_id: null,
    ...partial,
  }
}

function crm(partial: Partial<RawCrmContactRow> & { id: string }): RawCrmContactRow {
  return {
    source_type: 'manual',
    source_id: null,
    full_name: 'Unnamed',
    segment: 'external',
    contact_kind: null,
    platform_status: 'none',
    intended_role: null,
    profile_id: null,
    normalized_email: null,
    person_type: null,
    field_of_expertise: [],
    skills: [],
    picture_url: null,
    bio: null,
    title: null,
    organisation: null,
    email: null,
    phone: null,
    city: null,
    country: null,
    preferred_channel: null,
    relationship_owner_id: null,
    relationship_owner_label: null,
    lifecycle_stage: 'nurture',
    last_interaction_at: null,
    next_follow_up_at: null,
    consent_status: 'unknown',
    privacy_notes: null,
    retention_review_at: null,
    source_label: null,
    tags: [],
    notes: null,
    ...partial,
  }
}

function emptyInput(partial: Partial<AssembleInput> = {}): AssembleInput {
  return {
    profiles: [],
    initiativeMembers: [],
    initiatives: [],
    campusMembers: [],
    events: [],
    crmContacts: [],
    crmInitiatives: [],
    crmEventLinks: [],
    crmInteractions: [],
    ...partial,
  }
}

describe('assembleCrmRecords', () => {
  it('classifies a platform user as internal_user / active', () => {
    const [record] = assembleCrmRecords(
      emptyInput({ profiles: [profile({ id: 'p1', name: 'Alice', email: 'alice@inspire2live.org', role: 'Comms' })] })
    )
    expect(record.contactKind).toBe('internal_user')
    expect(record.segment).toBe('internal')
    expect(record.platformStatus).toBe('active')
    expect(record.personType).toBe('comms')
  })

  it('marks a not-yet-onboarded profile as invited (pending)', () => {
    const [record] = assembleCrmRecords(
      emptyInput({ profiles: [profile({ id: 'p2', name: 'Dan', email: 'dan@inspire2live.org', onboarding_completed: false })] })
    )
    expect(record.platformStatus).toBe('invited')
  })

  it('treats a World Campus member as an internal contact, not external', () => {
    const [record] = assembleCrmRecords(emptyInput({ campusMembers: [campus({ id: 'm1', name: 'Bob' })] }))
    expect(record.contactKind).toBe('internal_contact')
    expect(record.segment).toBe('internal')
    expect(record.platformStatus).toBe('none')
  })

  it('keeps a third-party CRM row external', () => {
    const [record] = assembleCrmRecords(
      emptyInput({ crmContacts: [crm({ id: 'c1', full_name: 'Carol', segment: 'external', contact_kind: 'external', email: 'carol@example.com' })] })
    )
    expect(record.contactKind).toBe('external')
    expect(record.segment).toBe('external')
  })

  it('does NOT duplicate when an internal_contact CRM row matches a profile by email (promotion)', () => {
    const records = assembleCrmRecords(
      emptyInput({
        profiles: [profile({ id: 'p1', name: 'Alice Smith', email: 'alice@inspire2live.org', role: 'Comms' })],
        // A pre-existing internal_contact row for the same person (different casing).
        crmContacts: [
          crm({
            id: 'c1',
            full_name: 'Alice (old CRM record)',
            segment: 'internal',
            contact_kind: 'internal_contact',
            email: 'Alice@inspire2live.org',
            relationship_owner_label: 'Peter',
            tags: ['vip'],
          }),
        ],
      })
    )

    expect(records).toHaveLength(1)
    const [record] = records
    // Promoted to internal_user; profile identity wins, CRM relationship overlays.
    expect(record.contactKind).toBe('internal_user')
    expect(record.fullName).toBe('Alice Smith')
    expect(record.crmContactId).toBe('c1')
    expect(record.relationshipOwner).toBe('Peter')
    expect(record.tags).toContain('vip')
  })

  it('does NOT duplicate a campus member linked to a profile', () => {
    const records = assembleCrmRecords(
      emptyInput({
        profiles: [profile({ id: 'p1', name: 'Eve', email: 'eve@inspire2live.org' })],
        campusMembers: [campus({ id: 'm1', name: 'Eve', platform_profile_id: 'p1', welcomed_by_peter: true })],
      })
    )
    expect(records).toHaveLength(1)
    expect(records[0].contactKind).toBe('internal_user')
    expect(records[0].tags).toContain('world-campus')
  })

  it('overlays a CRM row onto its profile without creating a second record', () => {
    const records = assembleCrmRecords(
      emptyInput({
        profiles: [profile({ id: 'p1', name: 'Frank', email: 'frank@inspire2live.org' })],
        crmContacts: [crm({ id: 'c1', source_type: 'profile', source_id: 'p1', profile_id: 'p1', full_name: 'Frank', segment: 'internal', contact_kind: 'internal_user', email: 'frank@inspire2live.org', next_follow_up_at: '2026-07-01' })],
      })
    )
    expect(records).toHaveLength(1)
    expect(records[0].crmContactId).toBe('c1')
    expect(records[0].nextFollowUpAt).toBe('2026-07-01')
  })
})
