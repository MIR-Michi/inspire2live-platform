'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { enrichConference, type ConferenceDetail } from '@/lib/ai/conferences'
import { loadConference } from '@/lib/comms-conferences'
import { CONFERENCE_STAGES, type ConferenceStage } from '@/lib/comms-conferences'

const CONFERENCES_PATH = '/app/comms/conferences'

type ActionResult = { ok: boolean; message?: string }

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
    upsert: (payload: Record<string, unknown>, options?: { onConflict: string }) => Promise<{ error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
    delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
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
