/**
 * lib/ai/follow-up-tasks.ts
 *
 * Sprint 14 Capability 3 (S14-T14): map the action items produced by the
 * meeting summary (the same transcript run as T12) into draft comms_tasks.
 *
 * This is a deterministic transform — it reuses the structured action items
 * Claude already extracted, matches each proposed owner against the comms
 * team, and parses an ISO due date where one was given. Keeping it free of a
 * second model call makes it cheap, testable, and faithful to "same transcript
 * run as T12". The output is always a reviewable proposal; a human edits,
 * accepts, or rejects before any real task is created.
 */

import type { MeetingActionItem } from './meeting-summary'

export type CommsTeamMember = {
  id: string
  label: string
  email?: string | null
  role?: string | null
}

export type OwnerMatch = 'matched' | 'unmatched'

export type ProposedFollowUpTask = {
  title: string
  description: string | null
  proposedOwnerId: string | null
  proposedOwnerLabel: string | null
  ownerMatch: OwnerMatch
  dueDate: string | null
  rawOwner: string | null
  rawDue: string | null
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITICS, '') // strip combining diacritical marks
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function emailLocalPart(email?: string | null): string {
  if (!email) return ''
  return normalize(email.split('@')[0] ?? '')
}

/**
 * Match a free-text owner string from the transcript to a comms team member.
 *
 * Tries, in order: exact normalized full-name match, email local-part match,
 * then a unique first-name match. Ambiguous or absent matches return null so
 * the human assigns an owner during review.
 */
export function matchOwner(
  rawOwner: string | null | undefined,
  members: CommsTeamMember[]
): { id: string | null; label: string | null; match: OwnerMatch } {
  const owner = normalize(rawOwner ?? '')
  if (!owner) return { id: null, label: null, match: 'unmatched' }

  // Exact full-name match.
  const exact = members.find((m) => normalize(m.label) === owner)
  if (exact) return { id: exact.id, label: exact.label, match: 'matched' }

  // Email local-part match (e.g. "jane.doe" → jane.doe@…).
  const byEmail = members.find((m) => emailLocalPart(m.email) && emailLocalPart(m.email) === owner)
  if (byEmail) return { id: byEmail.id, label: byEmail.label, match: 'matched' }

  // Substring containment either way (e.g. "Jane" in "Jane Doe", or
  // "Jane Doe (Comms)" containing the member name).
  const ownerTokens = owner.split(' ').filter(Boolean)
  const firstToken = ownerTokens[0]
  if (firstToken) {
    const byFirstName = members.filter((m) => {
      const tokens = normalize(m.label).split(' ').filter(Boolean)
      return tokens.includes(firstToken) || owner.includes(normalize(m.label))
    })
    if (byFirstName.length === 1) {
      return { id: byFirstName[0].id, label: byFirstName[0].label, match: 'matched' }
    }
  }

  return { id: null, label: rawOwner?.trim() || null, match: 'unmatched' }
}

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/

/**
 * Extract an ISO (YYYY-MM-DD) due date from the action item's due hint.
 * Natural-language hints ("end of next week") are left for the human and
 * returned as null here; the raw hint is preserved separately for display.
 */
export function parseDueDate(rawDue: string | null | undefined): string | null {
  if (!rawDue) return null
  const match = ISO_DATE.exec(rawDue)
  if (!match) return null
  const [iso, year, month, day] = match
  const monthNum = Number(month)
  const dayNum = Number(day)
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null
  void year
  return iso
}

export type ProposeFollowUpTasksInput = {
  actionItems: MeetingActionItem[]
  members: CommsTeamMember[]
}

/**
 * Map a meeting summary's action items into reviewable draft follow-up tasks.
 */
export function proposeFollowUpTasks(input: ProposeFollowUpTasksInput): ProposedFollowUpTask[] {
  const seen = new Set<string>()
  const proposals: ProposedFollowUpTask[] = []

  for (const item of input.actionItems) {
    const title = item.title?.trim()
    if (!title) continue

    // De-duplicate identical action items (long/map-reduced transcripts repeat).
    const key = normalize(title)
    if (seen.has(key)) continue
    seen.add(key)

    const owner = matchOwner(item.owner, input.members)
    const descriptionParts = [item.notes?.trim()].filter(Boolean) as string[]

    proposals.push({
      title: title.slice(0, 400),
      description: descriptionParts.length > 0 ? descriptionParts.join('\n').slice(0, 600) : null,
      proposedOwnerId: owner.id,
      proposedOwnerLabel: owner.label,
      ownerMatch: owner.match,
      dueDate: parseDueDate(item.dueDate),
      rawOwner: item.owner?.trim() || null,
      rawDue: item.dueDate?.trim() || null,
    })
  }

  return proposals
}
