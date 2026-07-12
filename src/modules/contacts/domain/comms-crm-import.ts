import { ROLE_LABELS } from '@/lib/role-access'
import {
  isInternalEmail,
  normalizeContactKind,
  normalizeCrmPersonType,
  normalizeEmail,
  type CrmContactKind,
  type CrmPersonType,
} from '@/lib/comms-crm'

// ─── CSV contact import ───────────────────────────────────────────────────────
//
// Bulk-imports CRM contacts from a CSV file. The email address is the identity:
// a row whose email already exists updates that contact, otherwise a new one is
// created. Updates are a MERGE — only columns present (and non-empty) in the CSV
// are written, so an import never blanks out fields it doesn't carry.
//
// Everything in this module is pure (no DB / no server APIs) so the parsing and
// header-mapping rules can be unit-tested. The server action in the CRM actions
// file consumes `mapCsvToContactRows` and performs the upserts.

/** One mapped, validated row ready to be upserted. `email` is always normalized. */
export type CrmImportRow = {
  /** 1-based source line in the original file, for error messages. */
  line: number
  email: string
  fullName: string | null
  title: string | null
  organisation: string | null
  phone: string | null
  city: string | null
  country: string | null
  preferredChannel: string | null
  bio: string | null
  notes: string | null
  /** Explicit kind from the CSV (pre-derivation). Internal emails are coerced later. */
  contactKind: CrmContactKind | null
  personType: CrmPersonType | null
  intendedRole: string | null
  tags: string[]
}

export type CrmImportRowError = {
  line: number
  email: string | null
  message: string
}

export type CrmImportParsed = {
  rows: CrmImportRow[]
  errors: CrmImportRowError[]
  /** Number of data rows (excluding the header) found in the file. */
  totalDataRows: number
}

/** Outcome of an import run, returned to the client for display. */
export type CrmImportResult = {
  created: number
  updated: number
  skipped: number
  errors: CrmImportRowError[]
  totalRows: number
}

type RawRow = { line: number; cells: string[] }

/**
 * Parses CSV/RFC-4180 text into rows of cells. Handles quoted fields, escaped
 * quotes (""), commas and newlines inside quotes, CRLF, and a leading BOM.
 * Fully-blank lines are dropped; each kept row carries the 1-based line it began
 * on so we can report errors against the user's file.
 */
export function parseDelimitedRows(input: string): RawRow[] {
  const text = input.replace(/^﻿/, '')
  const rows: RawRow[] = []
  let field = ''
  let cells: string[] = []
  let inQuotes = false
  let line = 1
  let rowStartLine = 1
  let started = false

  const endRow = () => {
    cells.push(field)
    field = ''
    if (cells.some((cell) => cell.trim() !== '')) rows.push({ line: rowStartLine, cells })
    cells = []
    started = false
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }

    if (ch === '\n') {
      if (started || field !== '' || cells.length > 0) endRow()
      line++
      continue
    }
    if (ch === '\r') continue

    if (!started) {
      rowStartLine = line
      started = true
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      cells.push(field)
      field = ''
      continue
    }
    field += ch
  }

  if (started || field !== '' || cells.length > 0) endRow()
  return rows
}

/** Normalizes a header cell to a comparison key: lower-case, alphanumerics only. */
function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Field key → accepted header spellings. The first column that matches a key
 * wins; later duplicates are ignored.
 */
const HEADER_ALIASES: Record<keyof Omit<CrmImportRow, 'line'>, string[]> = {
  email: ['email', 'emailaddress', 'mail', 'mailaddress'],
  fullName: ['name', 'fullname', 'contactname', 'displayname', 'person', 'contact'],
  title: ['title', 'role', 'jobtitle', 'position'],
  organisation: ['organisation', 'organization', 'company', 'org', 'employer', 'organisationname'],
  phone: ['phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'cell'],
  city: ['city', 'town'],
  country: ['country'],
  preferredChannel: ['preferredchannel', 'channel'],
  bio: ['bio', 'biography', 'about'],
  notes: ['notes', 'note', 'comment', 'comments'],
  contactKind: ['contactkind', 'kind', 'contacttype', 'type'],
  personType: ['persontype', 'category', 'classification'],
  intendedRole: ['intendedrole', 'platformrole', 'inviterole'],
  tags: ['tags', 'tag', 'labels', 'label'],
}

const ALIAS_LOOKUP = new Map<string, keyof Omit<CrmImportRow, 'line'>>()
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
  keyof Omit<CrmImportRow, 'line'>,
  string[],
][]) {
  for (const alias of aliases) ALIAS_LOOKUP.set(alias, field)
}

const ROLE_KEYS = new Map(Object.keys(ROLE_LABELS).map((key) => [key.toLowerCase(), key]))

/** Accepts internal / internal_contact / external (spelled loosely); else null. */
function normalizeImportKind(value: string): CrmContactKind | null {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!key) return null
  if (key === 'internal' || key === 'internal_contact') return 'internal_contact'
  if (key === 'external') return 'external'
  // internal_user is never set via import — promote contacts to users separately.
  return normalizeContactKind(key) === 'external' ? 'external' : null
}

