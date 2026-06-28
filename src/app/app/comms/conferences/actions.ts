'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { findTargetedConferences } from '@/lib/ai/conference-targeted-search'
import {
  enrichConference,
  validateConferences,
  type ConferenceDetail,
  type ConferenceRegion,
  type DiscoveredConference,
} from '@/lib/ai/conferences'
import { loadConference } from '@/lib/comms-conferences'
import { CONFERENCE_STAGES, type ConferenceStage } from '@/lib/comms-conferences'

const CONFERENCES_PATH = '/app/comms/conferences'

type ActionResult = { ok: boolean; message?: string }

export type DiscoverMoreCriteria = {
  region?: ConferenceRegion | 'all'
  country?: string | null
  keywords?: string | null
}

export type DiscoverMoreResult =
  | { ok: true; conferences: DiscoveredConference[]; message: string; candidateCount: number; validatedCount: number }
  | { ok: false; message: string }

export type AddDiscoveredResult =
  | { ok: true; inserted: number; message: string }
  | { ok: false; message: string }

async function requireCommsUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'Not authenticated.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return { ok: false as const, message: 'You do not have access to the Conferences workspace.' }
  return { ok: true as const, supabase, userId: user.id }
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
      }
    }
    upsert: (
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict: string; ignoreDuplicates?: boolean }
    ) => Promise<{ data?: unknown[] | null; error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
    delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
  }
}

function conferenceRow(conf: DiscoveredConference, createdBy: string | null): Record<string, unknown> {
  return {
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
    created_by: createdBy,
  }
}

/** Add a discovered conference to the visit pipeline at the "intended" stage. */
export async function addConferenceToShortlist(conferenceId: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .upsert({ conference_id: conferenceId, stage: 'intended', added_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'conference_id' })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Move a tracked conference to a different pipeline stage. */
export async function setConferenceStage(conferenceId: string, stage: ConferenceStage): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!CONFERENCE_STAGES.includes(stage)) return { ok: false, message: 'Unknown stage.' }

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .upsert({ conference_id: conferenceId, stage, added_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'conference_id' })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Remove a conference from the pipeline entirely (back to "discovered"). */
export async function removeConferenceFromPipeline(conferenceId: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db.from('conference_tracking').delete().eq('conference_id', conferenceId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Save free-text notes against a tracked conference. */
export async function setConferenceNotes(conferenceId: string, notes: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .update({ notes: notes.slice(0, 4000), updated_at: new Date().toISOString() })
    .eq('conference_id', conferenceId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

export type EnrichResult =
  | { ok: true; detail: ConferenceDetail; cached: boolean }
  | { ok: false; message: string }

/**
 * Gather (or return cached) rich detail for one conference. Detail is fetched
 * on first open and cached on the row, so subsequent opens are instant. Uses
 * the service role to write the cache (RLS write is comms-only anyway, but the
 * detail belongs to the shared list, not the user).
 */
export async function enrichConferenceDetail(conferenceId: string, options?: { refresh?: boolean }): Promise<EnrichResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const conference = await loadConference(auth.supabase, conferenceId)
  if (!conference) return { ok: false, message: 'Conference not found.' }

  // Serve the cache unless a refresh was explicitly requested.
  if (!options?.refresh && conference.detailStatus === 'ready' && conference.detail) {
    return { ok: true, detail: conference.detail, cached: true }
  }

  if (!isAiEnabled()) return { ok: false, message: 'AI features are disabled for this environment.' }

  const admin = createAdminClient() as unknown as LooseDb
  await admin.from('conferences').update({ detail_status: 'loading' }).eq('id', conferenceId)

  try {
    const detail = await enrichConference({
      name: conference.name,
      organizer: conference.organizer,
      location: conference.location,
      startDate: conference.startDate,
      endDate: conference.endDate,
      websiteUrl: conference.websiteUrl,
      sourceUrl: conference.sourceUrl,
    })
    await admin
      .from('conferences')
      .update({ detail, detail_status: 'ready', detail_fetched_at: new Date().toISOString() })
      .eq('id', conferenceId)
    revalidatePath(CONFERENCES_PATH)
    return { ok: true, detail, cached: false }
  } catch (error) {
    await admin.from('conferences').update({ detail_status: 'error' }).eq('id', conferenceId)
    return { ok: false, message: error instanceof Error ? error.message : 'Could not gather details for this conference.' }
  }
}

/** Find extra conferences using user-specified region/country/keyword criteria. */
export async function findMoreConferences(criteria: DiscoverMoreCriteria): Promise<DiscoverMoreResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!isAiEnabled()) return { ok: false, message: 'AI features are disabled for this environment.' }

  const admin = createAdminClient() as unknown as LooseDb
  const { data: existing, error } = await admin
    .from('conferences')
    .select('name, dedupe_key')
    .order('discovered_at', { ascending: false })
    .limit(600)
  if (error) return { ok: false, message: error.message }

  const existingNames = (existing ?? []).map((row) => String(row.name ?? '')).filter(Boolean)
  const existingKeys = new Set((existing ?? []).map((row) => String(row.dedupe_key ?? '')).filter(Boolean))

  try {
    const result = await findTargetedConferences({
      region: criteria.region ?? 'all',
      country: criteria.country ?? null,
      keywords: criteria.keywords ?? null,
      existingNames,
      createdBy: auth.userId,
    })
    const fresh = result.conferences.filter((conf) => !existingKeys.has(conf.dedupeKey))
    const message = fresh.length > 0
      ? `Found ${fresh.length} new conference${fresh.length === 1 ? '' : 's'} matching the criteria.`
      : `No new conferences found. The search returned ${result.validatedCount} valid result${result.validatedCount === 1 ? '' : 's'}, but they are already saved or did not match the criteria.`
    return { ok: true, conferences: fresh, message, candidateCount: result.candidateCount, validatedCount: result.validatedCount }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Targeted conference search failed.' }
  }
}

/** Add one or more targeted-search results to the shared conference list. */
export async function addDiscoveredConferences(conferences: DiscoveredConference[]): Promise<AddDiscoveredResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const validated = validateConferences({ conferences }, 'global', 12)
  if (validated.length === 0) return { ok: false, message: 'No valid conferences selected.' }

  const rows = validated.map((conf) => conferenceRow(conf, auth.userId))
  const admin = createAdminClient() as unknown as LooseDb
  const { error } = await admin.from('conferences').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return {
    ok: true,
    inserted: rows.length,
    message: `Added ${rows.length} conference${rows.length === 1 ? '' : 's'} to the list.`,
  }
}
