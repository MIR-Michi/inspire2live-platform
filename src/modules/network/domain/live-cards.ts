import 'server-only'

/**
 * network/domain/live-cards.ts — the one place this component looks outward.
 *
 * `podcast_question_candidates.person_id` deliberately carries no foreign key
 * (ADR-0013 §2), so the database cannot refuse to delete somebody who is still
 * on a board. That check has to be made by hand, and this is the only file
 * allowed to make it: the retention purge and the single-person delete both ask
 * the same question, and two implementations of "is this person still in use"
 * would eventually disagree about who may be destroyed.
 *
 * Deliberately service-role, even when a signed-in human is driving. A guard
 * that reads through RLS and sees nothing returns the same answer as a guard
 * that read everything and found nothing — and here those two answers mean
 * opposite things. This one has to fail closed.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Of the people given, which are still attached to a card that is not closed.
 *
 * Throws rather than returning an empty set on failure: a silent empty answer
 * here reads as "safe to delete".
 */
export async function peopleHeldByLiveCards(personIds: string[]): Promise<Set<string>> {
  if (personIds.length === 0) return new Set()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('podcast_question_candidates')
    .select('person_id')
    .in('person_id', personIds)
    .neq('stage', 'closed')
  if (error) throw new Error(`Could not check live cards: ${error.message}`)

  return new Set((data ?? []).map((row: { person_id: string }) => row.person_id))
}
