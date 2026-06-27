import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { runConferenceDiscoveryJob } from './conference-discovery-job'

// A run is considered stale once it has been 'running' longer than the
// serverless function could possibly live (300s cap + buffer). Past this the
// background job was killed without recording a result, so we surface it as a
// timeout and allow a new run.
const STALE_RUN_MS = 330 * 1000

export type ConferenceRunState = 'idle' | 'running' | 'success' | 'error'

export type ConferenceRunStatus = {
  status: ConferenceRunState
  message: string | null
  startedAt: string | null
  finishedAt: string | null
  inserted: number | null
}

type StatusRow = {
  last_run_status: string | null
  last_run_started_at: string | null
  last_run_finished_at: string | null
  last_run_message: string | null
  last_run_inserted: number | null
}

const STATUS_COLUMNS = 'last_run_status, last_run_started_at, last_run_finished_at, last_run_message, last_run_inserted'

function rowToStatus(row: StatusRow | null): ConferenceRunStatus {
  return {
    status: (row?.last_run_status as ConferenceRunState) ?? 'idle',
    message: row?.last_run_message ?? null,
    startedAt: row?.last_run_started_at ?? null,
    finishedAt: row?.last_run_finished_at ?? null,
    inserted: row?.last_run_inserted ?? null,
  }
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: (StatusRow & { singleton?: boolean }) | null; error: { message: string } | null }> }
    }
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: boolean) => Promise<{ error: { message: string } | null }> }
  }
}

/** Read the current discovery run status (caller ensures access). */
export async function getConferenceRunStatus(supabase: SupabaseClient<Database>): Promise<ConferenceRunStatus> {
  const db = supabase as unknown as LooseDb
  const { data } = await db.from('conference_discovery_status').select(STATUS_COLUMNS).eq('singleton', true).maybeSingle()
  const status = rowToStatus(data)

  if (status.status === 'running' && status.startedAt) {
    const age = Date.now() - new Date(status.startedAt).getTime()
    if (age > STALE_RUN_MS) {
      return { ...status, status: 'error', message: 'The previous discovery run was interrupted before finishing (it took too long). Try again.' }
    }
  }

  return status
}

/**
 * Claim the run lock: mark the singleton 'running' unless a fresh run is already
 * in progress. Returns whether the caller should proceed to execute the job.
 */
export async function markConferenceRunStarted(): Promise<{ started: boolean; reason?: 'already_running' }> {
  const admin = createAdminClient()
  const db = admin as unknown as LooseDb

  const { data, error } = await db
    .from('conference_discovery_status')
    .select(`singleton, ${STATUS_COLUMNS}`)
    .eq('singleton', true)
    .maybeSingle()
  if (error) throw new Error(error.message)

  if (data?.last_run_status === 'running' && data.last_run_started_at) {
    const age = Date.now() - new Date(data.last_run_started_at).getTime()
    if (age < STALE_RUN_MS) return { started: false, reason: 'already_running' }
  }

  const { error: updateError } = await db
    .from('conference_discovery_status')
    .update({ last_run_status: 'running', last_run_started_at: new Date().toISOString(), last_run_message: null })
    .eq('singleton', true)
  if (updateError) throw new Error(updateError.message)

  return { started: true }
}

/**
 * Execute the discovery job and record the outcome on the singleton status row.
 * Meant to run in the background (Next.js `after()`), after the lock is claimed.
 */
export async function executeAndRecordConferenceRun(userId: string | null): Promise<void> {
  const admin = createAdminClient()
  const db = admin as unknown as LooseDb

  const finish = async (status: 'success' | 'error', message: string, inserted: number | null) => {
    await db
      .from('conference_discovery_status')
      .update({
        last_run_status: status,
        last_run_finished_at: new Date().toISOString(),
        last_run_message: message.slice(0, 300),
        last_run_inserted: inserted,
      })
      .eq('singleton', true)
  }

  try {
    const result = await runConferenceDiscoveryJob(admin, { createdBy: userId })
    if (result.inserted > 0) {
      const note = result.groupErrors ? ` (${result.groupErrors} region search${result.groupErrors === 1 ? '' : 'es'} timed out)` : ''
      await finish('success', `Added ${result.inserted} new conference${result.inserted === 1 ? '' : 's'} (from ${result.discovered} found)${note}.`, result.inserted)
    } else {
      const candidates = result.candidates ?? 0
      let why: string
      if (candidates === 0) {
        why = result.outputWasJson === false
          ? 'the model did not return structured results.'
          : 'the web search returned no usable upcoming conferences — try again later.'
      } else if ((result.validated ?? 0) === 0) {
        why = `the model returned ${candidates} result(s) but none had a valid future date.`
      } else {
        why = `found ${candidates} result(s), but all were already in the list.`
      }
      await finish('success', `No new conferences added — ${why}`, 0)
    }
  } catch (error) {
    await finish('error', error instanceof Error ? error.message : 'Conference discovery run failed.', null)
  }
}