/** Accepts person-type values or their human labels (e.g. "Patient Advocate"). */
function normalizeImportPersonType(value: string): CrmPersonType | null {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return normalizeCrmPersonType(key)
}

/** Matches a platform role key case-insensitively (e.g. "patientadvocate"). */
function normalizeImportRole(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return ROLE_KEYS.get(trimmed.toLowerCase()) ?? null
}

/** Splits a tags cell on commas or semicolons into a unique, trimmed list. */
function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )
}

/** A friendly fallback name derived from the email local part (e.g. "jane.doe" → "Jane Doe"). */
export function fallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  const words = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  return words.join(' ') || email
}

/**
 * Parses a CSV string and maps each data row to a `CrmImportRow`. Rows without a
 * valid email, or that duplicate an earlier row's email, are reported as errors
 * and skipped (email is the identifier and must be unique within the file).
 */
export function mapCsvToContactRows(csv: string): CrmImportParsed {
  const raw = parseDelimitedRows(csv ?? '')
  if (raw.length === 0) {
    return { rows: [], errors: [{ line: 0, email: null, message: 'The file is empty.' }], totalDataRows: 0 }
  }

  const header = raw[0]
  const columnField = new Map<number, keyof Omit<CrmImportRow, 'line'>>()
  const usedFields = new Set<string>()
  header.cells.forEach((cell, index) => {
    const field = ALIAS_LOOKUP.get(normalizeHeader(cell))
    if (field && !usedFields.has(field)) {
      columnField.set(index, field)
      usedFields.add(field)
    }
  })

  if (!usedFields.has('email')) {
    return {
      rows: [],
      errors: [
        {
          line: header.line,
          email: null,
          message: 'No "email" column found. Add a header row with a column named "email".',
        },
      ],
      totalDataRows: Math.max(raw.length - 1, 0),
    }
  }

  const cellFor = (cells: string[], field: keyof Omit<CrmImportRow, 'line'>): string => {
    for (const [index, mapped] of columnField) {
      if (mapped === field) return (cells[index] ?? '').trim()
    }
    return ''
  }

  const rows: CrmImportRow[] = []
  const errors: CrmImportRowError[] = []
  const seen = new Map<string, number>()
  const dataRows = raw.slice(1)

  for (const row of dataRows) {
    const email = normalizeEmail(cellFor(row.cells, 'email'))
    if (!email) {
      errors.push({ line: row.line, email: null, message: 'Missing or invalid email — row skipped.' })
      continue
    }
    const firstSeen = seen.get(email)
    if (firstSeen) {
      errors.push({
        line: row.line,
        email,
        message: `Duplicate email (first seen on line ${firstSeen}) — row skipped.`,
      })
      continue
    }
    seen.set(email, row.line)

    rows.push({
      line: row.line,
      email,
      fullName: cellFor(row.cells, 'fullName') || null,
      title: cellFor(row.cells, 'title') || null,
      organisation: cellFor(row.cells, 'organisation') || null,
      phone: cellFor(row.cells, 'phone') || null,
      city: cellFor(row.cells, 'city') || null,
      country: cellFor(row.cells, 'country') || null,
      preferredChannel: cellFor(row.cells, 'preferredChannel') || null,
      bio: cellFor(row.cells, 'bio') || null,
      notes: cellFor(row.cells, 'notes') || null,
      contactKind: normalizeImportKind(cellFor(row.cells, 'contactKind')),
      personType: normalizeImportPersonType(cellFor(row.cells, 'personType')),
      intendedRole: normalizeImportRole(cellFor(row.cells, 'intendedRole')),
      tags: splitTags(cellFor(row.cells, 'tags')),
    })
  }

  return { rows, errors, totalDataRows: dataRows.length }
}

/**
 * Resolves the final contact kind for a row. Inspire2Live emails are ALWAYS
 * internal_contact (never external), mirroring the single-contact save path.
 * Otherwise the CSV's explicit kind wins, falling back to an existing kind (on
 * update) or 'external' (on insert).
 */
export function resolveImportKind(
  email: string,
  explicit: CrmContactKind | null,
  existingKind: CrmContactKind | null
): CrmContactKind {
  if (isInternalEmail(email)) return 'internal_contact'
  return explicit ?? existingKind ?? 'external'
}

/** The header row used by the downloadable template / shown in the dialog. */
export const CRM_IMPORT_TEMPLATE_HEADER =
  'email,name,title,organisation,phone,city,country,contact_kind,person_type,tags,notes'

/** A small example CSV offered as a starting point in the import dialog. */
export const CRM_IMPORT_TEMPLATE_SAMPLE = [
  CRM_IMPORT_TEMPLATE_HEADER,
  'jane.doe@example.org,Jane Doe,Researcher,Example University,,Amsterdam,NL,external,researcher,"oncology;genomics",Met at congress',
].join('\n')
