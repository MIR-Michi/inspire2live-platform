/**
 * publishing/domain/posts.ts — the saved post: its edits and its lifecycle.
 * (The reads live in `domain/repository.ts` with the rest of the space's.)
 *
 * A post is what a person keeps (ADR-0015). It is materialised from a draft
 * variant and from then on it is the human's: the body, the hashtags and the
 * picture are editable at every status, and the `publishing_drafts` row it came
 * from is never touched again — that row still holds the untouched `ai_body`
 * the calibration signal depends on (ADR-0014).
 *
 * Handover to the content calendar happens **from the post**, not from the
 * draft, precisely because the post is the copy that kept changing. Handing the
 * draft over after someone edited the post would put stale text on the
 * calendar.
 */

import { createClient } from '@/kernel/data/server'
import { createCalendarEntry, logIntegrationIntent } from '@/modules/content'
import type { SourceRightsStatus } from '@/kernel/publishing'
import { UPLOAD_BUCKET, validateAdhocUpload } from '@/modules/publishing/domain/adhoc-source'
import { postTransitionBlockReason } from '@/modules/publishing/domain/post-status'
import {
  loadAdhocSourceRow,
  loadDraft,
  loadPost,
  loadPostsForDrafts,
  publishingDb,
} from '@/modules/publishing/domain/repository'
import { rightsBlockReason } from '@/modules/publishing/domain/rights'
import type { PublishingPostRow } from '@/modules/publishing/domain/schema'
import type {
  ActionResult,
  PostImageRef,
  PostStatus,
  PublishingPost,
} from '@/modules/publishing/domain/types'

/**
 * Storage prefix for pictures uploaded onto a post. It matters: a post can also
 * point at the *source's* image, which the source owns — only objects under
 * this prefix may be deleted when a picture is replaced or removed.
 */
const POST_IMAGE_PREFIX = 'posts'

function isPostOwnedImage(image: PostImageRef | null): boolean {
  return Boolean(image && image.bucket === UPLOAD_BUCKET && image.storagePath.startsWith(`${POST_IMAGE_PREFIX}/`))
}

/**
 * The rights answer behind a post. It lives on the ad-hoc source row; a linked
 * source carries none, because its owning component already curates
 * publication-intended fields only.
 */
export async function postRights(post: PublishingPost): Promise<SourceRightsStatus | null> {
  if (post.sourceType !== 'adhoc') return null
  const source = await loadAdhocSourceRow(post.sourceId)
  return source?.rights_status ?? null
}

// ─── writes ───────────────────────────────────────────────────────────────────

/**
 * Keep a variant as a post. This is the "save it before I'm finished" path:
 * the copy stops being tied to the review step and becomes an object with an
 * owner, a picture and a status of its own.
 *
 * Idempotent by design — the partial unique index on `draft_id` means a second
 * Save returns the post that already exists instead of a duplicate tile.
 */
export async function savePostFromDraft(params: {
  draftId: string
  userId: string
  status?: PostStatus
}): Promise<ActionResult<{ postId: string; existed: boolean }>> {
  const draft = await loadDraft(params.draftId)
  if (!draft) return { ok: false, error: 'Draft not found.' }

  const existing = await loadPostsForDrafts([params.draftId])
  if (existing.length > 0) {
    return { ok: true, data: { postId: existing[0].id, existed: true } }
  }

  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_posts')
    .insert({
      title: null,
      source_type: draft.sourceType,
      source_id: draft.sourceId,
      draft_id: draft.id,
      channel: draft.channel,
      body: draft.body,
      hashtags: draft.hashtags,
      image_ref: draft.imageRef,
      status: params.status ?? 'draft',
      owner_id: params.userId,
      created_by: params.userId,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'The post could not be saved.' }
  }
  return { ok: true, data: { postId: data.id, existed: false } }
}

