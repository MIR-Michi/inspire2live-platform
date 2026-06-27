import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { discoverConferences, type ConferenceRegion } from './conferences'

export type ConferenceDiscoveryJobResult = {
  ok: boolean
  discovered: number
  inserted: number
  // Diagnostics for explaining a 0-result run.
  candidates?: number
  validated?: number
  outputWasJson?: boolean
  groupErrors?: number
}

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

/**
 * Run the conference-discovery job: fan out across regions to find upcoming
 * oncology conferences, dedupe against the stored master list, and insert the
 * new ones. Idempotent — duplicate dedupe keys are ignored.
 *
 * Shared by the CRON_SECRET-protected route and the admin/comms "Refresh" action.
 */
export async function runConferenceDiscoveryJob(
  supabase: SupabaseClient<Database>,
  options?: { createdBy?: string | null; monthsAhead?: number; regions?: ConferenceRegion[] }
): Promise<ConferenceDiscoveryJobResult> {
  const db = supabase as unknown as LooseDb

  // Existing names/keys inform dedupe + give the model a "do not repeat" list.
  const { data: existing, error: existingError } = await db
    .from('conferences')
    .select('name, dedupe_key')
    .order('discovered_at', { ascending: false })
    .limit(300)
  if (existingError) throw new Error(existingError.message)

  const existingNames = (existing ?? []).map((row) => row.name)
  const existingKeys = new Set((existing ?? []).map((row) => row.dedupe_key))

  const result = await discoverConferences({
    existingNames,
    monthsAhead: options?.monthsAhead,
    regions: options?.regions,
    createdBy: options?.createdBy ?? null,
  })

  const diagnostics = {
    candidates: result.candidateCount,
    validated: result.validatedCount,
    outputWasJson: result.outputWasJson,
    groupErrors: result.groupErrors,
  }

  // Drop any that already exist before inserting (the unique index also guards).
  const fresh = result.conferences.filter((conf) => !existingKeys.has(conf.dedupeKey))
  if (fresh.length === 0) {
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

  const batch = await db.from('conferences').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })

  let inserted: number
  if (!batch.error) {
    inserted = Array.isArray(batch.data) ? batch.data.length : rows.length
  } else {
    // One malformed row would otherwise fail the whole batch — fall back to
    // inserting row-by-row, skipping the bad ones.
    console.error('[conferences] batch insert failed, retrying per-row', batch.error.message)
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

  return { ok: true, discovered: result.conferences.length, inserted, ...diagnostics }
}
