/**
 * lib/comms-meeting-transcripts.ts
 *
 * Server-side loaders that fetch the transcript + AI summary + follow-up task
 * proposals attached to a meeting (a bi-weekly meeting date or a campus
 * session). Shared by the meetings page, the comms dashboard, and the campus
 * session detail page so the in-meeting transcript flow is consistent.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FollowUpProposal } from '@/components/comms/follow-up-tasks-panel'

export type MeetingTranscriptSummary = {
  id: string
  status: string
  tldr: string
  decisions: Array<{ decision: string; owner?: string | null; context?: string | null }>
  actionItems: Array<{ title: string; owner?: string | null; dueDate?: string | null; notes?: string | null }>
  publicationBlurb: string | null
  chunked: boolean
  model: string | null
}

export type MeetingTranscriptView = {
  id: string
  title: string
  sourceFilename: string | null
  sourceFormat: string
  rawDeleted: boolean
  hasRawFile: boolean
  characterCount: number
  createdAt: string
  summary: MeetingTranscriptSummary | null
  followUpProposals: FollowUpProposal[]
}

type LooseSelect = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }> }
    eq: (column: string, value: string) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }> }
    order: (column: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>
  }
}

function mapSummary(row: Record<string, unknown>): MeetingTranscriptSummary {
  return {
    id: String(row.id),
    status: String(row.status),
    tldr: String(row.tldr ?? ''),
    decisions: (Array.isArray(row.decisions) ? row.decisions : []) as MeetingTranscriptSummary['decisions'],
    actionItems: (Array.isArray(row.action_items) ? row.action_items : []) as MeetingTranscriptSummary['actionItems'],
    publicationBlurb: (row.publication_blurb as string | null) ?? null,
    chunked: Boolean(row.chunked),
    model: (row.model as string | null) ?? null,
  }
}

function mapProposal(row: Record<string, unknown>): FollowUpProposal {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    proposedOwnerId: (row.proposed_owner_id as string | null) ?? null,
    proposedOwnerLabel: (row.proposed_owner_label as string | null) ?? null,
    ownerMatch: row.owner_match === 'matched' ? 'matched' : 'unmatched',
    dueDate: (row.due_date as string | null) ?? null,
    rawOwner: (row.raw_owner as string | null) ?? null,
    rawDue: (row.raw_due as string | null) ?? null,
    status: String(row.status),
  }
}

const TRANSCRIPT_COLUMNS = 'id, title, source_filename, source_format, storage_path, raw_deleted_at, extracted_text, created_at, meeting_date, campus_session_id'
const SUMMARY_COLUMNS = 'id, transcript_id, tldr, decisions, action_items, publication_blurb, status, chunked, model, created_at'
const PROPOSAL_COLUMNS = 'id, summary_id, transcript_id, title, description, proposed_owner_id, proposed_owner_label, owner_match, due_date, raw_owner, raw_due, status, created_at'

function buildView(
  transcriptRow: Record<string, unknown>,
  summaryRows: Array<Record<string, unknown>>,
  proposalRows: Array<Record<string, unknown>>
): MeetingTranscriptView {
  const transcriptId = String(transcriptRow.id)
  const text = typeof transcriptRow.extracted_text === 'string' ? transcriptRow.extracted_text : ''

  // Latest non-terminal (pending or saved) summary drives the panel.
  const summaryRow = summaryRows
    .filter((row) => String(row.transcript_id) === transcriptId)
    .find((row) => row.status === 'pending' || row.status === 'saved')
  const summary = summaryRow ? mapSummary(summaryRow) : null

  const proposals = summary
    ? proposalRows.filter((row) => String(row.summary_id) === summary.id && row.status !== 'superseded').map(mapProposal)
    : []

  return {
    id: transcriptId,
    title: String(transcriptRow.title ?? 'Untitled meeting'),
    sourceFilename: (transcriptRow.source_filename as string | null) ?? null,
    sourceFormat: String(transcriptRow.source_format ?? ''),
    rawDeleted: Boolean(transcriptRow.raw_deleted_at),
    hasRawFile: Boolean(transcriptRow.storage_path),
    characterCount: text.length,
    createdAt: String(transcriptRow.created_at),
    summary,
    followUpProposals: proposals,
  }
}

async function loadSummariesAndProposals(supabase: SupabaseClient, transcriptIds: string[]) {
  if (transcriptIds.length === 0) return { summaries: [], proposals: [] }
  const db = supabase as unknown as { from: (table: string) => LooseSelect }

  const [{ data: summaryData }, { data: proposalData }] = await Promise.all([
    db.from('meeting_summaries').select(SUMMARY_COLUMNS).in('transcript_id', transcriptIds).order('created_at', { ascending: false }),
    db.from('meeting_followup_tasks').select(PROPOSAL_COLUMNS).in('transcript_id', transcriptIds).order('created_at', { ascending: true }),
  ])

  return { summaries: (summaryData ?? []) as Array<Record<string, unknown>>, proposals: (proposalData ?? []) as Array<Record<string, unknown>> }
}

/** Load the latest transcript view for each given bi-weekly meeting date. */
export async function loadMeetingTranscriptsByDate(
  supabase: SupabaseClient,
  meetingDates: string[]
): Promise<Map<string, MeetingTranscriptView>> {
  const result = new Map<string, MeetingTranscriptView>()
  if (meetingDates.length === 0) return result

  const db = supabase as unknown as { from: (table: string) => LooseSelect }
  const { data: transcriptData } = await db
    .from('meeting_transcripts')
    .select(TRANSCRIPT_COLUMNS)
    .in('meeting_date', meetingDates)
    .order('created_at', { ascending: false })

  const transcripts = (transcriptData ?? []) as Array<Record<string, unknown>>
  // One (latest) transcript per meeting date.
  const latestByDate = new Map<string, Record<string, unknown>>()
  for (const row of transcripts) {
    const date = row.meeting_date ? String(row.meeting_date) : null
    if (!date || latestByDate.has(date)) continue
    latestByDate.set(date, row)
  }

  const { summaries, proposals } = await loadSummariesAndProposals(supabase, [...latestByDate.values()].map((r) => String(r.id)))
  for (const [date, row] of latestByDate) {
    result.set(date, buildView(row, summaries, proposals))
  }
  return result
}

/** Load the latest transcript view attached to a campus session. */
export async function loadCampusSessionTranscript(
  supabase: SupabaseClient,
  campusSessionId: string
): Promise<MeetingTranscriptView | null> {
  const db = supabase as unknown as { from: (table: string) => LooseSelect }
  const { data: transcriptData } = await db
    .from('meeting_transcripts')
    .select(TRANSCRIPT_COLUMNS)
    .eq('campus_session_id', campusSessionId)
    .order('created_at', { ascending: false })

  const transcripts = (transcriptData ?? []) as Array<Record<string, unknown>>
  if (transcripts.length === 0) return null

  const latest = transcripts[0]
  const { summaries, proposals } = await loadSummariesAndProposals(supabase, [String(latest.id)])
  return buildView(latest, summaries, proposals)
}
