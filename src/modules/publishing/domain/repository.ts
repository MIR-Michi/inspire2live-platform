/**
 * publishing/domain/repository.ts — typed reads for the space.
 *
 * Defensive throughout (AGENTS.md §6): every query checks its error and
 * degrades to an empty result rather than throwing into a Server Component.
 */

import { createClient } from '@/kernel/data/server'
import { moduleClient } from '@/kernel/data'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import type { PublishableField } from '@/kernel/publishing'
import type {
  PublishingDatabase,
  PublishingDraftRow,
  PublishingPostRow,
  PublishingSourceRow,
} from '@/modules/publishing/domain/schema'
import type {
  DraftClaim,
  PostImageRef,
  PostStatus,
  PublishingDraft,
  PublishingPost,
} from '@/modules/publishing/domain/types'

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

// ─── saved posts (ADR-0015) ───────────────────────────────────────────────────

function asImageRef(value: unknown): PostImageRef | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<PostImageRef>
  if (typeof candidate.bucket !== 'string' || typeof candidate.storagePath !== 'string') return null
  return {
    bucket: candidate.bucket,
    storagePath: candidate.storagePath,
    mediaType: typeof candidate.mediaType === 'string' ? candidate.mediaType : 'image/png',
    alt: typeof candidate.alt === 'string' ? candidate.alt : '',
  }
}

export function toPost(row: PublishingPostRow): PublishingPost {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceId: row.source_id,
    draftId: row.draft_id,
    channel: row.channel,
    body: row.body,
    hashtags: row.hashtags ?? [],
    imageRef: asImageRef(row.image_ref),
    status: row.status,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    contentCalendarId: row.content_calendar_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The tile board: every saved post, newest first. */
export async function loadPosts(params?: {
  limit?: number
  status?: PostStatus
  ownerId?: string
}): Promise<PublishingPost[]> {
  const db = await publishingDb()
  let query = db.from('publishing_posts').select('*').order('created_at', { ascending: false })

  if (params?.status) query = query.eq('status', params.status)
  if (params?.ownerId) query = query.eq('owner_id', params.ownerId)
  if (params?.limit) query = query.limit(params.limit)

  const { data, error } = await query
  if (error) {
    console.error('[publishing] loadPosts failed', error.message)
    return []
  }
  return (data ?? []).map(toPost)
}

export async function loadPost(postId: string): Promise<PublishingPost | null> {
  const db = await publishingDb()
  const { data, error } = await db.from('publishing_posts').select('*').eq('id', postId).maybeSingle()
  if (error) {
    console.error('[publishing] loadPost failed', error.message)
    return null
  }
  return data ? toPost(data) : null
}

/** Which variants of a run are already saved — so the UI can offer "Open post". */
export async function loadPostsForDrafts(draftIds: string[]): Promise<PublishingPost[]> {
  if (draftIds.length === 0) return []
  const db = await publishingDb()
  const { data, error } = await db.from('publishing_posts').select('*').in('draft_id', draftIds)
  if (error) {
    console.error('[publishing] loadPostsForDrafts failed', error.message)
    return []
  }
  return (data ?? []).map(toPost)
}

/** A signed URL per post that carries a picture (the bucket is private). */
export async function signPostImages(
  posts: PublishingPost[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  const withImages = posts.filter((post) => post.imageRef)
  if (withImages.length === 0) return {}

  const supabase = await createClient()
  const entries = await Promise.all(
    withImages.map(async (post) => {
      const image = post.imageRef!
      const { data } = await supabase.storage.from(image.bucket).createSignedUrl(image.storagePath, expiresInSeconds)
      return [post.id, data?.signedUrl ?? null] as const
    }),
  )

  const urls: Record<string, string> = {}
  for (const [postId, url] of entries) {
    if (url) urls[postId] = url
  }
  return urls
}

/**
 * Who a post can belong to: the people who can reach the workspace at all.
 * Used both for the owner picker and to put a name on a tile.
 */
export async function loadPostOwnerOptions(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select('id, name, email, role').order('name')

  if (error) {
    console.error('[publishing] loadPostOwnerOptions failed', error.message)
    return []
  }

  return (data ?? [])
    .filter((profile) => canAccessCommsWorkspace(profile.role))
    .map((profile) => ({ id: profile.id, name: profile.name ?? profile.email }))
}
