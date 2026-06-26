import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { runOrgNewsfeedJob } from './org-newsfeed-job'
import type { OrgNewsfeedRunStatus } from './org-feed-config'

// A run is considered stale (crashed/abandoned) after this long, so a new one
// can start instead of being blocked forever by a 'running' flag.
const STALE_RUN_MS = 8 * 60 * 1000

type StatusRow = {
  last_run_status: string | null
  last_run_started_at: string | null
  last_run_finished_at: string | null
  last_run_message: string | null
  last_run_inserted: number | null
}

function rowToStatus(row: StatusRow | null): OrgNewsfeedRunStatus {
  return {
    status: (row?.last_run_status as OrgNewsfeedRunStatus['status']) ?? 'idle',
    message: row?.last_run_message ?? null,
    startedAt: row?.last_run_started_at ?? null,
    finishedAt: row?.last_run_finished_at ?? null,
    inserted: row?.last_run_inserted ?? null,
  }
}

const STATUS_COLUMNS = 'last_run_status, last_run_started_at, last_run_finished_at, last_run_message, last_run_inserted'

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: (StatusRow & { singleton?: boolean }) | null; error: { message: string } | null }> }
    }
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: boolean) => Promise<{ error: { message: string } | null }> }
  }
}

/** Read the current run status (uses the given client; caller ensures access). */
export async function getRunStatus(supabase: SupabaseClient<Database>): Promise<OrgNewsfeedRunStatus | null> {
  const db = supabase as unknown as LooseDb
  const { data } = await db.from('org_feed_config').select(STATUS_COLUMNS).eq('singleton', true).maybeSingle()
  if (!data) return null
  return rowToStatus(data)
}

/**
 * Claim the run lock: mark the config 'running' unless a fresh run is already
 * in progress. Returns whether the caller should proceed to execute the job.
 */
export async function markRunStarted(): Promise<{ started: boolean; reason?: 'no_config' | 'already_running' }> {
  const admin = createAdminClient()
  const db = admin as unknown as LooseDb

  const { data, error } = await db.from('org_feed_config').select(`singleton, ${STATUS_COLUMNS}`).eq('singleton', true).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { started: false, reason: 'no_config' }

  if (data.last_run_status === 'running' && data.last_run_started_at) {
    const age = Date.now() - new Date(data.last_run_started_at).getTime()
    if (age < STALE_RUN_MS) return { started: false, reason: 'already_running' }
  }

  const { error: updateError } = await db
    .from('org_feed_config')
    .update({ last_run_status: 'running', last_run_started_at: new Date().toISOString(), last_run_message: null })
    .eq('singleton', true)
  if (updateError) throw new Error(updateError.message)

  return { started: true }
}

/**
 * Execute the newsfeed job and record the outcome on the config record. Meant
 * to run in the background (Next.js `after()`), after the lock is claimed.
 */
export async function executeAndRecordRun(userId: string | null): Promise<void> {
  const admin = createAdminClient()
  const db = admin as unknown as LooseDb

  const finish = async (status: 'success' | 'error', message: string, inserted: number | null) => {
    await db
      .from('org_feed_config')
      .update({
        last_run_status: status,
        last_run_finished_at: new Date().toISOString(),
        last_run_message: message.slice(0, 300),
        last_run_inserted: inserted,
      })
      .eq('singleton', true)
  }

  try {
    const result = await runOrgNewsfeedJob(admin, { createdBy: userId, force: true })
    if (result.skipped === 'no_config') {
      await finish('error', 'No configuration to run.', null)
    } else {
      const message = result.inserted > 0
        ? `Added ${result.inserted} new item${result.inserted === 1 ? '' : 's'} (from ${result.generated} found).`
        : 'Ran successfully — no new items found this time.'
      await finish('success', message, result.inserted)
    }
  } catch (error) {
    await finish('error', error instanceof Error ? error.message : 'Newsfeed run failed.', null)
  }
}
