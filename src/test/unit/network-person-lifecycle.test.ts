/**
 * network — removing a person, and promoting one into the CRM.
 *
 * The two ends of a directory record's life, and the two places where a screen
 * that used to be read-only can now destroy something or start something. Both
 * rules are pure, so both are tested here rather than discovered in production:
 * the deletion guard decides what a cascade is allowed to take with it, and the
 * promotion mapping decides what a CRM contact is allowed to claim.
 */

import { describe, expect, it } from 'vitest'
import { canDeletePerson } from '@/modules/network/domain/deletion'
import {
  contactInputFromPerson,
  contactLinksFor,
  provenanceNote,
} from '@/modules/network/domain/crm-promotion'
import type { NetworkPerson } from '@/modules/network/domain/types'

const CLEAN = {
  liveCards: 0,
  introductions: 0,
  answeredChecks: 0,
  isMember: false,
  inCrm: false,
}

function person(overrides: Partial<NetworkPerson> = {}): NetworkPerson {
  return {
    id: 'p1',
    fullName: 'Dimas Tadeu Covas',
    roleTitle: 'Senior author',
    organisation: 'Universidade de São Paulo',
    country: 'Brazil',
    languages: [],
    topicTags: ['car-t', 'access'],
    whatTheyCanSay: 'Senior author overseeing the academic CAR-T programme.',
    publicProfileUrls: [],
    audienceIndicators: {},
    sharesOwnAppearances: null,
    appearances: [],
    institutionalFriction: 'none',
    industryRelationship: null,
    origin: 'external',
    crmContactId: null,
    profileId: null,
    sourceAttribution: {},
    lastReviewedAt: null,
    ...overrides,
  }
}

describe('canDeletePerson', () => {
  it('deletes a record with no history without asking', () => {
    expect(canDeletePerson(CLEAN)).toEqual({ allowed: true })
  })

  it("refuses a member's record, because it belongs to their profile", () => {
    const verdict = canDeletePerson({ ...CLEAN, isMember: true })
    expect(verdict.allowed).toBe(false)
    expect(verdict.allowed === false && verdict.reason).toContain('platform member')
  })

  it('refuses somebody still on an open card rather than orphaning the board', () => {
    const verdict = canDeletePerson({ ...CLEAN, liveCards: 2 })
    expect(verdict.allowed).toBe(false)
    expect(verdict.allowed === false && verdict.reason).toContain('2 cards')
    expect(verdict.allowed === false && verdict.reason).toContain('Close the card first')
  })

  it('reads naturally for a single card', () => {
    const verdict = canDeletePerson({ ...CLEAN, liveCards: 1 })
    expect(verdict.allowed === false && verdict.reason).toContain('1 card that is still open')
  })

  it('puts membership ahead of the card check, so the better reason is the one shown', () => {
    const verdict = canDeletePerson({ ...CLEAN, isMember: true, liveCards: 3 })
    expect(verdict.allowed === false && verdict.reason).toContain('platform member')
  })

  // The cascade nobody would predict: introducer fatigue is computed from the
  // request history, so deleting a person hands every introducer a fresh
  // cooldown. Saying so is the whole point of the confirmation.
  it('warns that deleting introduction requests also clears the introducer cooldown', () => {
    const verdict = canDeletePerson({ ...CLEAN, introductions: 1 })
    expect(verdict.allowed).toBe(true)
    expect(verdict.allowed === true && verdict.confirm).toContain('1 introduction request')
    expect(verdict.allowed === true && verdict.confirm).toContain('clears the cooldown')
  })

  it('warns about answered map questions, which are the graph’s evidence', () => {
    const verdict = canDeletePerson({ ...CLEAN, answeredChecks: 4 })
    expect(verdict.allowed === true && verdict.confirm).toContain('4 answered')
  })

  it('names both losses in one sentence when there are both', () => {
    const verdict = canDeletePerson({ ...CLEAN, introductions: 2, answeredChecks: 1 })
    const confirm = verdict.allowed === true ? verdict.confirm : ''
    expect(confirm).toContain('2 introduction requests')
    expect(confirm).toContain('1 answered')
    expect(confirm).toContain(' and ')
  })

  it('reassures that the CRM contact survives, when there is one', () => {
    const verdict = canDeletePerson({ ...CLEAN, introductions: 1, inCrm: true })
    expect(verdict.allowed === true && verdict.confirm).toContain('CRM contact is not affected')
  })

  it('does not mention the CRM when the person is not in it', () => {
    const verdict = canDeletePerson({ ...CLEAN, introductions: 1 })
    expect(verdict.allowed === true && verdict.confirm).not.toContain('CRM')
  })

  it('goes ahead once confirmed', () => {
    expect(canDeletePerson({ ...CLEAN, introductions: 2, answeredChecks: 1 }, { confirmed: true })).toEqual({
      allowed: true,
    })
  })

  it('still refuses a live card even when confirmed — confirmation is not an override', () => {
    const verdict = canDeletePerson({ ...CLEAN, liveCards: 1 }, { confirmed: true })
    expect(verdict.allowed).toBe(false)
  })
})

