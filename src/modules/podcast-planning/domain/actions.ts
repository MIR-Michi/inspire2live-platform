'use server'

/**
 * podcast-planning/domain/actions.ts — writes for the planner.
 *
 * Every stage gate in `stages.ts` is enforced *here*, not in the form. A rule
 * that only exists in a component is not a rule — the six-open-asks ceiling in
 * particular has to hold whichever surface asks for the move.
 *
 * Scores are recomputed and snapshotted on write rather than on read, so the
 * number on the card and the audit trail behind it can never disagree.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/kernel/data/server'
import { loadPerson, upsertPeopleByName } from '@/modules/network'
import type {
  ActionResult,
  CandidateStage,
  ClosedReason,
  InvitationKind,
  InvitationResponse,
  QuestionInput,
  ResearchInput,
} from '@/modules/podcast-planning/domain/types'
import {
  canAdvance,
  canDeleteQuestion,
  countOpenAsks,
} from '@/modules/podcast-planning/domain/stages'
import { scoreCandidate } from '@/modules/podcast-planning/domain/scoring'
import { resolvePlanningConfig } from '@/modules/podcast-planning/domain/config'
import {
  loadCandidates,
  loadQuestion,
  planningDb,
  toCandidate,
} from '@/modules/podcast-planning/domain/repository'
import {
  extractPastGuests,
  guestToPersonInput,
  type EpisodeGuestSource,
} from '@/modules/podcast-planning/domain/guest-import'

const PLANNER_PATH = '/app/comms/podcast'

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── Questions ───────────────────────────────────────────────────────────────

function questionPayload(input: Partial<QuestionInput>) {
  return {
    question: input.question?.trim(),
    why_now: input.whyNow ?? null,
    why_now_source_urls: input.whyNowSourceUrls ?? [],
    why_now_at: input.whyNowAt ?? null,
    anchor_date: input.anchorDate ?? null,
    independent_sources: input.independentSources ?? 0,
    ask_type: input.askType ?? null,
    ask_destination_url: input.askDestinationUrl ?? null,
    format: input.format ?? null,
    topic_tags: input.topicTags ?? [],
    initiative_id: input.initiativeId ?? null,
    on_advocacy_agenda: input.onAdvocacyAgenda ?? false,
    patient_relevance: input.patientRelevance ?? 'field',
    question_pull: input.questionPull ?? 0,
    ask_conversion_prior: input.askConversionPrior ?? 0,
    amplification: input.amplification ?? 0,
    owner_id: input.ownerId ?? null,
    status: input.status ?? 'draft',
  }
}

export async function createQuestion(input: QuestionInput): Promise<ActionResult<{ id: string }>> {
  if (!input.question?.trim()) return { ok: false, error: 'Write the question first.' }

  const db = await planningDb()
  const config = await resolvePlanningConfig()

  // The live-question ceiling is advisory in the concept ("three or four live"),
  // so it refuses only when the caller is trying to open one *as live*.
  if ((input.status ?? 'draft') === 'live') {
    const { data: live } = await db.from('podcast_questions').select('id').eq('status', 'live')
    if ((live ?? []).length >= config.liveQuestionLimit) {
      return {
        ok: false,
        error: `${config.liveQuestionLimit} questions are already live. Retire one, or save this as a draft.`,
      }
    }
  }

  const { data, error } = await db
    .from('podcast_questions')
    .insert({ ...questionPayload(input), question: input.question.trim(), created_by: await currentUserId() })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { id: data.id } }
}

export async function updateQuestion(
  questionId: string,
  input: Partial<QuestionInput>,
): Promise<ActionResult> {
  if ('question' in input && !input.question?.trim()) {
    return { ok: false, error: 'A question cannot be blank.' }
  }

  const db = await planningDb()
  const payload = questionPayload(input)
  const supplied = Object.fromEntries(
    Object.entries(payload).filter(([key]) => {
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      return camel in input
    }),
  )
  if (Object.keys(supplied).length === 0) return { ok: true }

  // The same ceiling `createQuestion` applies, for the same reason: a rule that
  // only guards one door is not a rule, and going live by editing is the easier
  // of the two doors to walk through.
  if (supplied.status === 'live') {
    const config = await resolvePlanningConfig()
    const { data: live, error: liveError } = await db
      .from('podcast_questions')
      .select('id')
      .eq('status', 'live')
      .neq('id', questionId)
    if (liveError) return { ok: false, error: liveError.message }
    if ((live ?? []).length >= config.liveQuestionLimit) {
      return {
        ok: false,
        error: `${config.liveQuestionLimit} questions are already live. Retire one, or leave this as a draft.`,
      }
    }
  }

  // Changing where the ask points invalidates the previous verification: the
  // "does the page work" points must be re-earned, not inherited.
  if ('ask_destination_url' in supplied) {
    ;(supplied as Record<string, unknown>).ask_verified_at = null
  }

  const { error } = await db.from('podcast_questions').update(supplied).eq('id', questionId)
  if (error) return { ok: false, error: error.message }

  await rescoreQuestionCandidates(questionId)
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/**
 * Record that a human checked the ask destination actually exists and works.
 * Deliberately a human action: an ask pointing at a broken page wastes the
 * entire episode, and an HTTP 200 is not the same as a page that does the job.
 */
