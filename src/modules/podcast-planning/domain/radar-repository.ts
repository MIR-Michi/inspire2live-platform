/**
 * podcast-planning/domain/radar-repository.ts — reads and persistence for Radar.
 *
 * Two clients on purpose. A person pressing "Find names" is a session, and RLS
 * should apply to them exactly as it does everywhere else. A fortnightly cron
 * has no session at all, and the same RLS would silently filter every insert to
 * nothing — the failure mode where a job reports success and writes no rows.
 * `planningAdminDb()` is therefore reached for by background paths only, and
 * every caller of it is a route that has already checked `CRON_SECRET`.
 *
 * Defensive throughout, like the rest of the component: a read that fails logs
 * and degrades rather than throwing into a Server Component.
 */

import { createClient } from '@/kernel/data/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { moduleClient } from '@/kernel/data'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PlanningDatabase,
  RadarProposalRow,
  RadarSignalRow,
} from '@/modules/podcast-planning/domain/schema'
import type {
  DismissReason,
  ProposalStatus,
  RadarMode,
  RadarProposal,
  RadarRunState,
  RadarRunStatus,
  RadarSignal,
  RadarSignalInput,
  SignalPerson,
  SignalSource,
  SuggestedName,
} from '@/modules/podcast-planning/domain/radar-types'
import { radarDedupeKey } from '@/modules/podcast-planning/domain/radar-types'

export type PlanningClient = SupabaseClient<PlanningDatabase>

export async function planningAdminDb(): Promise<PlanningClient> {
  return moduleClient<PlanningDatabase>(createAdminClient())
}

async function sessionDb(): Promise<PlanningClient> {
  const supabase = await createClient()
  return moduleClient<PlanningDatabase>(supabase)
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function asPeople(value: unknown): SignalPerson[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) return []
    const str = (key: string) => (typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : null)
    return [{
      name,
      role: str('role'),
      organisation: str('organisation'),
      country: str('country'),
      externalId: str('externalId'),
      url: str('url'),
    }]
  })
}

function asNames(value: unknown): SuggestedName[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const signalId = typeof raw.signalId === 'string' ? raw.signalId : ''
    // The drop-unsourced rule again, on the read path: a stored suggestion with
    // no source is not shown, whatever put it there.
    if (!name || !signalId) return []
    const str = (key: string) => (typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : null)
    return [{
      name,
      role: str('role'),
      organisation: str('organisation'),
      country: str('country'),
      angle: typeof raw.angle === 'string' ? raw.angle : '',
      signalId,
      url: str('url'),
      sourceCount: typeof raw.sourceCount === 'number' ? raw.sourceCount : 1,
    }]
  })
}

export function toSignal(row: RadarSignalRow): RadarSignal {
  return {
    id: row.id,
    source: row.source as SignalSource,
    externalId: row.external_id,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    people: asPeople(row.people),
    discoveredAt: row.discovered_at,
  }
}

export function toProposal(row: RadarProposalRow): RadarProposal {
  return {
    id: row.id,
    questionId: row.question_id,
    mode: row.mode as RadarMode,
    proposedQuestion: row.proposed_question,
    whyNow: row.why_now,
    whyNowAt: row.why_now_at,
    signalIds: row.signal_ids ?? [],
    names: asNames(row.names),
    status: row.status as ProposalStatus,
    dismissedReason: (row.dismissed_reason as DismissReason | null) ?? null,
    decidedAt: row.decided_at,
    openedQuestionId: row.opened_question_id,
    openedCandidates: row.opened_candidates ?? 0,
    createdAt: row.created_at,
  }
}

// ─── Signals ─────────────────────────────────────────────────────────────────

/**
 * Store what the sources returned and give back the rows, new or already known.
 *
 * Upsert on the dedupe key rather than insert-and-ignore, because the caller
 * needs the *ids* of every signal — including ones a previous run already
 * stored. A "Find names" that silently lost half its evidence to a prior scan
 * would produce a proposal citing two papers out of eleven.
 */
export async function storeSignals(
  db: PlanningClient,
  inputs: RadarSignalInput[],
): Promise<{ signals: RadarSignal[]; created: number }> {
  if (inputs.length === 0) return { signals: [], created: 0 }

  const byKey = new Map<string, RadarSignalInput>()
  for (const input of inputs) byKey.set(radarDedupeKey(input.source, input.externalId), input)
  const keys = [...byKey.keys()]

  const { data: before } = await db
    .from('podcast_radar_signals')
    .select('dedupe_key')
    .in('dedupe_key', keys)
  const known = new Set((before ?? []).map((r) => r.dedupe_key))

  const { error } = await db.from('podcast_radar_signals').upsert(
    [...byKey.entries()].map(([dedupeKey, input]) => ({
      source: input.source,
      external_id: input.externalId,
      title: input.title,
      url: input.url,
      published_at: input.publishedAt,
      people: input.people as unknown,
      payload: (input.payload ?? {}) as unknown,
      dedupe_key: dedupeKey,
    })),
    { onConflict: 'dedupe_key' },
  )
  if (error) throw new Error(`Could not store signals: ${error.message}`)

  const { data, error: readError } = await db
    .from('podcast_radar_signals')
    .select('*')
    .in('dedupe_key', keys)
  if (readError) throw new Error(`Could not read back signals: ${readError.message}`)

  return {
    signals: (data ?? []).map(toSignal),
    created: keys.filter((k) => !known.has(k)).length,
  }
}