describe('contactLinksFor', () => {
  it('carries the evidence across, profile first and papers last', () => {
    const links = contactLinksFor(
      person({
        publicProfileUrls: [{ label: 'ORCID', url: 'https://orcid.org/1' }],
        appearances: [{ show: 'Cancer Podcast', url: 'https://pod.example/1', publishedAt: '2025-02-01' }],
        sourceAttribution: { organisation: 'https://doi.org/10.1/abc' },
      }),
    )

    expect(links.map((l) => l.kind)).toEqual(['profile', 'media', 'publication'])
    expect(links[0]).toEqual({ kind: 'profile', label: 'ORCID', url: 'https://orcid.org/1' })
    expect(links[1].label).toBe('Cancer Podcast')
    expect(links[2].label).toBe('Evidence for organisation')
  })

  it('keeps one link per URL, whichever field cited it', () => {
    const links = contactLinksFor(
      person({
        publicProfileUrls: [{ url: 'https://doi.org/10.1/abc' }],
        sourceAttribution: { organisation: 'https://doi.org/10.1/abc', country: 'https://doi.org/10.1/abc' },
      }),
    )
    expect(links).toHaveLength(1)
    expect(links[0].kind).toBe('profile')
  })

  it('drops an appearance with no URL rather than writing an empty link', () => {
    const links = contactLinksFor(person({ appearances: [{ show: 'Somewhere', url: null }] }))
    expect(links).toEqual([])
  })
})

describe('provenanceNote', () => {
  it('says plainly that nobody has spoken to an externally-found person', () => {
    expect(provenanceNote(person())).toContain('nobody here has spoken to them yet')
  })

  it('says the opposite for a past guest', () => {
    const note = provenanceNote(person({ origin: 'past_guest' }))
    expect(note).toContain('past guest')
    expect(note).not.toContain('nobody here has spoken to them')
  })

  it('carries the approval overhead, which is the relationship owner’s problem', () => {
    expect(provenanceNote(person({ institutionalFriction: 'pharmaceutical' }))).toContain(
      'Approval to expect',
    )
  })

  it('carries a declared industry relationship', () => {
    expect(provenanceNote(person({ industryRelationship: 'Advisory board, 2024' }))).toContain(
      'Industry relationship: Advisory board, 2024',
    )
  })

  it('counts the sources attached, so the note matches the links', () => {
    const note = provenanceNote(
      person({ sourceAttribution: { a: 'https://one', b: 'https://two', c: 'https://one' } }),
    )
    expect(note).toContain('2 sources attached')
  })
})

describe('contactInputFromPerson', () => {
  it('carries the professional record and classifies it', () => {
    const input = contactInputFromPerson(person(), { personType: 'researcher' })

    expect(input.fullName).toBe('Dimas Tadeu Covas')
    expect(input.title).toBe('Senior author')
    expect(input.organisation).toBe('Universidade de São Paulo')
    expect(input.country).toBe('Brazil')
    expect(input.personType).toBe('researcher')
    expect(input.fieldOfExpertise).toEqual(['car-t', 'access'])
    expect(input.sourceLabel).toBe('Podcast People directory')
  })

  // ADR-0016: a record retrieved from a catalogue never stores a way to reach
  // the person, so an address can only have come from the human clicking Add.
  it('takes the email from the caller and never from the record', () => {
    expect(contactInputFromPerson(person()).email).toBeNull()
    expect(contactInputFromPerson(person(), { email: 'a@b.org' }).email).toBe('a@b.org')
  })

  it('tags every promoted person, and marks the past guests among them', () => {
    expect(contactInputFromPerson(person()).tags).toEqual(['podcast-candidate'])
    expect(contactInputFromPerson(person({ origin: 'past_guest' })).tags).toEqual([
      'podcast-candidate',
      'past-podcast-guest',
    ])
  })

  it('leaves the category unset rather than guessing when none was chosen', () => {
    expect(contactInputFromPerson(person()).personType).toBeNull()
  })
})
