import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { DEFAULT_ORG_FEED_CONFIG, normalizeCadence, type OrgFeedConfig } from './org-feed-config'
import { generateOrgNewsfeed } from './org-newsfeed'

export type OrgNewsfeedJobResult = {
  ok: boolean
  generated: number
  inserted: number
  skipped: 'disabled' | 'no_config' | null
  message?: string
}

type OrgFeedConfigRow = {
  topics: string[] | null
  themes: string[] | null
  allowed_sources: string[] | null
  blocked_sources: string[] | null
  region: string | null
  cadence: string | null
  enabled: boolean | null
}

function rowToConfig(row: OrgFeedConfigRow | null): OrgFeedConfig {
  if (!row) return DEFAULT_ORG_FEED_CONFIG
  return {
    topics: row.topics ?? [],
    themes: row.themes ?? [],
    allowedSources: row.allowed_sources ?? [],
    blockedSources: row.blocked_sources ?? [],
    region: row.region,
    cadence: normalizeCadence(row.cadence),
    enabled: row.enabled ?? true,
  }
}

// org_feed_config / news_feed_items are not in the generated Database types yet.
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: boolean) => { maybeSingle: () => Promise<{ data: OrgFeedConfigRow | null; error: { message: string } | null }> }
      order: (column: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Array<{ source_url: string; headline: string }> | null; error: { message: string } | null }> }
    }
    upsert: (payload: Record<string, unknown>[], options: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
  }
}

/**
 * Run the organization news-feed generation job: load the admin config, gather
 * recent items via web search, dedupe against stored items, and insert the new
 * citation-backed items. Idempotent — duplicate source URLs are ignored.
 *
 * Shared by the CRON_SECRET-protected route and the admin "Run now" action.
 */
export async function runOrgNewsfeedJob(
  supabase: SupabaseClient<Database>,
  options?: { createdBy?: string | null; force?: boolean }
): Promise<OrgNewsfeedJobResult> {
  const db = supabase as unknown as LooseDb

  const { data: configRow, error: configError } = await db
    .from('org_feed_config')
    .select('topics, themes, allowed_sources, blocked_sources, region, cadence, enabled')
    .eq('singleton', true)
    .maybeSingle()
  if (configError) throw new Error(configError.message)

  const config = rowToConfig(configRow)

  if (!configRow) {
    return { ok: true, generated: 0, inserted: 0, skipped: 'no_config', message: 'Configure the org feed before running.' }
  }
  if (!config.enabled && !options?.force) {
    return { ok: true, generated: 0, inserted: 0, skipped: 'disabled', message: 'Org feed is disabled.' }
  }

  // Existing items inform dedupe + give the model headlines to avoid repeating.
  const { data: existing, error: existingError } = await db
    .from('news_feed_items')
    .select('source_url, headline')
    .order('published_at', { ascending: false })
    .limit(200)
  if (existingError) throw new Error(existingError.message)

  const existingUrls = (existing ?? []).map((row) => row.source_url)
  const existingHeadlines = (existing ?? []).map((row) => row.headline)

  const generated = await generateOrgNewsfeed({
    config,
    existingUrls,
    existingHeadlines,
    createdBy: options?.createdBy ?? null,
  })

  if (generated.items.length === 0) {
    return { ok: true, generated: 0, inserted: 0, skipped: null, message: 'No new items found.' }
  }

  const rows = generated.items.map((item) => ({
    headline: item.headline,
    summary: item.summary,
    category: item.category,
    region: item.region,
    source_url: item.sourceUrl,
    source_name: item.sourceName,
    relevance: item.relevance,
    published_at: item.publishedAt,
    created_by: options?.createdBy ?? null,
  }))

  // Ignore conflicts on source_url so re-runs never duplicate a story.
  const { data: insertedRows, error: insertError } = await db
    .from('news_feed_items')
    .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true })
  if (insertError) throw new Error(insertError.message)

  const inserted = Array.isArray(insertedRows) ? insertedRows.length : rows.length

  return { ok: true, generated: generated.items.length, inserted, skipped: null }
}