export async function loadSignalsByIds(ids: string[]): Promise<Map<string, RadarSignal>> {
  if (ids.length === 0) return new Map()
  const db = await sessionDb()
  const { data, error } = await db.from('podcast_radar_signals').select('*').in('id', [...new Set(ids)])
  if (error) {
    console.error('[podcast-planning] loadSignalsByIds failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((row) => [row.id, toSignal(row)]))
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export async function loadProposals(
  opts: { status?: ProposalStatus | 'all'; questionId?: string; limit?: number } = {},
): Promise<RadarProposal[]> {
  const db = await sessionDb()
  let query = db
    .from('podcast_radar_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)
  if (opts.questionId) query = query.eq('question_id', opts.questionId)

  const { data, error } = await query
  if (error) {
    console.error('[podcast-planning] loadProposals failed:', error.message)
    return []
  }
  return (data ?? []).map(toProposal)
}

export async function loadProposal(proposalId: string): Promise<RadarProposal | null> {
  const db = await sessionDb()
  const { data, error } = await db
    .from('podcast_radar_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle()
  if (error) {
    console.error('[podcast-planning] loadProposal failed:', error.message)
    return null
  }
  return data ? toProposal(data) : null
}

/**
 * How many proposals are waiting, for a caller with no session.
 *
 * Separate from `loadProposals` for the reason spelled out below: the digest
 * cron holds a service-role client, and the session reader would hand it zero.
 */
export async function countPendingProposals(db: PlanningClient): Promise<number> {
  const { count, error } = await db
    .from('podcast_radar_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) {
    console.error('[podcast-planning] countPendingProposals failed:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * What reviewers have turned down, for the scan to learn from.
 *
 * Takes the client rather than opening a session, because the only caller is a
 * cron: under RLS a scheduled run would read zero dismissals and quietly lose
 * the one mechanism that stops it re-proposing the same rejected topic.
 */
export async function loadRecentDismissals(
  db: PlanningClient,
  limit = 40,
): Promise<Array<{ question: string; reason: string | null }>> {
  const { data, error } = await db
    .from('podcast_radar_proposals')
    .select('proposed_question, dismissed_reason')
    .eq('status', 'dismissed')
    .order('decided_at', { ascending: false })
    .limit(limit)
  if (error) {
    // Losing the examples degrades the prompt; it must not fail the scan.
    console.error('[podcast-planning] loadRecentDismissals failed:', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    question: row.proposed_question,
    reason: row.dismissed_reason,
  }))
}

export type ProposalDraft = {
  questionId: string | null
  mode: RadarMode
  proposedQuestion: string
  whyNow: string | null
  whyNowAt: string | null
  signalIds: string[]
  names: SuggestedName[]
  model: string | null
  effort: string | null
  rawResponse: unknown
  createdBy: string | null
}

/**
 * Write a proposal, retiring any pending one for the same question first.
 *
 * A second "Find names" replaces rather than stacks. The partial unique index
 * enforces it in the database; this supersedes explicitly so the previous
 * proposal stays on the record instead of being deleted — what was suggested
 * and not taken is worth as much as what was.
 */
export async function saveProposal(db: PlanningClient, draft: ProposalDraft): Promise<string> {
  if (draft.questionId) {
    const { error: supersedeError } = await db
      .from('podcast_radar_proposals')
      .update({ status: 'superseded' })
      .eq('question_id', draft.questionId)
      .eq('status', 'pending')
    if (supersedeError) throw new Error(supersedeError.message)
  }

  const { data, error } = await db
    .from('podcast_radar_proposals')
    .insert({
      question_id: draft.questionId,
      mode: draft.mode,
      proposed_question: draft.proposedQuestion,
      why_now: draft.whyNow,
      why_now_at: draft.whyNowAt,
      signal_ids: draft.signalIds,
      names: draft.names as unknown,
      model: draft.model,
      effort: draft.effort,
      raw_response: (draft.rawResponse ?? {}) as unknown,
      created_by: draft.createdBy,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

// ─── Run status ──────────────────────────────────────────────────────────────

const STATUS_COLUMNS =
  'last_run_status, last_run_started_at, last_run_finished_at, last_run_message, last_run_inserted'

function toRunStatus(row: Partial<import('@/modules/podcast-planning/domain/schema').RadarStatusRow> | null): RadarRunStatus {
  return {
    status: (row?.last_run_status as RadarRunState) ?? 'idle',
    message: row?.last_run_message ?? null,
    startedAt: row?.last_run_started_at ?? null,
    finishedAt: row?.last_run_finished_at ?? null,
    inserted: row?.last_run_inserted ?? null,
  }
}

export async function loadRadarStatus(): Promise<RadarRunStatus> {
  const db = await sessionDb()
  const { data, error } = await db
    .from('podcast_radar_status')
    .select(STATUS_COLUMNS)
    .eq('singleton', true)
    .maybeSingle()
  if (error) {
    console.error('[podcast-planning] loadRadarStatus failed:', error.message)
    return toRunStatus(null)
  }
  return toRunStatus(data)
}

export async function writeRadarStatus(
  db: PlanningClient,
  payload: Partial<import('@/modules/podcast-planning/domain/schema').RadarStatusRow>,
): Promise<void> {
  const { error } = await db.from('podcast_radar_status').update(payload).eq('singleton', true)
  if (error) throw new Error(error.message)
}

export async function readRadarStatusRow(db: PlanningClient): Promise<RadarRunStatus> {
  const { data, error } = await db
    .from('podcast_radar_status')
    .select(STATUS_COLUMNS)
    .eq('singleton', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return toRunStatus(data)
}
