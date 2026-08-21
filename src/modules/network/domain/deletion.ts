/**
 * network/domain/deletion.ts — what deleting a person is allowed to destroy.
 *
 * `deletePerson` has existed since the component shipped as a bare `DELETE`
 * with a docstring claiming it was "where the consequences of a deletion are
 * decided". Nothing decided anything; it was simply never called. These are
 * those consequences, written as a pure rule so they can be tested without a
 * database and enforced in the action rather than in a form.
 *
 * The database cascades three tables off `network_people`: affiliations,
 * connection checks and introduction requests. The last of those is the one
 * with a consequence nobody would predict — introducer fatigue is computed from
 * the request history, so deleting a person quietly resets the cooldown of
 * every colleague who was ever asked about them. That is not a reason to refuse
 * the deletion, but it is a reason to say so before it happens.
 *
 * Podcast cards are a different matter and are handled by refusal, because
 * there is no foreign key to refuse for us (ADR-0013 §2).
 */

export type PersonHistory = {
  /** Wishlist cards not yet closed. Checked by hand — there is no foreign key. */
  liveCards: number
  /** Introduction requests, whose loss silently resets introducer cooldowns. */
  introductions: number
  /** Map questions somebody actually answered — the connection graph's evidence. */
  answeredChecks: number
  /** True when the record belongs to a platform member. */
  isMember: boolean
  /** True when the person is linked to a CRM contact, which survives regardless. */
  inCrm: boolean
}

export type PersonDeletionVerdict =
  | { allowed: true; confirm?: string }
  | { allowed: false; reason: string }

function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Decide whether this person can be removed.
 *
 * Two refusals and one confirmation:
 *
 *  - **A member's record is not the podcast planner's to delete.** It exists
 *    because they have a profile, and removing it here would take an internal
 *    person out of everybody else's routing to tidy one screen.
 *  - **Somebody on a live card stays.** The board would render them as an
 *    orphan and ask a human to repair something that was deliberate — the same
 *    exemption the retention purge already makes.
 *  - **History gets a confirmation, naming what goes with it**, because the
 *    cascade is invisible from the screen where the button lives.
 */
export function canDeletePerson(
  history: PersonHistory,
  opts: { confirmed?: boolean } = {},
): PersonDeletionVerdict {
  if (history.isMember) {
    return {
      allowed: false,
      reason:
        'This record belongs to a platform member, so it is theirs rather than the podcast planner’s. Remove it from their profile if it should not exist.',
    }
  }

  if (history.liveCards > 0) {
    return {
      allowed: false,
      reason: `They are on ${count(history.liveCards, 'card')} that ${history.liveCards === 1 ? 'is' : 'are'} still open. Close the card first — deleting them now would leave it on the board with nobody attached.`,
    }
  }

  const losses: string[] = []
  if (history.introductions > 0) {
    losses.push(
      `${count(history.introductions, 'introduction request')}, which also clears the cooldown of whoever was asked`,
    )
  }
  if (history.answeredChecks > 0) {
    losses.push(`${count(history.answeredChecks, 'answered “do you know them” question')}`)
  }

  if (losses.length > 0 && !opts.confirmed) {
    const survives = history.inCrm ? ' Their CRM contact is not affected.' : ''
    return {
      allowed: true,
      confirm: `Deleting them also deletes ${losses.join(' and ')}.${survives} Remove anyway?`,
    }
  }

  return { allowed: true }
}
