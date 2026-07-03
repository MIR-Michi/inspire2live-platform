import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import type { Database } from '@/types/database'
import { proposeFollowUpTasks, type CommsTeamMember } from './follow-up-tasks'
import type { MeetingActionItem } from './meeting-summary'

type AppSupabaseClient = SupabaseClient<Database>

// meeting_summaries / meeting_transcripts / meeting_followup_tasks are not in
// the generated Database types yet, so we narrow through a structural cast,
// mirroring the rest of the Sprint 14 surfaces.
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    insert: (payload: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

async function loadCommsMembers(supabase: AppSupabaseClient): Promise<CommsTeamMember[]> {
  const { data } = await supabase.from('profiles').select('id, name, email, role')
  const rows = (data ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>
  return rows
    .filter((row) => canAccessCommsWorkspace(row.role))
    .map((row) => ({ id: row.id, label: row.name ?? row.email ?? 'Unknown', email: row.email, role: row.role }))
}

/**
 * Generate reviewable follow-up task proposals from a meeting summary's action
 * items and persist them as pending `meeting_followup_tasks`. Any previous
 * pending proposals for the summary are superseded first so a regenerate is
 * idempotent. Returns the number of proposals written.
 *
 * Reused by the summary run (S14-T12 "same transcript run") and a standalone
 * regenerate action.
 */
export async function generateFollowUpProposals(
  supabase: AppSupabaseClient,
  params: { summaryId: string; createdBy?: string | null }
): Promise<number> {
  const db = supabase as unknown as LooseDb

  const { data: summary, error: summaryError } = await db
    .from('meeting_summaries')
    .select('id, transcript_id, action_items, status')
    .eq('id', params.summaryId)
    .maybeSingle()
  if (summaryError) throw new Error(summaryError.message)
  if (!summary) throw new Error('Summary not found.')

  const transcriptId = String(summary.transcript_id)
  const actionItems = (Array.isArray(summary.action_items) ? summary.action_items : []) as MeetingActionItem[]

  const { data: transcript, error: transcriptError } = await db
    .from('meeting_transcripts')
    .select('id, campus_session_id, agenda_item_id')
    .eq('id', transcriptId)
    .maybeSingle()
  if (transcriptError) throw new Error(transcriptError.message)

  const campusSessionId = (transcript?.campus_session_id as string | null) ?? null
  const agendaItemId = (transcript?.agenda_item_id as string | null) ?? null

  const members = await loadCommsMembers(supabase)
  const proposals = proposeFollowUpTasks({ actionItems, members })

  // Supersede any prior pending proposals for this summary.
  const supersede = await db
    .from('meeting_followup_tasks')
    .update({ status: 'superseded' })
    .eq('summary_id', params.summaryId)
    .eq('status', 'pending')
  if (supersede.error) throw new Error(supersede.error.message)

  if (proposals.length === 0) return 0

  const rows = proposals.map((proposal) => ({
    summary_id: params.summaryId,
    transcript_id: transcriptId,
    title: proposal.title,
    description: proposal.description,
    proposed_owner_id: proposal.proposedOwnerId,
    proposed_owner_label: proposal.proposedOwnerLabel,
    owner_match: proposal.ownerMatch,
    due_date: proposal.dueDate,
    raw_owner: proposal.rawOwner,
    raw_due: proposal.rawDue,
    campus_session_id: campusSessionId,
    agenda_item_id: agendaItemId,
    status: 'pending',
    created_by: params.createdBy ?? null,
  }))

  const { error: insertError } = await db.from('meeting_followup_tasks').insert(rows)
  if (insertError) throw new Error(insertError.message)

  return proposals.length
}
