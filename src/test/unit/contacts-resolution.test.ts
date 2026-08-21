/**
 * contacts — deciding whether somebody is already in the CRM.
 *
 * This matcher is the whole risk of letting another component create contacts.
 * A false positive merges two people's histories under one name and there is no
 * merge UI to unpick it; a false negative leaves a duplicate somebody has to
 * reconcile by hand. The tests below are mostly about the third outcome, which
 * is the one worth designing for: refusing to decide, and saying so by creating
 * a separate record rather than guessing.
 */

import { describe, expect, it } from 'vitest'
import { matchExistingContact, type ContactCandidate } from '@/modules/contacts'

function candidate(overrides: Partial<ContactCandidate> = {}): ContactCandidate {
  return {
    id: 'c1',
    full_name: 'Maria Silva',
    organisation: 'Hospital de Câncer',
    normalized_email: null,
    ...overrides,
  }
}

describe('matchExistingContact', () => {
  it('finds nobody in an empty CRM', () => {
    expect(matchExistingContact([], { fullName: 'Maria Silva' })).toBeNull()
  })

  // The database has a partial unique index on normalized_email, so this is the
  // one identifier it will enforce for us. It has to win outright.
  it('matches on email even when the name on the record is different', () => {
    const match = matchExistingContact(
      [candidate({ id: 'c9', full_name: 'M. Silva-Costa', normalized_email: 'maria@hosp.br' })],
      { fullName: 'Maria Silva', email: 'Maria@Hosp.br' },
    )
    expect(match).toEqual({ id: 'c9', matchedOn: 'email' })
  })

  it('prefers the email match over a name match on a different row', () => {
    const match = matchExistingContact(
      [
        candidate({ id: 'by-name' }),
        candidate({ id: 'by-email', full_name: 'Someone Else', normalized_email: 'maria@hosp.br' }),
      ],
      { fullName: 'Maria Silva', email: 'maria@hosp.br' },
    )
    expect(match?.id).toBe('by-email')
  })

  it('matches on name and organisation together, ignoring case and padding', () => {
    const match = matchExistingContact([candidate({ id: 'c2' })], {
      fullName: '  maria silva ',
      organisation: 'HOSPITAL DE CÂNCER',
    })
    expect(match).toEqual({ id: 'c2', matchedOn: 'name_and_organisation' })
  })

  it('matches a lone name when exactly one person in the CRM has it', () => {
    const match = matchExistingContact([candidate({ id: 'c3', organisation: null })], {
      fullName: 'Maria Silva',
      organisation: 'Somewhere Else',
    })
    expect(match).toEqual({ id: 'c3', matchedOn: 'name' })
  })

  // The case the design is actually for: two people share a name, neither
  // carries the organisation we hold, and merging would attach a publication
  // history to whichever row happened to be first.
  it('refuses to guess between two contacts with the same name', () => {
    const match = matchExistingContact(
      [
        candidate({ id: 'a', organisation: 'Hospital A' }),
        candidate({ id: 'b', organisation: 'Hospital B' }),
      ],
      { fullName: 'Maria Silva', organisation: 'Hospital C' },
    )
    expect(match).toBeNull()
  })

  it('still resolves an ambiguous name when the organisation settles it', () => {
    const match = matchExistingContact(
      [
        candidate({ id: 'a', organisation: 'Hospital A' }),
        candidate({ id: 'b', organisation: 'Hospital B' }),
      ],
      { fullName: 'Maria Silva', organisation: 'hospital b' },
    )
    expect(match).toEqual({ id: 'b', matchedOn: 'name_and_organisation' })
  })

  it('does not treat two missing emails as a match', () => {
    const match = matchExistingContact([candidate({ id: 'a', full_name: 'Someone Else' })], {
      fullName: 'Maria Silva',
      email: null,
    })
    expect(match).toBeNull()
  })

  it('ignores an email that is not one', () => {
    const match = matchExistingContact([candidate({ id: 'a', normalized_email: 'maria@hosp.br' })], {
      fullName: 'Someone Else',
      email: 'not-an-email',
    })
    expect(match).toBeNull()
  })

  it('matches nothing on a blank name', () => {
    expect(matchExistingContact([candidate()], { fullName: '   ' })).toBeNull()
  })
})
