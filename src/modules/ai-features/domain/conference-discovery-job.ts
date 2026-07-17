import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { discoverConferences, type ConferenceRegion } from './conferences'

const AI_SWEEP_TIMEOUT_MS = 300_000
const DEFAULT_LANES_PER_REGION = 6

export type ConferenceDiscoveryJobResult = {
  ok: boolean
  discovered: number
  inserted: number
  // Diagnostics for explaining a 0-result run.
  candidates?: number
  validated?: number
  outputWasJson?: boolean
  groupCount?: number
  groupErrors?: number
}

type ProgressReporter = (message: string) => Promise<void> | void

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Array<{ name: string; dedupe_key: string }> | null; error: { message: string } | null }>
      }
    }
    upsert: (
      payload: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean }
    ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
  }
}

async function report(onProgress: ProgressReporter | undefined, message: string): Promise<void> {
  if (!onProgress) return
  try {
    await onProgress(message)
  } catch (error) {
    console.error('[conferences] progress update failed', error)
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Run the conference-discovery job: fan out across global source lanes to find
 * upcoming oncology conferences, dedupe against the stored master list, and
 * insert the new ones. Idempotent — duplicate dedupe keys are ignored.
 *
 * Shared by the CRON_SECRET-protected route and the admin/comms "Refresh" action.
 */
export type ConferenceDiscoveryTuning = {
  monthsAhead?: number
  maxSearchesPerLane?: number
  maxLanesPerRegion?: number
  existingNamesCap?: number
}

export async function runConferenceDiscoveryJob(
  supabase: SupabaseClient<Database>,
  options?: {
    createdBy?: string | null
    regions?: ConferenceRegion[]
    onProgress?: ProgressReporter
  } & ConferenceDiscoveryTuning
): Promise<ConferenceDiscoveryJobResult> {
  const db = supabase as unknown as LooseDb

  await report(options?.onProgress, 'Loading existing conferences and duplicate keys.')

  // Existing names/keys inform dedupe + give the model a "do not repeat" list.
  const { data: existing, error: existingError } = await db
    .from('conferences')
    .select('name, dedupe_key')
    .order('discovered_at', { ascending: false })
    .limit(300)
  if (existingError) throw new Error(existingError.message)

  const existingNames = (existing ?? []).map((row) => row.name)
  const existingKeys = new Set((existing ?? []).map((row) => row.dedupe_key))
  const regionCount = options?.regions?.length ?? 6
  const expectedLaneCount = regionCount * DEFAULT_LANES_PER_REGION

  await report(
    options?.onProgress,
    `Starting comprehensive AI web search across ${expectedLaneCount} global discovery lanes (${regionCount} region${regionCount === 1 ? '' : 's'} x source focus). This has a hard ${Math.round(AI_SWEEP_TIMEOUT_MS / 1000)} second limit.`
  )

  const result = await withTimeout(
    discoverConferences({
      existingNames,
      monthsAhead: options?.monthsAhead,
      regions: options?.regions,
      maxSearchesPerLane: options?.maxSearchesPerLane,
      maxLanesPerRegion: options?.maxLanesPerRegion,
      existingNamesCap: options?.existingNamesCap,
      createdBy: options?.createdBy ?? null,
    }),
    AI_SWEEP_TIMEOUT_MS,
    'AI conference discovery did not finish within 300 seconds. No results were saved from this run; try again later.'
  )

  await report(
    options?.onProgress,
    `AI search finished: ${result.candidateCount} candidate${result.candidateCount === 1 ? '' : 's'} from ${result.groupCount} search lane${result.groupCount === 1 ? '' : 's'}, ${result.validatedCount} valid upcoming conference${result.validatedCount === 1 ? '' : 's'}, ${result.groupErrors} lane timeout/error${result.groupErrors === 1 ? '' : 's'}.`
  )

  const diagnostics = {
    candidates: result.candidateCount,
    validated: result.validatedCount,
    outputWasJson: result.outputWasJson,
    groupCount: result.groupCount,
    groupErrors: result.groupErrors,
  }

  await report(options?.onProgress, 'Deduplicating against existing conference list.')

  // Drop any that already exist before inserting (the unique index also guards).
  const fresh = result.conferences.filter((conf) => !existingKeys.has(conf.dedupeKey))
  if (fresh.length === 0) {
    await report(options?.onProgress, 'No fresh conferences to save after validation and deduplication.')
    return { ok: true, discovered: result.conferences.length, inserted: 0, ...diagnostics }
  }

  const rows = fresh.map((conf) => ({
    name: conf.name,
    organizer: conf.organizer,
    region: conf.region,
    location: conf.location,
    main_focus: conf.mainFocus,
    topics: conf.topics,
    format: conf.format,
    start_date: conf.startDate,
    end_date: conf.endDate,
    website_url: conf.websiteUrl,
    source_url: conf.sourceUrl,
    summary: conf.summary,
    relevance: conf.relevance,
    dedupe_key: conf.dedupeKey,
    created_by: options?.createdBy ?? null,
  }))

  await report(options?.onProgress, `Saving ${rows.length} new conference${rows.length === 1 ? '' : 's'} to the database.`)

  const batch = await db.from('conferences').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })

  let inserted: number
  if (!batch.error) {
    inserted = Array.isArray(batch.data) ? batch.data.length : rows.length
  } else {
    // One malformed row would otherwise fail the whole batch — fall back to
    // inserting row-by-row, skipping the bad ones.
    console.error('[conferences] batch insert failed, retrying per-row', batch.error.message)
    await report(options?.onProgress, 'Batch save failed; retrying row by row and skipping malformed results.')
    inserted = 0
    for (const row of rows) {
      const single = await db.from('conferences').upsert([row], { onConflict: 'dedupe_key', ignoreDuplicates: true })
      if (single.error) {
        console.error('[conferences] skipped a row', single.error.message)
        continue
      }
      inserted += Array.isArray(single.data) ? single.data.length : 1
    }
  }

  await report(options?.onProgress, `Saved ${inserted} new conference${inserted === 1 ? '' : 's'}.`)

  return { ok: true, discovered: result.conferences.length, inserted, ...diagnostics }
}
