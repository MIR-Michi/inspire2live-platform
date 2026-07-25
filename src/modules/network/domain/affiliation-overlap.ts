/**
 * network/domain/affiliation-overlap.ts — turning declared contexts into guesses.
 *
 * Concept §8, first mechanism. Members tick *contexts* — institutions and rough
 * years, societies, congresses, boards, universities, disease areas, countries.
 * They never upload contacts. Comparing those against a target's publicly stated
 * affiliations does not prove two people know each other; it produces a
 * **testable guess** that the five-second map question then confirms or kills.
 *
 * Everything here therefore emits `status: 'suggested'` edges only. Nothing in
 * this file can create a confirmed connection — that requires a human answer.
 */

import type {
  AffiliationKind,
  Connection,
  ConnectionType,
  MemberAffiliation,
  PersonAffiliation,
} from '@/modules/network/domain/types'
import { CONNECTION_STRENGTH } from '@/modules/network/domain/connection-strength'

/** Which connection type an overlap of each kind implies. */
const KIND_TO_CONNECTION: Record<AffiliationKind, ConnectionType> = {
  board: 'shared_board',
  congress: 'shared_congress_session',
  institution: 'shared_institution',
  university: 'shared_institution',
  society: 'shared_society',
  disease_area: 'shared_country',
  country: 'shared_country',
}

/** Case- and punctuation-insensitive comparison of organisation names. */
export function normaliseAffiliationName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|of|for|and|university|univ|hospital|centre|center|institute|inst)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** True when two year ranges overlap. Open-ended ranges are treated as open. */
export function yearsOverlap(
  a: { fromYear: number | null; toYear: number | null },
  b: { fromYear: number | null; toYear: number | null },
): boolean {
  const aFrom = a.fromYear ?? -Infinity
  const aTo = a.toYear ?? Infinity
  const bFrom = b.fromYear ?? -Infinity
  const bTo = b.toYear ?? Infinity
  return aFrom <= bTo && bFrom <= aTo
}

export type SuggestedConnection = Omit<Connection, 'id' | 'confirmedBy' | 'confirmedAt'> & {
  status: 'suggested'
}

/**
 * Suggest connections between one member and one person from their declared and
 * public contexts.
 *
 * Three rules that matter more than the matching itself:
 *  - a `private` member declaration is never used (consent is per item);
 *  - an institution overlap only counts when the *years* overlap, because
 *    working somewhere a decade apart is not a connection;
 *  - only the strongest overlap of each connection type is emitted, so a member
 *    who shares four societies does not look four times as connected.
 */
export function suggestConnections(
  profileId: string,
  personId: string,
  memberAffiliations: MemberAffiliation[],
  personAffiliations: PersonAffiliation[],
): SuggestedConnection[] {
  const usable = memberAffiliations.filter((m) => m.visibility === 'network')
  const byType = new Map<ConnectionType, SuggestedConnection>()

  for (const mine of usable) {
    const mineName = normaliseAffiliationName(mine.name)
    if (!mineName) continue

    for (const theirs of personAffiliations) {
      if (theirs.kind !== mine.kind) continue
      if (normaliseAffiliationName(theirs.name) !== mineName) continue
      // Overlapping years are what make a shared institution meaningful.
      if ((mine.kind === 'institution' || mine.kind === 'university') && !yearsOverlap(mine, theirs)) continue

      const connectionType = KIND_TO_CONNECTION[mine.kind]
      const candidate: SuggestedConnection = {
        fromType: 'profile',
        fromId: profileId,
        toType: 'person',
        toId: personId,
        connectionType,
        strength: CONNECTION_STRENGTH[connectionType],
        evidence: [
          {
            kind: mine.kind,
            detail: describeOverlap(mine, theirs),
            sourceUrl: theirs.sourceUrl ?? null,
          },
        ],
        status: 'suggested',
      }

      const existing = byType.get(connectionType)
      if (!existing) {
        byType.set(connectionType, candidate)
      } else {
        // Same type, another piece of corroboration — keep one edge, richer evidence.
        existing.evidence = [...existing.evidence, ...candidate.evidence]
      }
    }
  }

  return [...byType.values()].sort((a, b) => b.strength - a.strength)
}

function describeOverlap(mine: MemberAffiliation, theirs: PersonAffiliation): string {
  const years =
    mine.kind === 'institution' || mine.kind === 'university'
      ? overlapYears(mine, theirs)
      : null
  return years ? `${theirs.name} (${years})` : theirs.name
}

function overlapYears(
  a: { fromYear: number | null; toYear: number | null },
  b: { fromYear: number | null; toYear: number | null },
): string | null {
  const from = Math.max(a.fromYear ?? -Infinity, b.fromYear ?? -Infinity)
  const to = Math.min(a.toYear ?? Infinity, b.toYear ?? Infinity)
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null
  if (!Number.isFinite(to)) return `from ${from}`
  if (!Number.isFinite(from)) return `until ${to}`
  return from === to ? `${from}` : `${from}–${to}`
}
