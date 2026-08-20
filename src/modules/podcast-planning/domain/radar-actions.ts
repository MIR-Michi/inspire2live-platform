'use server'

/**
 * podcast-planning/domain/radar-actions.ts — the two gestures a proposal
 * supports, and the button that produces one.
 *
 * The whole review interaction is: **open it, or wave it away with a reason.**
 * There is no edit-before-accept, no partial save and no third state, because
 * every one of those turns a five-second decision into a form — and a review
 * that takes a form is a review that does not happen.
 *
 * What accepting writes is deliberately modest. People go in through
 * `network`'s own write path (ADR-0009 §9 rule 3), cards go in **unscored** at
 * Wishlist, and nothing is ever moved further along. Radar's job ends the
 * moment a human agrees the name is worth researching.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/kernel/data/server'
import { upsertPeopleByName } from '@/modules/network'
import type { PersonInput } from '@/modules/network'
import type { ActionResult } from '@/modules/podcast-planning/domain/types'
import { addCandidate, createQuestion } from '@/modules/podcast-planning/domain/actions'
import { loadQuestion, planningDb } from '@/modules/podcast-planning/domain/repository'
import { resolveRadarConfig } from '@/modules/podcast-planning/domain/radar-config'
import {
  loadProposal,
  loadSignalsByIds,
  toProposal,
} from '@/modules/podcast-planning/domain/radar-repository'
import { countIndependentSources } from '@/modules/podcast-planning/domain/radar-types'
import type { DismissReason, SuggestedName } from '@/modules/podcast-planning/domain/radar-types'
import { runFindNames } from '@/modules/podcast-planning/domain/radar'

const PLANNER_PATH = '/app/comms/podcast'

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── Asking ──────────────────────────────────────────────────────────────────

/**
 * "Who could answer this?" — for a question that already exists.
 *
 * Runs inline rather than through the scheduled lock: one lane, one model call,
 * a person waiting. Errors come back as text the caller shows, because the
 * three ways this fails — the source is down, the model is off, nothing was
 * found — need three different responses from the reader.
 */
export async function findNamesForQuestion(
  questionId: string,
): Promise<ActionResult<{ proposalId: string | null; message: string; suggested: number }>> {
  const question = await loadQuestion(questionId)
  if (!question) return { ok: false, error: 'That question no longer exists.' }

  const [db, config] = await Promise.all([planningDb(), resolveRadarConfig()])

  try {
    const result = await runFindNames(db, question, config, { createdBy: await currentUserId() })
    revalidatePath(PLANNER_PATH)
    return {
      ok: true,
      data: { proposalId: result.proposalId, message: result.message, suggested: result.suggested },
    }
  } catch (error) {
    console.error('[podcast-planning] findNamesForQuestion failed:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The search could not be completed.',
    }
  }
}

// ─── Accepting ───────────────────────────────────────────────────────────────

/**
 * Attribute every field Radar supplied to the record it came from.
 *
 * Concept §16: a field with no source is excluded from scoring. Radar's whole
 * claim to be trustworthy is that this map is never empty and never invented —
 * the angle is attributed to the *model*, honestly, so nobody later mistakes an
 * editorial sentence for something a source said.
 */
function attribution(name: SuggestedName, signalUrl: string | null): Record<string, string> {
  const source = name.url ?? signalUrl ?? 'openalex'
  const map: Record<string, string> = { fullName: source }
  if (name.organisation) map.organisation = source
  if (name.country) map.country = source
  if (name.role) map.roleTitle = source
  map.whatTheyCanSay = 'ai:podcast_radar'
  return map
}

/**
 * Open a proposal: create what it suggested, and record that it was Radar's.
 *
 * `selected` is indices into `names` rather than the names themselves, so a
 * stale page cannot resurrect a suggestion that was dropped on the read path.
 * Passing nothing accepts everything, which is the common case and the reason
 * the card's primary button is one tap.
 */
