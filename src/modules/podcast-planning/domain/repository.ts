/**
 * podcast-planning/domain/repository.ts — reads for the planner.
 *
 * The board view is assembled here: candidates from this component's own tables,
 * people from `network`'s **public API** (never its tables). That two-source read
 * is the visible cost of the ADR-0013 split and the reason the `network`
 * component can be lifted out later.
 *
 * Defensive throughout: every query checks its error and degrades to an empty
 * board rather than throwing into a Server Component.
 */

import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import { loadPeopleByIds } from '@/modules/network'
import type { NetworkPerson } from '@/modules/network'
import type { PlanningDatabase, CandidateRow, QuestionRow } from '@/modules/podcast-planning/domain/schema'
import type {
  AskType,
  CandidateRoute,
  CandidateStage,
  ClosedReason,
  EpisodeFormat,
  Invitation,
  InvitationKind,
  InvitationResponse,
  PodcastQuestion,
  PriorRefusal,
  QuestionCandidate,
  QuestionStatus,
  RecentAppearance,
} from '@/modules/podcast-planning/domain/types'
import { waitingState, type WaitingState } from '@/modules/podcast-planning/domain/stages'
import { resolvePlanningConfig } from '@/modules/podcast-planning/domain/config'

export async function planningDb() {
  const supabase = await createClient()
  return moduleClient<PlanningDatabase>(supabase)
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

export function toQuestion(row: QuestionRow): PodcastQuestion {
  return {
    id: row.id,
    question: row.question,
    whyNow: row.why_now,
    whyNowSourceUrls: row.why_now_source_urls ?? [],
    whyNowAt: row.why_now_at,
    anchorDate: row.anchor_date,
    independentSources: row.independent_sources ?? 0,
    askType: (row.ask_type as AskType | null) ?? null,
    askDestinationUrl: row.ask_destination_url,
    askVerifiedAt: row.ask_verified_at,
    format: (row.format as EpisodeFormat | null) ?? null,
    topicTags: row.topic_tags ?? [],
    initiativeId: row.initiative_id,
    onAdvocacyAgenda: row.on_advocacy_agenda,
    patientRelevance: (row.patient_relevance as PodcastQuestion['patientRelevance']) ?? 'field',
    questionPull: row.question_pull ?? 0,
    askConversionPrior: row.ask_conversion_prior ?? 0,
    amplification: row.amplification ?? 0,
    ownerId: row.owner_id,
    status: (row.status as QuestionStatus) ?? 'draft',
    updatedAt: row.updated_at,
  }
}

export function toCandidate(row: CandidateRow): QuestionCandidate {
  return {
    id: row.id,
    questionId: row.question_id,
    personId: row.person_id,
    angle: row.angle,
    stage: (row.stage as CandidateStage) ?? 'wishlist',
    stageEnteredAt: row.stage_entered_at,
    isAnchor: row.is_anchor,
    route: (row.route as CandidateRoute | null) ?? null,
    recentAppearance: (row.recent_appearance as RecentAppearance) ?? 'none',
    goodMoment: row.good_moment ?? 0,
    practicalities: row.practicalities ?? 0,
    priorRefusal: (row.prior_refusal as PriorRefusal) ?? 'none',
    priorRefusalAt: row.prior_refusal_at,
    guestAudience: row.guest_audience ?? 0,
    chanceOfYes: row.chance_of_yes,
    scoreTotal: row.score_total,
    scoredAt: row.scored_at,
    wakeDate: row.wake_date,
    closedReason: (row.closed_reason as ClosedReason | null) ?? null,
    closedNote: row.closed_note,
    overrideBy: row.override_by,
    overrideReason: row.override_reason,
    overrideAt: row.override_at,
    recordingDate: row.recording_date,
    consentConfirmed: row.consent_confirmed,
    seatsFilled: row.seats_filled,
    willShare: row.will_share,
    contentCalendarId: row.content_calendar_id,
  }
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function loadQuestions(
  opts: { status?: QuestionStatus | 'all' } = {},
): Promise<PodcastQuestion[]> {
  const db = await planningDb()
  let query = db.from('podcast_questions').select('*').order('updated_at', { ascending: false })
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) {
    console.error('[podcast-planning] loadQuestions failed:', error.message)
    return []
  }
  return (data ?? []).map(toQuestion)
}

export async function loadQuestion(questionId: string): Promise<PodcastQuestion | null> {
  const db = await planningDb()
  const { data, error } = await db
    .from('podcast_questions')
    .select('*')
    .eq('id', questionId)
    .maybeSingle()
  if (error) {
    console.error('[podcast-planning] loadQuestion failed:', error.message)
    return null
  }
  return data ? toQuestion(data) : null
}

// ─── Candidates ──────────────────────────────────────────────────────────────

export async function loadCandidates(
  opts: { questionId?: string; stages?: CandidateStage[] } = {},
): Promise<QuestionCandidate[]> {
  const db = await planningDb()
  let query = db
    .from('podcast_question_candidates')
    .select('*')
    .order('stage_entered_at', { ascending: true })
  if (opts.questionId) query = query.eq('question_id', opts.questionId)
  if (opts.stages?.length) query = query.in('stage', opts.stages)

  const { data, error } = await query
  if (error) {
    console.error('[podcast-planning] loadCandidates failed:', error.message)
    return []
  }
  return (data ?? []).map(toCandidate)
}

// ─── The board ───────────────────────────────────────────────────────────────

/**
 * A card as the board shows it: the candidate, the person behind it, the
 * question it belongs to, and the derived waiting state.
 */
export type BoardCard = {
  candidate: QuestionCandidate
  /**
   * Null when the person record is gone or has objected. The card is still
   * rendered — as repairable rather than as a crash — which is the mitigation
   * ADR-0013 accepted in exchange for dropping the cross-component foreign key.
   */
  person: NetworkPerson | null
  question: PodcastQuestion
  waiting: WaitingState
}

export type BoardView = {
  questions: PodcastQuestion[]
  cards: BoardCard[]
  openAskCount: number
  /** Cards whose person could not be resolved — surfaced, never hidden. */
  orphanedCards: number
}

/** Everything the Board screen needs, in three queries. */
export async function loadBoard(opts: { questionId?: string } = {}): Promise<BoardView> {
  const config = await resolvePlanningConfig()
  const [questions, candidates] = await Promise.all([
    loadQuestions({ status: 'all' }),
    loadCandidates({ questionId: opts.questionId }),
  ])

  const questionById = new Map(questions.map((q) => [q.id, q]))
  const people = await loadPeopleByIds(candidates.map((c) => c.personId))

  const cards: BoardCard[] = []
  for (const candidate of candidates) {
    const question = questionById.get(candidate.questionId)
    // A candidate whose question vanished is not a card; the DB cascade makes
    // this unreachable, but the board must not invent a question either.
    if (!question) continue
    cards.push({
      candidate,
      person: people.get(candidate.personId) ?? null,
      question,
      waiting: waitingState(candidate, { config }),
    })
  }

  return {
    questions,
    cards,
    // The ceiling is global, so it is counted across every question regardless
    // of the filter the user is looking through.
    openAskCount: (await loadCandidates()).filter((c) => c.stage === 'ask').length,
    orphanedCards: cards.filter((c) => c.person === null).length,
  }
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export async function loadInvitations(candidateId: string): Promise<Invitation[]> {
  const db = await planningDb()
  const { data, error } = await db
    .from('podcast_invitations')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('sent_at', { ascending: false })
  if (error) {
    console.error('[podcast-planning] loadInvitations failed:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    candidateId: r.candidate_id,
    kind: r.kind as InvitationKind,
    introductionRequestId: r.introduction_request_id,
    sentBy: r.sent_by,
    sentAt: r.sent_at,
    messageText: r.message_text,
    nudgedAt: r.nudged_at,
    response: (r.response as InvitationResponse | null) ?? null,
    respondedAt: r.responded_at,
    recallDate: r.recall_date,
    notes: r.notes,
  }))
}

// ─── Score history ───────────────────────────────────────────────────────────

export type ScoreSnapshot = {
  id: string
  computedAt: string
  weightsVersion: string
  total: number
  parts: { chanceOfYes: number; reach: number; timeliness: number; followup: number; mission: number; formatFit: number }
}

/** The audit trail behind the number on the card. */
export async function loadScoreHistory(candidateId: string): Promise<ScoreSnapshot[]> {
  const db = await planningDb()
  const { data, error } = await db
    .from('podcast_candidate_scores')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('computed_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('[podcast-planning] loadScoreHistory failed:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    computedAt: r.computed_at,
    weightsVersion: r.weights_version,
    total: r.total,
    parts: {
      chanceOfYes: r.chance_of_yes,
      reach: r.reach,
      timeliness: r.timeliness,
      followup: r.followup,
      mission: r.mission,
      formatFit: r.format_fit,
    },
  }))
}
