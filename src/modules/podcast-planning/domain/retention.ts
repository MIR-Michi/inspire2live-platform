import 'server-only'

/**
 * podcast-planning/domain/retention.ts — the promise this component made about
 * how long it keeps things, kept.
 *
 * The engine concept committed to anonymising a closed card after a year. Until
 * now that was a sentence in a document, which is the least useful place for a
 * retention rule to live: the moment volume arrives — and Radar is what brings
 * volume — an unkept promise becomes a real exposure.
 *
 * What survives is chosen carefully. The **reason** a card closed is the only
 * thing the scoring model ever learns from ("after twenty refusals the routes
 * that work become visible"), so it stays. The note somebody typed and the
 * person the card pointed at do not.
 *
 * People themselves belong to `network` and are purged by `network`'s own job.
 * This one only touches cards.
 */

import type { PlanningClient } from '@/modules/podcast-planning/domain/radar-repository'

export type RetentionResult = {
  scanned: number
  anonymised: number
  message: string
}

/**
 * Decide whether a request asked for a rehearsal.
 *
 * Deliberately generous, and that asymmetry is the whole point: this job
 * deletes. Somebody who typed `?dryRun=true` and got a live purge because the
 * code wanted `1` has been failed by the code, and the row is not coming back.
 * So the parameter's *presence* means rehearse, and only an explicit denial —
 * `0`, `false`, `no` — overrides it. Absent means go ahead, which is what the
 * scheduler sends.
 */
export function asksForRehearsal(value: string | null): boolean {
  return value !== null && !/^(0|false|no)$/i.test(value.trim())
}

function monthsAgoIso(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date.toISOString()
}

/**
 * Strip the identifying parts of long-closed cards.
 *
 * Deliberately an update rather than a delete: deleting the row would take the
 * closed reason with it and quietly degrade the model, and it would also make
 * the count of past attempts wrong. The card becomes a tally mark.
 *
 * Idempotent — a second run matches nothing, because an anonymised card no
 * longer has a note or a person to clear.
 */
export async function anonymiseClosedCards(
  db: PlanningClient,
  opts: { months: number; dryRun?: boolean },
): Promise<RetentionResult> {
  const cutoff = monthsAgoIso(opts.months)

  const { data, error } = await db
    .from('podcast_question_candidates')
    .select('id')
    .eq('stage', 'closed')
    .lt('closed_at', cutoff)
    .not('person_id', 'is', null)
  if (error) throw new Error(`Could not read closed cards: ${error.message}`)

  const ids = (data ?? []).map((row) => row.id)
  if (ids.length === 0) {
    return {
      scanned: 0,
      anonymised: 0,
      message: `No cards closed more than ${opts.months} months ago still hold a person.`,
    }
  }

  if (opts.dryRun) {
    return {
      scanned: ids.length,
      anonymised: 0,
      message: `Would anonymise ${ids.length} card${ids.length === 1 ? '' : 's'} closed more than ${opts.months} months ago. Nothing was changed.`,
    }
  }

  const { error: updateError } = await db
    .from('podcast_question_candidates')
    .update({
      // The all-zero UUID rather than null: `person_id` is not nullable, and a
      // sentinel that resolves to nobody renders as an already-handled orphan
      // card instead of crashing the board.
      person_id: '00000000-0000-0000-0000-000000000000',
      angle: null,
      closed_note: null,
      override_reason: null,
    })
    .in('id', ids)
  if (updateError) throw new Error(`Could not anonymise closed cards: ${updateError.message}`)

  return {
    scanned: ids.length,
    anonymised: ids.length,
    message: `Anonymised ${ids.length} card${ids.length === 1 ? '' : 's'} closed more than ${opts.months} months ago. Their closed reasons were kept.`,
  }
}