export async function acceptProposal(
  proposalId: string,
  opts: { selected?: number[] } = {},
): Promise<ActionResult<{ questionId: string; created: number }>> {
  const proposal = await loadProposal(proposalId)
  if (!proposal) return { ok: false, error: 'That suggestion no longer exists.' }
  if (proposal.status !== 'pending') {
    return { ok: false, error: 'That suggestion has already been dealt with.' }
  }

  const chosen =
    opts.selected === undefined
      ? proposal.names
      : proposal.names.filter((_, index) => opts.selected?.includes(index))

  // ── The question: an existing one, or a new draft.
  let questionId = proposal.questionId
  if (!questionId) {
    const signals = await loadSignalsByIds(proposal.signalIds)
    const resolved = [...signals.values()]
    const created = await createQuestion({
      question: proposal.proposedQuestion,
      whyNow: proposal.whyNow,
      whyNowSourceUrls: resolved.map((s) => s.url).filter((u): u is string => Boolean(u)),
      whyNowAt: proposal.whyNowAt,
      // Counted from the records, never taken from the model — this is the
      // number the timeliness score reads (ADR-0016 §3).
      independentSources: countIndependentSources(resolved),
      topicTags: [],
      // A draft, always. Radar proposes; going live is an editorial decision
      // with a ceiling attached, and it stays a human one.
      status: 'draft',
    })
    if (!created.ok) return { ok: false, error: created.error }
    questionId = created.data!.id
  } else if (!(await loadQuestion(questionId))) {
    return { ok: false, error: 'The question this was for no longer exists.' }
  }

  // ── The people, through `network`'s write path.
  let createdCards = 0
  if (chosen.length > 0) {
    const signals = await loadSignalsByIds(chosen.map((n) => n.signalId))
    const inputs: PersonInput[] = chosen.map((name) => ({
      fullName: name.name,
      roleTitle: name.role,
      organisation: name.organisation,
      country: name.country,
      whatTheyCanSay: name.angle,
      publicProfileUrls: name.url ? [{ label: 'Source', url: name.url }] : [],
      origin: 'external',
      sourceAttribution: attribution(name, signals.get(name.signalId)?.url ?? null),
    }))

    const people = await upsertPeopleByName(inputs)
    if (!people.ok) return { ok: false, error: people.error }

    for (const name of chosen) {
      const personId = people.data?.ids[name.name]
      // A name `network` declined to create — objected to, or a merge that went
      // the other way — is skipped rather than failing the whole acceptance.
      if (!personId) continue
      const card = await addCandidate({
        questionId,
        personId,
        angle: name.angle,
        origin: 'radar',
        radarProposalId: proposal.id,
      })
      if (card.ok) createdCards += 1
    }
  }

  const db = await planningDb()
  const { error } = await db
    .from('podcast_radar_proposals')
    .update({
      status: 'opened',
      decided_by: await currentUserId(),
      decided_at: new Date().toISOString(),
      opened_question_id: questionId,
      opened_candidates: createdCards,
    })
    .eq('id', proposalId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { questionId, created: createdCards } }
}

// ─── Dismissing ──────────────────────────────────────────────────────────────

/**
 * Wave a proposal away.
 *
 * The reason is required and is one of three taps. It is the only training
 * signal Radar will ever get — "already covered" and "not our agenda" mean
 * completely different things to a future relevance rule, and a single
 * undifferentiated "no" would have told us neither.
 */
export async function dismissProposal(
  proposalId: string,
  reason: DismissReason,
): Promise<ActionResult> {
  const db = await planningDb()
  const { error } = await db
    .from('podcast_radar_proposals')
    .update({
      status: 'dismissed',
      dismissed_reason: reason,
      decided_by: await currentUserId(),
      decided_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }

  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/** Keep it for later without deciding. Stays out of the count of things waiting. */
export async function deferProposal(proposalId: string): Promise<ActionResult> {
  const db = await planningDb()
  const { error } = await db
    .from('podcast_radar_proposals')
    .update({ status: 'later', decided_by: await currentUserId(), decided_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/** Re-read a proposal after a write, for a caller that needs the fresh row. */
export async function reloadProposal(proposalId: string) {
  const db = await planningDb()
  const { data } = await db
    .from('podcast_radar_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle()
  return data ? toProposal(data) : null
}
