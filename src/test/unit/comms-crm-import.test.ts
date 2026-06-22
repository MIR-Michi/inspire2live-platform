import { describe, expect, it } from 'vitest'
import {
  fallbackNameFromEmail,
  mapCsvToContactRows,
  parseDelimitedRows,
  resolveImportKind,
} from '@/lib/comms-crm-import'

describe('parseDelimitedRows', () => {
  it('parses simple rows and tracks line numbers', () => {
    const rows = parseDelimitedRows('email,name\na@x.org,Alice\nb@x.org,Bob')
    expect(rows.map((r) => r.cells)).toEqual([
      ['email', 'name'],
      ['a@x.org', 'Alice'],
      ['b@x.org', 'Bob'],
    ])
    expect(rows.map((r) => r.line)).toEqual([1, 2, 3])
  })

  it('handles quoted fields with commas, quotes and newlines', () => {
    const csv = 'email,notes\n"a@x.org","Hello, ""world""\nsecond line"'
    const rows = parseDelimitedRows(csv)
    expect(rows[1].cells).toEqual(['a@x.org', 'Hello, "world"\nsecond line'])
  })

  it('strips a BOM, ignores CRLF, and drops blank lines', () => {
    const csv = '﻿email,name\r\na@x.org,Alice\r\n\r\nb@x.org,Bob\r\n'
    const rows = parseDelimitedRows(csv)
    expect(rows.map((r) => r.cells[0])).toEqual(['email', 'a@x.org', 'b@x.org'])
    // The blank physical line means Bob starts on line 4.
    expect(rows[2].line).toBe(4)
  })
})

describe('mapCsvToContactRows', () => {
  it('maps aliased headers and normalizes emails', () => {
    const { rows, errors } = mapCsvToContactRows(
      'E-Mail,Full Name,Company,Type\nJANE@Example.org,Jane Doe,Acme,external'
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      email: 'jane@example.org',
      fullName: 'Jane Doe',
      organisation: 'Acme',
      contactKind: 'external',
    })
  })

  it('errors when no email column is present', () => {
    const { rows, errors } = mapCsvToContactRows('name,company\nJane,Acme')
    expect(rows).toEqual([])
    expect(errors[0].message).toMatch(/no "email" column/i)
  })

  it('skips rows with a missing or invalid email', () => {
    const { rows, errors } = mapCsvToContactRows('email,name\nnotanemail,Jane\nok@x.org,Joe')
    expect(rows.map((r) => r.email)).toEqual(['ok@x.org'])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ line: 2, message: expect.stringMatching(/invalid email/i) })
  })

  it('deduplicates repeated emails within the file (case-insensitively)', () => {
    const { rows, errors } = mapCsvToContactRows('email,name\na@x.org,First\nA@X.ORG,Second')
    expect(rows).toHaveLength(1)
    expect(rows[0].fullName).toBe('First')
    expect(errors[0].message).toMatch(/duplicate/i)
  })

  it('splits tags on commas and semicolons and normalizes person type and role', () => {
    const { rows } = mapCsvToContactRows(
      'email,tags,person_type,intended_role\na@x.org,"oncology; genomics, oncology",Patient Advocate,patientadvocate'
    )
    expect(rows[0].tags).toEqual(['oncology', 'genomics'])
    expect(rows[0].personType).toBe('patient_advocate')
    expect(rows[0].intendedRole).toBe('PatientAdvocate')
  })
})

describe('resolveImportKind', () => {
  it('always classifies inspire2live.org addresses as internal_contact', () => {
    expect(resolveImportKind('peter@inspire2live.org', 'external', 'external')).toBe('internal_contact')
  })

  it('honours an explicit kind for external domains, else falls back', () => {
    expect(resolveImportKind('a@gmail.com', 'internal_contact', null)).toBe('internal_contact')
    expect(resolveImportKind('a@gmail.com', null, 'internal_contact')).toBe('internal_contact')
    expect(resolveImportKind('a@gmail.com', null, null)).toBe('external')
  })
})

describe('fallbackNameFromEmail', () => {
  it('builds a readable name from the local part', () => {
    expect(fallbackNameFromEmail('jane.doe@example.org')).toBe('Jane Doe')
    expect(fallbackNameFromEmail('john_smith@x.org')).toBe('John Smith')
  })
})
