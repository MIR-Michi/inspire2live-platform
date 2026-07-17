import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { runConferenceDiscoveryJob, type ConferenceDiscoveryTuning } from './conference-discovery-job'

// The AI sweep is hard-capped below this. If the serverless task is interrupted
// before it can write a final state, the next status read self-heals the row.
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

async function updateConferenceRunStatus(
  db: LooseDb,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from('conference_discovery_status').update(payload).eq('singleton', true)
  if (error) throw new Error(error.message)
}

/** Read the current discovery run status (caller ensures access). */
export async function getConferenceRunStatus(supabase: SupabaseClient<Database>): Promise<ConferenceRunStatus> {
  const db = supabase as unknown as LooseDb
  const { data } = await db.from('conference_discovery_status').select(STATUS_COLUMNS).eq('singleton', true).maybeSingle()
  const status = rowToStatus(data)

  if (status.status === 'running' && status.startedAt) {
    const age = Date.now() - new Date(status.startedAt).getTime()
    if (age > STALE_RUN_MS) {
      const message = 'The previous conference cache refresh was interrupted before finishing. No results were saved from that run; please try again.'
      await updateConferenceRunStatus(db, {
        last_run_status: 'error',
        last_run_finished_at: new Date().toISOString(),
        last_run_message: message,
        last_run_inserted: null,
      })
      return { ...status, status: 'error', message, finishedAt: new Date().toISOString() }
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

  await updateConferenceRunStatus(db, {
    last_run_status: 'running',
    last_run_started_at: new Date().toISOString(),
    last_run_finished_at: null,
    last_run_message: 'Initializing comprehensive conference cache refresh.',
    last_run_inserted: null,
  })

  return { started: true }
}

/** Execute the discovery job and record the outcome on the singleton status row. */
export async function executeAndRecordConferenceRun(
  userId: string | null,
  tuning?: ConferenceDiscoveryTuning,
): Promise<void> {
  const admin = createAdminClient()
  const db = admin as unknown as LooseDb

  const progress = async (message: string) => {
    await updateConferenceRunStatus(db, { last_run_message: message.slice(0, 600) })
  }

  const finish = async (status: 'success' | 'error', message: string, inserted: number | null) => {
    await updateConferenceRunStatus(db, {
      last_run_status: status,
      last_run_finished_at: new Date().toISOString(),
      last_run_message: message.slice(0, 600),
      last_run_inserted: inserted,
    })
  }

  try {
    const result = await runConferenceDiscoveryJob(admin, { createdBy: userId, onProgress: progress, ...tuning })
    if (result.inserted > 0) {
      const laneCount = result.groupCount ?? 0
      const note = result.groupErrors ? ` (${result.groupErrors} search lane${result.groupErrors === 1 ? '' : 's'} timed out or failed)` : ''
      const scope = laneCount > 0 ? ` across ${laneCount} search lane${laneCount === 1 ? '' : 's'}` : ''
      await finish('success', `Saved ${result.inserted} new conference${result.inserted === 1 ? '' : 's'} to the cache from ${result.discovered} validated result${result.discovered === 1 ? '' : 's'}${scope}${note}.`, result.inserted)
    } else {
      const candidates = result.candidates ?? 0
      const validated = result.validated ?? 0
      const laneCount = result.groupCount ?? 0
      const failedLanes = result.groupErrors ?? 0
      let why: string
      if (candidates === 0 && laneCount > 0 && failedLanes === laneCount) {
        why = `all ${laneCount} AI search lane${laneCount === 1 ? '' : 's'} failed before returning candidates.`
      } else if (candidates === 0 && failedLanes > 0) {
        why = `${failedLanes} AI search lane${failedLanes === 1 ? '' : 's'} failed and the remaining lanes returned no usable upcoming conferences.`
      } else if (candidates === 0) {
        why = result.outputWasJson === false
          ? 'the model did not return parseable JSON.'
          : 'the web search returned no usable upcoming conferences.'
      } else if (validated === 0) {
        why = `the model returned ${candidates} candidate result${candidates === 1 ? '' : 's'}, but none had a valid future date and official URL.`
      } else {
        why = `${validated} validated result${validated === 1 ? ' was' : 's were'} already in the cache.`
      }
      await finish('success', `No new conferences saved: ${why}`, 0)
    }
  } catch (error) {
    await finish('error', error instanceof Error ? error.message : 'Conference cache refresh failed.', null)
  }
}
