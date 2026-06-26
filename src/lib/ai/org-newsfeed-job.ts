import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { DEFAULT_ORG_FEED_CONFIG, normalizeCadence, type OrgFeedConfig } from './org-feed-config'
import { generateOrgNewsfeed, type WatchedEntities } from './org-newsfeed'
import { INTERNAL_EMAIL_DOMAIN } from '@/lib/comms-crm'

export type OrgNewsfeedJobResult = {
  ok: boolean
  generated: number
  inserted: number
  skipped: 'disabled' | 'no_config' | null
  // Diagnostics for explaining a 0-result run.
  candidates?: number
  validated?: number
  outputWasJson?: boolean
  groupErrors?: number
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
  watch_organization: boolean | null
  organization_aliases: string[] | null
  watch_crm_internal: boolean | null
  watch_people: string[] | null
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
    watchOrganization: row.watch_organization ?? false,
    organizationAliases: row.organization_aliases ?? [],
    watchCrmInternal: row.watch_crm_internal ?? false,
    watchPeople: row.watch_people ?? [],
  }
}

/** Names of people with an @inspire2live.org email in the CRM / platform. */
async function resolveCrmInternalNames(supabase: SupabaseClient<Database>): Promise<string[]> {
  const reader = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        ilike: (column: string, pattern: string) => { limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }> }
      }
    }
  }
  const pattern = `%@${INTERNAL_EMAIL_DOMAIN}`

  const [contacts, profiles] = await Promise.all([
    reader.from('comms_crm_contacts').select('full_name, normalized_email').ilike('normalized_email', pattern).limit(300),
    reader.from('profiles').select('name, email').ilike('email', pattern).limit(300),
  ])

  const names = new Map<string, string>()
  for (const row of contacts.data ?? []) {
    const name = typeof row.full_name === 'string' ? row.full_name.trim() : ''
    if (name) names.set(name.toLowerCase(), name)
  }
  for (const row of profiles.data ?? []) {
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (name) names.set(name.toLowerCase(), name)
  }
  return [...names.values()].slice(0, 100)
}

/** Build the watched org + people list from config (+ CRM-internal if enabled). */
async function resolveWatchedEntities(supabase: SupabaseClient<Database>, config: OrgFeedConfig): Promise<WatchedEntities> {
  const organizations = config.watchOrganization ? config.organizationAliases : []

  const people = new Map<string, string>()
  for (const person of config.watchPeople) {
    const name = person.trim()
    if (name) people.set(name.toLowerCase(), name)
  }
  if (config.watchCrmInternal) {
    for (const name of await resolveCrmInternalNames(supabase)) {
      if (!people.has(name.toLowerCase())) people.set(name.toLowerCase(), name)
    }
  }

  return { organizations, people: [...people.values()] }
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
    .select('topics, themes, allowed_sources, blocked_sources, region, cadence, enabled, watch_organization, organization_aliases, watch_crm_internal, watch_people')
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

  const watched = await resolveWatchedEntities(supabase, config)

  const generated = await generateOrgNewsfeed({
    config,
    watched,
    existingUrls,
    existingHeadlines,
    createdBy: options?.createdBy ?? null,
  })

  const diagnostics = {
    candidates: generated.candidateCount,
    validated: generated.validatedCount,
    outputWasJson: generated.outputWasJson,
    groupErrors: generated.groupErrors,
  }

  if (generated.items.length === 0) {
    return { ok: true, generated: 0, inserted: 0, skipped: null, ...diagnostics }
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
    mention_of: item.mentionOf,
    topic: item.topic,
    created_by: options?.createdBy ?? null,
  }))

  // Ignore conflicts on source_url so re-runs never duplicate a story.
  const batch = await db.from('news_feed_items').upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true })

  let inserted: number
  if (!batch.error) {
    inserted = Array.isArray(batch.data) ? batch.data.length : rows.length
  } else {
    // One malformed row would otherwise fail the whole batch and lose every
    // result — fall back to inserting row-by-row, skipping the bad ones.
    console.error('[newsfeed] batch insert failed, retrying per-row', batch.error.message)
    inserted = 0
    for (const row of rows) {
      const single = await db.from('news_feed_items').upsert([row], { onConflict: 'source_url', ignoreDuplicates: true })
      if (single.error) {
        console.error('[newsfeed] skipped a row', single.error.message)
        continue
      }
      inserted += Array.isArray(single.data) ? single.data.length : 1
    }
  }

  return { ok: true, generated: generated.items.length, inserted, skipped: null, ...diagnostics }
}