/** Rewrite a post. Allowed at every status — that is what a post is for. */
export async function updatePost(params: {
  postId: string
  body?: string
  title?: string | null
  hashtags?: string[]
}): Promise<ActionResult> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: false, error: 'Post not found.' }

  const patch: Partial<PublishingPostRow> = {}
  if (params.body !== undefined) patch.body = params.body
  if (params.title !== undefined) patch.title = params.title?.trim() || null
  if (params.hashtags !== undefined) {
    patch.hashtags = params.hashtags.map((tag) => tag.trim()).filter(Boolean)
  }
  if (Object.keys(patch).length === 0) return { ok: true }

  // An empty body is fine while it is a draft, but not once it claims to be
  // ready — the same gate the status move applies.
  if (patch.body !== undefined && !patch.body.trim() && post.status !== 'draft') {
    return { ok: false, error: 'Move the post back to draft before emptying it.' }
  }

  const db = await publishingDb()
  const { error } = await db.from('publishing_posts').update(patch).eq('id', params.postId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Move a post along its lifecycle, past the rights gate. */
export async function setPostStatus(params: {
  postId: string
  status: PostStatus
}): Promise<ActionResult> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: false, error: 'Post not found.' }
  if (post.status === params.status) return { ok: true }

  const rights = await postRights(post)
  const blocked = postTransitionBlockReason(post, params.status, rights)
  if (blocked) return { ok: false, error: blocked }

  const db = await publishingDb()
  const { data, error } = await db
    .from('publishing_posts')
    .update({
      status: params.status,
      // `published_at` records when a human said it went out; walking the
      // status back clears it rather than leaving a date that means nothing.
      published_at: params.status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', params.postId)
    .eq('status', post.status)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'The post changed while you were working on it — reload and retry.' }
  return { ok: true }
}

/** Hand the post to someone else. Visibility is team-wide; this is responsibility. */
export async function setPostOwner(params: { postId: string; ownerId: string }): Promise<ActionResult> {
  const db = await publishingDb()
  const { error } = await db
    .from('publishing_posts')
    .update({ owner_id: params.ownerId })
    .eq('id', params.postId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Add or replace the post's picture. Follows the upload pattern the component
 * already uses: validate, write storage, then the row — and clean up the object
 * when the row write fails, so a failed attach leaves nothing behind.
 */
export async function attachPostImage(params: {
  postId: string
  file: File
  userId: string
  maxUploadMegabytes: number
  alt?: string
}): Promise<ActionResult> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: false, error: 'Post not found.' }

  const invalid = validateAdhocUpload(
    { name: params.file.name, type: params.file.type, size: params.file.size },
    params.maxUploadMegabytes,
  )
  if (invalid) return { ok: false, error: invalid }

  const supabase = await createClient()
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'upload'
  const storagePath = `${POST_IMAGE_PREFIX}/${params.userId}/${Date.now()}-${safeName}`

  const upload = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, params.file, {
    contentType: params.file.type,
    upsert: false,
  })
  if (upload.error) return { ok: false, error: `Upload failed: ${upload.error.message}` }

  const image: PostImageRef = {
    bucket: UPLOAD_BUCKET,
    storagePath,
    mediaType: params.file.type,
    alt: (params.alt ?? '').trim().slice(0, 160),
  }

  const db = await publishingDb()
  const { error } = await db.from('publishing_posts').update({ image_ref: image }).eq('id', params.postId)
  if (error) {
    await supabase.storage.from(UPLOAD_BUCKET).remove([storagePath])
    return { ok: false, error: error.message }
  }

  // The picture being replaced is only ours to delete when the post uploaded it.
  const previous = post.imageRef
  if (isPostOwnedImage(previous) && previous!.storagePath !== storagePath) {
    await supabase.storage.from(UPLOAD_BUCKET).remove([previous!.storagePath])
  }

  return { ok: true }
}

