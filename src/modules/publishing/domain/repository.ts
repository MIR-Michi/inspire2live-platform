/**
 * publishing/domain/repository.ts — typed reads for the space.
 *
 * Defensive throughout (AGENTS.md §6): every query checks its error and
 * degrades to an empty result rather than throwing into a Server Component.
 */

import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import type { PublishableField } from '@/kernel/publishing'
import type {
  PublishingDatabase,
  PublishingDraftRow,
  PublishingSourceRow,
} from '@/modules/publishing/domain/schema'
import type { DraftClaim, PublishingDraft } from '@/modules/publishing/domain/types'

export async function publishingDb() {
  const supabase = await createClient()
  return moduleClient<PublishingDatabase>(supabase)
}

function asFieldArray(value: unknown): PublishableField[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is PublishableField =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as PublishableField).key === 'string' &&
      typeof (entry as PublishableField).value === 'string',
  )
}

function asClaimArray(value: unknown): DraftClaim[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is DraftClaim =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as DraftClaim).text === 'string' &&
      typeof (entry as DraftClaim).sourceFieldKey === 'string',
  )
}

export function toDraft(row: PublishingDraftRow): PublishingDraft {
  const imageRef =
    row.image_ref && typeof row.image_ref === 'object'
      ? (row.image_ref as PublishingDraft['imageRef'])
      : null
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceFingerprint: row.source_fingerprint,
    sourceFields: asFieldArray(row.source_fields),
    channel: row.channel,
    runId: row.run_id,
    variantIndex: row.variant_index,
    angle: row.angle,
    body: row.body,
    aiBody: row.ai_body,
    hashtags: row.hashtags ?? [],
    claims: asClaimArray(row.claims),
    imageRef,
    imageDescription: row.image_description,
    omitted: row.omitted ?? [],
    status: row.status,
    model: row.model,
    contentCalendarId: row.content_calendar_id,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The live drafts for one source + channel: the pending run plus anything approved/handed over. */
export async function loadDrafts(params: {
  sourceType: string
  sourceId: string
  channel: string
}): Promise<PublishingDraft[]> {
  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_drafts')
    .select('*')
    .eq('source_type', params.sourceType)
    .eq('source_id', params.sourceId)
    .eq('channel', params.channel)
    .in('status', ['pending', 'approved', 'published'])
    .order('created_at', { ascending: false })
    .order('variant_index', { ascending: true })
  if (error) {
    console.error('[publishing] loadDrafts failed', error.message)
    return []
  }
  return (data ?? []).map(toDraft)
}

/** The strip of recent drafts under the source step (any source, any status). */
export async function loadRecentDrafts(limit = 8): Promise<PublishingDraft[]> {
  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_drafts')
    .select('*')
    .in('status', ['approved', 'published', 'pending'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[publishing] loadRecentDrafts failed', error.message)
    return []
  }
  return (data ?? []).map(toDraft)
}

export async function loadDraft(draftId: string): Promise<PublishingDraft | null> {
  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle()
  if (error) {
    console.error('[publishing] loadDraft failed', error.message)
    return null
  }
  return data ? toDraft(data) : null
}

export async function loadAdhocSourceRow(sourceId: string): Promise<PublishingSourceRow | null> {
  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_sources')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle()
  if (error) {
    console.error('[publishing] loadAdhocSourceRow failed', error.message)
    return null
  }
  return data ?? null
}
