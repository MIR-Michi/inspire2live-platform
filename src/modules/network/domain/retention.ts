import 'server-only'

/**
 * network/domain/retention.ts — the eighteen-month promise, kept.
 *
 * `network_people` holds professional information about individuals who never
 * signed up to anything. The basis for that is legitimate interest, and the
 * concept's side of the bargain was explicit: a record nobody has touched in
 * eighteen months is deleted. Written down and never implemented, that promise
 * was worth nothing — and Radar, which creates person records at a rate no
 * human import ever did, is exactly the change that makes it matter.
 *
 * People are `network`'s, so the purge is `network`'s (ADR-0009 §9 rule 3):
 * this is the only place that gets to decide what deleting a person means for
 * the components holding soft references to them.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { moduleClient } from '@/kernel/data'
import { peopleHeldByLiveCards } from '@/modules/network/domain/live-cards'
import type { NetworkDatabase } from '@/modules/network/domain/schema'

export type PurgeResult = {
  eligible: number
  deleted: number
  message: string
}

function monthsAgoIso(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date.toISOString()
}

/**
 * Delete people nobody has touched since the cutoff.
 *
 * Three exemptions, each for a different reason:
 *
 *  - **Members and CRM contacts** (`profile_id` / `crm_contact_id`) are held on
 *    another basis entirely — they are in the platform because they chose to
 *    be, and this job has no business deciding their retention.
 *  - **People still on a live card** are not inactive, whatever the timestamp
 *    says; deleting them would orphan the board.
 *  - **People who objected** keep their row, because the row *is* the
 *    objection. Deleting it would let the next import recreate them.
 *
 * Service-role, because there is no session on a cron and RLS would otherwise
 * silently match nothing — the failure where a retention job reports success
 * and deletes not one record.
 */
export async function purgeInactivePeople(opts: {
  months: number
  dryRun?: boolean
}): Promise<PurgeResult> {
  const db = moduleClient<NetworkDatabase>(createAdminClient())
  const cutoff = monthsAgoIso(opts.months)

  const { data: stale, error } = await db
    .from('network_people')
    .select('id, full_name, profile_id, crm_contact_id, objection_received')
    .lt('last_activity_at', cutoff)
  if (error) throw new Error(`Could not read inactive people: ${error.message}`)

  const eligible = (stale ?? []).filter(
    (person) => !person.profile_id && !person.crm_contact_id && !person.objection_received,
  )
  if (eligible.length === 0) {
    return {
      eligible: 0,
      deleted: 0,
      message: `Nobody has been inactive for ${opts.months} months.`,
    }
  }

  // The soft reference has to be checked by hand: there is no foreign key from
  // `podcast_question_candidates.person_id` to check it for us (ADR-0013 §2),
  // which is the price of the split. It is paid once, in `live-cards.ts`, and
  // shared with the single-person delete.
  const held = await peopleHeldByLiveCards(eligible.map((p) => p.id))
  const toDelete = eligible.filter((person) => !held.has(person.id))

  if (toDelete.length === 0) {
    return {
      eligible: eligible.length,
      deleted: 0,
      message: `${eligible.length} inactive record${eligible.length === 1 ? ' is' : 's are'} still on a live card and were kept.`,
    }
  }
  if (opts.dryRun) {
    return {
      eligible: eligible.length,
      deleted: 0,
      message: `Dry run: ${toDelete.length} of ${eligible.length} inactive record${eligible.length === 1 ? '' : 's'} would be deleted.`,
    }
  }

  const { error: deleteError } = await db
    .from('network_people')
    .delete()
    .in(
      'id',
      toDelete.map((p) => p.id),
    )
  if (deleteError) throw new Error(`Could not delete inactive people: ${deleteError.message}`)

  const keptOnCards = eligible.length - toDelete.length
  return {
    eligible: eligible.length,
    deleted: toDelete.length,
    message:
      `Deleted ${toDelete.length} person record${toDelete.length === 1 ? '' : 's'} untouched for ${opts.months} months` +
      (keptOnCards > 0 ? `; ${keptOnCards} kept because they are still on a live card.` : '.'),
  }
}