export async function removePostImage(params: { postId: string }): Promise<ActionResult> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: false, error: 'Post not found.' }
  if (!post.imageRef) return { ok: true }

  const db = await publishingDb()
  const { error } = await db.from('publishing_posts').update({ image_ref: null }).eq('id', params.postId)
  if (error) return { ok: false, error: error.message }

  if (isPostOwnedImage(post.imageRef)) {
    const supabase = await createClient()
    await supabase.storage.from(UPLOAD_BUCKET).remove([post.imageRef.storagePath])
  }
  return { ok: true }
}

export async function deletePost(params: { postId: string }): Promise<ActionResult> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: true }

  const db = await publishingDb()
  const { error } = await db.from('publishing_posts').delete().eq('id', params.postId)
  if (error) return { ok: false, error: error.message }

  if (isPostOwnedImage(post.imageRef)) {
    const supabase = await createClient()
    await supabase.storage.from(UPLOAD_BUCKET).remove([post.imageRef!.storagePath])
  }
  return { ok: true }
}

/** Channel → integration target for the Phase-1 delivery-intent log. */
const INTENT_TARGET_BY_CHANNEL: Record<string, 'linkedin' | 'mailchimp' | 'wordpress'> = {
  linkedin: 'linkedin',
  newsletter: 'mailchimp',
  wordpress: 'wordpress',
}

/**
 * Put the post on the content calendar — through `content`'s own action, never
 * a direct insert (ADR-0009 §9 rule 3). Handover sends the *post's* current
 * text, which is the whole reason it hangs off the post rather than the draft.
 */
export async function handOverPost(params: {
  postId: string
  userId: string
  /** The source's public URL, when its provider exposes one. */
  sourceLink?: string | null
  /** The owning provider's provenance hook, resolved by the app-layer registry. */
  onPublished?: (calendarEntryId: string) => Promise<void>
}): Promise<ActionResult<{ contentCalendarId: string; warning?: string }>> {
  const post = await loadPost(params.postId)
  if (!post) return { ok: false, error: 'Post not found.' }
  if (post.contentCalendarId) return { ok: false, error: 'This post is already on the calendar.' }
  if (post.status === 'draft') return { ok: false, error: 'Mark the post ready to publish first.' }
  if (!post.body.trim()) return { ok: false, error: 'The post is empty.' }

  const rights = await postRights(post)
  const blocked = rightsBlockReason(rights)
  if (blocked) return { ok: false, error: blocked }

  const title =
    post.title?.trim() ||
    post.body.split('\n').find((line) => line.trim().length > 0)?.trim().slice(0, 120) ||
    'Saved post'

  const bodyDraft = [post.body, post.hashtags.join(' ')].filter(Boolean).join('\n\n')

  const supabase = await createClient()
  const entry = await createCalendarEntry(supabase, {
    title,
    channels: [post.channel],
    status: 'draft',
    bodyDraft,
    sourceLink: params.sourceLink ?? null,
    authorId: post.ownerId,
  })
  if (!entry.ok) return { ok: false, error: entry.error }

  const db = await publishingDb()
  const { data: updated, error: linkError } = await db
    .from('publishing_posts')
    .update({ content_calendar_id: entry.id })
    .eq('id', params.postId)
    .is('content_calendar_id', null)
    .select('id')
    .maybeSingle()
  if (linkError) return { ok: false, error: linkError.message }
  if (!updated) return { ok: false, error: 'The post was modified while handing over — reload and retry.' }

  let warning: string | undefined

  const target = INTENT_TARGET_BY_CHANNEL[post.channel]
  if (target) {
    try {
      await logIntegrationIntent(supabase, {
        target,
        actionName: 'schedule_stub',
        requestedBy: params.userId,
        entityType: 'publishing_posts',
        entityId: post.id,
        payload: { contentCalendarId: entry.id, channel: post.channel, ownerId: post.ownerId },
      })
    } catch (error) {
      warning = `The delivery intent could not be logged: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  if (params.onPublished) {
    try {
      await params.onPublished(entry.id)
    } catch (error) {
      warning = `Provenance write-back failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  return { ok: true, data: { contentCalendarId: entry.id, warning } }
}
