'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { generateFollowUpProposals } from '@/lib/ai/follow-up-tasks-store'
import { notifyUser } from '@/lib/notify'
import type { Database } from '@/types/database'

export interface FollowUpActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: FollowUpActionState = { ok: false }
const TRANSCRIPTS_PATH = '/app/comms/transcripts'

type AppSupabaseClient = SupabaseClient<Database>

function asText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableId(value: FormDataEntryValue | null): string | null {
  const text = asText(value)
  return text && text !== 'none' ? text : null
}

function isoDateOrNull(value: FormDataEntryValue | null): string | null {
  const text = asText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

async function requireCommsOperator() {
  const supabase = (await createClient()) as AppSupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }
  return { supabase, user, profile }
}

type FollowUpRow = {
  id: string
  summary_id: string
  transcript_id: string
  title: string
  description: string | null
  proposed_owner_id: string | null
  campus_session_id: string | null
  agenda_item_id: string | null
  status: string
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
    }
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

export async function regenerateFollowUpTasks(
  _prevState: FollowUpActionState = INITIAL_STATE,
  formData: FormData
): Promise<FollowUpActionState> {
  try {
    if (!isAiEnabled()) return { ok: false, error: 'AI features are disabled for this environment.' }
    const { supabase, user } = await requireCommsOperator()
    const summaryId = asText(formData.get('summary_id'))
    if (!summaryId) return { ok: false, error: 'Summary is required.' }

    const count = await generateFollowUpProposals(supabase, { summaryId, createdBy: user.id })
    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: count > 0 ? `${count} follow-up task${count === 1 ? '' : 's'} proposed.` : 'No action items to propose as tasks.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not regenerate follow-up tasks.' }
  }
}

export async function rejectFollowUpTask(
  _prevState: FollowUpActionState = INITIAL_STATE,
  formData: FormData
): Promise<FollowUpActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const proposalId = asText(formData.get('proposal_id'))
    if (!proposalId) return { ok: false, error: 'Proposal is required.' }

    const db = supabase as unknown as LooseDb
    const { error } = await db.from('meeting_followup_tasks').update({ status: 'rejected' }).eq('id', proposalId)
    if (error) throw new Error(error.message)

    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: 'Proposed task rejected.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not reject the proposed task.' }
  }
}

/**
 * Commit one (optionally edited) proposed task: create a real comms_task in the
 * unified task system (ADR-0008), link it to the transcript's session/agenda
 * item, notify the owner, and mark the proposal committed.
 */
export async function commitFollowUpTask(
  _prevState: FollowUpActionState = INITIAL_STATE,
  formData: FormData
): Promise<FollowUpActionState> {
  try {
    const { supabase, user, profile } = await requireCommsOperator()
    const proposalId = asText(formData.get('proposal_id'))
    if (!proposalId) return { ok: false, error: 'Proposal is required.' }

    const title = asText(formData.get('title'))
    if (!title) return { ok: false, error: 'A task title is required.' }
    const description = asText(formData.get('description')) || null
    const ownerId = nullableId(formData.get('owner_id'))
    const dueDate = isoDateOrNull(formData.get('due_date'))

    const db = supabase as unknown as LooseDb
    const { data, error: loadError } = await db
      .from('meeting_followup_tasks')
      .select('id, summary_id, transcript_id, title, description, proposed_owner_id, campus_session_id, agenda_item_id, status')
      .eq('id', proposalId)
      .maybeSingle()
    if (loadError) throw new Error(loadError.message)
    const proposal = data as FollowUpRow | null
    if (!proposal) throw new Error('Proposed task not found.')
    if (proposal.status !== 'pending') throw new Error('Only a pending proposal can be committed.')

    // Create the real comms_task (ADR-0008 unified task system).
    const { data: taskRow, error: taskError } = await db
      .from('comms_tasks')
      .insert({
        title,
        description,
        owner_id: ownerId,
        due_date: dueDate,
        status: 'not_started',
        agenda_item_id: proposal.agenda_item_id,
        campus_session_id: proposal.campus_session_id,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (taskError) throw new Error(taskError.message)

    const { error: updateError } = await db
      .from('meeting_followup_tasks')
      .update({
        status: 'committed',
        committed_task_id: taskRow?.id ?? null,
        committed_by: user.id,
        committed_at: new Date().toISOString(),
        // Persist the human's edits back onto the proposal for an audit trail.
        title,
        description,
        proposed_owner_id: ownerId,
        due_date: dueDate,
      })
      .eq('id', proposalId)
    if (updateError) throw new Error(updateError.message)

    // Notify the owner, unless they assigned the task to themselves.
    if (ownerId && ownerId !== user.id) {
      await notifyUser({
        recipientId: ownerId,
        event: 'task_assigned',
        title: 'New task assigned to you',
        body: `${profile.name ?? 'A teammate'} committed a meeting follow-up task to you: "${title}"`,
        linkUrl: '/app/comms/dashboard',
      })
    }

    revalidatePath(TRANSCRIPTS_PATH)
    revalidatePath('/app/comms/dashboard')
    revalidatePath('/app/dashboard')
    return { ok: true, message: 'Task created and the owner notified.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not commit the proposed task.' }
  }
}