export async function verifyAskDestination(questionId: string): Promise<ActionResult> {
  const db = await planningDb()
  const { error } = await db
    .from('podcast_questions')
    .update({ ask_verified_at: new Date().toISOString() })
    .eq('id', questionId)
  if (error) return { ok: false, error: error.message }

  await rescoreQuestionCandidates(questionId)
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

export async function retireQuestion(questionId: string, reason?: string): Promise<ActionResult> {
  const db = await planningDb()
  const { error } = await db
    .from('podcast_questions')
    .update({ status: 'retired', retired_reason: reason ?? null })
    .eq('id', questionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/**
 * Delete a question outright, where `canDeleteQuestion` allows it.
 *
 * The counts are read here and the rule is applied there, for the same reason
 * `moveCandidate` defers to `canAdvance`: the interesting part is the decision,
 * and a decision that needs a database to exercise does not get exercised.
 */
export async function deleteQuestion(
  questionId: string,
  opts: { confirmCards?: boolean } = {},
): Promise<ActionResult<{ cardsRemoved: number }>> {
  const db = await planningDb()

  const { data: cards, error: cardsError } = await db
    .from('podcast_question_candidates')
    .select('id')
    .eq('question_id', questionId)
  if (cardsError) return { ok: false, error: cardsError.message }

  const cardIds = (cards ?? []).map((c) => c.id)
  const cardCount = cardIds.length

  let invitations = 0
  if (cardCount > 0) {
    const { count, error: inviteError } = await db
      .from('podcast_invitations')
      .select('id', { count: 'exact', head: true })
      .in('candidate_id', cardIds)
    if (inviteError) return { ok: false, error: inviteError.message }
    invitations = count ?? 0
  }

  const verdict = canDeleteQuestion(
    { cards: cardCount, invitations },
    { confirmed: opts.confirmCards },
  )
  if (!verdict.allowed) return { ok: false, error: verdict.reason }

  const { error } = await db.from('podcast_questions').delete().eq('id', questionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { cardsRemoved: cardCount } }
}

// ─── Candidates ──────────────────────────────────────────────────────────────

/** Add a name to a question's wishlist. Names are cheap; forgetting them is not. */
export async function addCandidate(input: {
  questionId: string
  personId: string
  angle?: string | null
  /**
   * Where the name came from. Radar passes its own proposal so "did assisted
   * discovery ever produce somebody who got booked" has an answer; everything
   * else is a person typing, which is the default.
   */
  origin?: 'human' | 'radar'
  radarProposalId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  // The soft reference is checked here, through `network`'s public API, because
  // there is no foreign key to check it for us (ADR-0013 §2).
  const person = await loadPerson(input.personId)
  if (!person) {
    return { ok: false, error: 'That person is not in the People list, or has asked not to be held.' }
  }

  const db = await planningDb()
  const { data, error } = await db
    .from('podcast_question_candidates')
    .insert({
      question_id: input.questionId,
      person_id: input.personId,
      angle: input.angle ?? null,
      origin: input.origin ?? 'human',
      radar_proposal_id: input.radarProposalId ?? null,
      created_by: await currentUserId(),
    })
    .select('id')
    .single()
  if (error) {
    // The unique index is the friendly case: the same name on the same question.
    if (error.code === '23505') return { ok: false, error: 'They are already on this question’s wishlist.' }
    return { ok: false, error: error.message }
  }

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { id: data.id } }
}

/** Store the Research findings and rescore. This is what makes a card askable. */
export async function recordResearch(
  candidateId: string,
  input: ResearchInput,
): Promise<ActionResult> {
  const db = await planningDb()
  const payload: Record<string, unknown> = {}
  if ('angle' in input) payload.angle = input.angle ?? null
  if ('route' in input) payload.route = input.route ?? null
  if ('recentAppearance' in input) payload.recent_appearance = input.recentAppearance
  if ('goodMoment' in input) payload.good_moment = input.goodMoment
  if ('practicalities' in input) payload.practicalities = input.practicalities
  if ('priorRefusal' in input) payload.prior_refusal = input.priorRefusal
  if ('priorRefusalAt' in input) payload.prior_refusal_at = input.priorRefusalAt ?? null
  if ('guestAudience' in input) payload.guest_audience = input.guestAudience

  if (Object.keys(payload).length > 0) {
    const { error } = await db.from('podcast_question_candidates').update(payload).eq('id', candidateId)
    if (error) return { ok: false, error: error.message }
  }

  await rescoreCandidate(candidateId)
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/**
 * Move a card, enforcing the gate.
 *
 * The refusal message is returned to the caller rather than swallowed: a gate
 * that silently does nothing teaches the user that the board is broken.
 */
export async function moveCandidate(
  candidateId: string,
  target: CandidateStage,
  extra: { wakeDate?: string | null; closedReason?: ClosedReason; closedNote?: string | null } = {},
): Promise<ActionResult> {
  const db = await planningDb()
  const { data: row, error: readError } = await db
    .from('podcast_question_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message }
  if (!row) return { ok: false, error: 'That card no longer exists.' }

  const candidate = toCandidate(row)
  const question = await loadQuestion(candidate.questionId)
  if (!question) return { ok: false, error: 'That card’s question no longer exists.' }

  const config = await resolvePlanningConfig()
  const allCandidates = await loadCandidates()
  const verdict = canAdvance(candidate, target, {
    question,
    // The card itself must not count towards the ceiling it is trying to enter.
    openAskCount: countOpenAsks(allCandidates.filter((c) => c.id !== candidateId)),
    config,
  })
  if (!verdict.allowed) return { ok: false, error: verdict.reason }

  if (target === 'not_now' && !extra.wakeDate) {
    return { ok: false, error: 'Set a date to ask again — a sleeping card without one never wakes.' }
  }
  if (target === 'closed' && !extra.closedReason) {
    // The reasons are the point: after twenty of them the routes that work
    // become visible, which is the basis of the whole scoring model.
    return { ok: false, error: 'Record why it closed — the reasons are what the model learns from.' }
  }

  const payload: Record<string, unknown> = {
    stage: target,
    stage_entered_at: new Date().toISOString(),
    wake_date: target === 'not_now' ? extra.wakeDate : null,
    closed_reason: target === 'closed' ? extra.closedReason : null,
    closed_note: target === 'closed' ? (extra.closedNote ?? null) : null,
    closed_at: target === 'closed' ? new Date().toISOString() : null,
  }

  const { error } = await db.from('podcast_question_candidates').update(payload).eq('id', candidateId)
  if (error) return { ok: false, error: error.message }

  // "X has already agreed" is the single most useful sentence in an invitation,
  // so everybody else on this question is rescored the moment somebody accepts.
  if (['planning', 'booked', 'recorded'].includes(target)) {
    await rescoreQuestionCandidates(candidate.questionId)
  }

  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/** One anchor per question: the name whose yes makes every other ask easier. */
export async function setAnchor(candidateId: string): Promise<ActionResult> {
  const db = await planningDb()
  const { data: row, error: readError } = await db
    .from('podcast_question_candidates')
    .select('question_id')
    .eq('id', candidateId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message }
  if (!row) return { ok: false, error: 'That card no longer exists.' }

  // Clear first: the partial unique index allows only one anchor per question.
  const { error: clearError } = await db
    .from('podcast_question_candidates')
    .update({ is_anchor: false })
    .eq('question_id', row.question_id)
    .eq('is_anchor', true)
  if (clearError) return { ok: false, error: clearError.message }

  const { error } = await db
    .from('podcast_question_candidates')
    .update({ is_anchor: true })
    .eq('id', candidateId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/**
 * Push a card to the top regardless of its number.
 *
 * The score never overrules a person — but the decision is recorded rather than
 * hidden, because an override that keeps being right is evidence the model is
 * wrong, not the person (concept §10). A reason is therefore required.
 */
export async function overrideRanking(
  candidateId: string,
  reason: string,
): Promise<ActionResult> {
  if (!reason?.trim()) return { ok: false, error: 'Say why — an unexplained override teaches the model nothing.' }

  const db = await planningDb()
  const { error } = await db
    .from('podcast_question_candidates')
    .update({
      override_by: await currentUserId(),
      override_reason: reason.trim(),
      override_at: new Date().toISOString(),
    })
    .eq('id', candidateId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Recompute one card's score and write a snapshot.
 *
 * The snapshot carries the weights version and the full breakdown, so a weight
 * change stays auditable and any number ever shown can be reproduced.
 */
export async function rescoreCandidate(candidateId: string): Promise<ActionResult<{ total: number }>> {
  const db = await planningDb()
  const { data: row, error } = await db
    .from('podcast_question_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'That card no longer exists.' }

  const candidate = toCandidate(row)
  const question = await loadQuestion(candidate.questionId)
  if (!question) return { ok: false, error: 'That card’s question no longer exists.' }

  const [person, siblings, config] = await Promise.all([
    loadPerson(candidate.personId),
    loadCandidates({ questionId: candidate.questionId }),
    resolvePlanningConfig(),
  ])

  const secured = (c: (typeof siblings)[number]) =>
    ['planning', 'booked', 'recorded'].includes(c.stage)
  const anchorConfirmed = siblings.some((c) => c.isAnchor && c.id !== candidateId && secured(c))
  const peerConfirmed = siblings.some((c) => c.id !== candidateId && secured(c))

  const score = scoreCandidate(candidate, question, {
    anchorConfirmed,
    peerConfirmed,
    // A person who objected or was deleted resolves to null; scoring then runs
    // without their attributes rather than inventing them (concept §16: an
    // unattributed field is excluded from scoring).
    institutionalFriction: person?.institutionalFriction ?? 'none',
    sharesOwnAppearances: person?.sharesOwnAppearances ?? null,
    config,
  })

  const { error: snapshotError } = await db.from('podcast_candidate_scores').insert({
    candidate_id: candidateId,
    weights_version: score.weightsVersion,
    chance_of_yes: score.chanceOfYes,
    reach: score.reach,
    timeliness: score.timeliness,
    followup: score.followup,
    mission: score.mission,
    format_fit: score.formatFit,
    total: score.total,
    explanation: {
      band: score.band,
      strongest: score.strongest,
      weakest: score.weakest,
      breakdown: score.breakdown,
    },
    computed_by: await currentUserId(),
  })
  if (snapshotError) return { ok: false, error: snapshotError.message }

  const { error: updateError } = await db
    .from('podcast_question_candidates')
    .update({
      chance_of_yes: score.chanceOfYes,
      score_total: score.total,
      scored_at: new Date().toISOString(),
    })
    .eq('id', candidateId)
  if (updateError) return { ok: false, error: updateError.message }

  return { ok: true, data: { total: score.total } }
}

/** Rescore every card on a question — used when the question itself changes. */
async function rescoreQuestionCandidates(questionId: string): Promise<void> {
  const candidates = await loadCandidates({ questionId })
  // Only cards that have been scored at least once; an untouched wishlist name
  // is deliberately unscored until somebody researches it.
  for (const candidate of candidates.filter((c) => c.scoredAt !== null)) {
    await rescoreCandidate(candidate.id)
  }
}

// ─── Invitations ─────────────────────────────────────────────────────────────

/**
 * Record an invitation that a human sent.
 *
 * The platform never sends anything itself — for an introduction the introducer
 * writes in their own words from their own inbox, and for a direct approach Amit
 * does. This records what went out so the card knows what it is waiting on.
 */
export async function recordInvitation(input: {
  candidateId: string
  kind: InvitationKind
  introductionRequestId?: string | null
  messageText?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const db = await planningDb()
  const { data, error } = await db
    .from('podcast_invitations')
    .insert({
      candidate_id: input.candidateId,
      kind: input.kind,
      introduction_request_id: input.introductionRequestId ?? null,
      message_text: input.messageText ?? null,
      sent_by: await currentUserId(),
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { id: data.id } }
}

/** One nudge. The card counts the days; this records that the nudge happened. */
export async function nudgeInvitation(invitationId: string): Promise<ActionResult> {
  const db = await planningDb()
  const { error } = await db
    .from('podcast_invitations')
    .update({ nudged_at: new Date().toISOString() })
    .eq('id', invitationId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

/**
 * What came back. A "not now" sets the recall date and puts the card to sleep —
 * the most common *good* outcome of a first ask, never displayed as a loss.
 */
export async function recordInvitationResponse(
  invitationId: string,
  response: InvitationResponse,
  extra: { recallDate?: string | null; notes?: string | null } = {},
): Promise<ActionResult> {
  const db = await planningDb()
  const { data: row, error: readError } = await db
    .from('podcast_invitations')
    .select('id, candidate_id')
    .eq('id', invitationId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message }
  if (!row) return { ok: false, error: 'That invitation no longer exists.' }

  const { error } = await db
    .from('podcast_invitations')
    .update({
      response,
      responded_at: new Date().toISOString(),
      recall_date: extra.recallDate ?? null,
      notes: extra.notes ?? null,
    })
    .eq('id', invitationId)
  if (error) return { ok: false, error: error.message }

  if (response === 'yes') {
    const moved = await moveCandidate(row.candidate_id, 'planning')
    if (!moved.ok) return moved
  } else if (response === 'not_now' && extra.recallDate) {
    const moved = await moveCandidate(row.candidate_id, 'not_now', { wakeDate: extra.recallDate })
    if (!moved.ok) return moved
  } else if (response === 'declined') {
    const moved = await moveCandidate(row.candidate_id, 'closed', {
      closedReason: 'declined',
      closedNote: extra.notes ?? null,
    })
    if (!moved.ok) return moved
  }

  revalidatePath(PLANNER_PATH)
  return { ok: true }
}

// ─── Handover ────────────────────────────────────────────────────────────────

/**
 * Recorded is a handover, not a working stage: the card closes and creates an
 * item in the existing content calendar, which then runs the normal comms
 * workflow. The planner feeds the calendar; it never duplicates it.
 */
export async function handOverToContentCalendar(
  candidateId: string,
  input: { title: string; scheduledFor: string; sourceEventId?: string | null },
): Promise<ActionResult<{ contentCalendarId: string }>> {
  const supabase = await createClient()
  const { data: item, error } = await supabase
    .from('content_calendar')
    .insert({
      title: input.title,
      status: 'draft',
      // The episode then follows the normal comms workflow for editing,
      // publishing and distribution — the planner does not duplicate any of it.
      channels: ['podcast'],
      scheduled_at: input.scheduledFor,
      source_event_id: input.sourceEventId ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  const db = await planningDb()
  const { error: linkError } = await db
    .from('podcast_question_candidates')
    .update({ content_calendar_id: item.id })
    .eq('id', candidateId)
  if (linkError) return { ok: false, error: linkError.message }

  const moved = await moveCandidate(candidateId, 'recorded')
  if (!moved.ok) return moved

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { contentCalendarId: item.id } }
}

// ─── The Guests-tab migration ────────────────────────────────────────────────

/**
 * Move the old Guests roster into the People list.
 *
 * Idempotent: `upsertPeopleByName` matches existing records, so re-running
 * creates nothing new. Safe to expose as a button rather than a one-shot script,
 * which matters because episodes keep being recorded while the planner is used.
 */
export async function importPastGuests(): Promise<
  ActionResult<{ found: number; created: number }>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, name, start_date, podcast_episode_title, podcast_guests')
    .eq('event_type', 'podcast')
  if (error) return { ok: false, error: error.message }

  const episodes: EpisodeGuestSource[] = (data ?? []).map((event) => ({
    id: event.id,
    title: event.podcast_episode_title || event.name,
    startDate: event.start_date,
    guests: event.podcast_guests ?? null,
  }))

  const guests = extractPastGuests(episodes)
  if (guests.length === 0) return { ok: true, data: { found: 0, created: 0 } }

  // People are created through `network`'s own write path (ADR-0009 §9 rule 3).
  const result = await upsertPeopleByName(guests.map((g) => guestToPersonInput(g)))
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath(PLANNER_PATH)
  return { ok: true, data: { found: guests.length, created: result.data?.created ?? 0 } }
}
