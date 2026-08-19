'use server'

/**
 * The Publishing space's server actions — the app-layer wiring point
 * (ADR-0014 §4): this is where the registry resolves a source owner and the
 * `publishing` domain does the work, the same role `intake/ai-actions.ts`
 * plays for intake AI. Access is enforced here (comms roles) and again by RLS.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  approveDraft,
  attachPostImage,
  createAdhocSource,
  deletePost,
  dismissDraft,
  editDraft,
  generateDrafts,
  handOverPost,
  loadPost,
  removePostImage,
  resolvePublishingConfig,
  savePostFromDraft,
  setPostOwner,
  setPostStatus,
  updatePost,
  type PostStatus,
  type PublishingActionState,
} from '@/modules/publishing'
import { onPublishedHook, resolveSource } from '@/modules/publishing-registry'

const SPACE_PATH = '/app/comms/publishing'

function postPath(postId: string): string {
  return `${SPACE_PATH}/posts/${postId}`
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, userId: user.id }
}

function failed(error: unknown, fallback: string): PublishingActionState {
  return { ok: false, error: error instanceof Error ? error.message : fallback }
}

export async function createAdhocSourceAction(formData: FormData): Promise<PublishingActionState> {
  try {
    const { userId } = await requireCommsOperator()

    const file = formData.get('image')
    if (!(file instanceof File)) return { ok: false, error: 'Pick an image first.' }
    const description = typeof formData.get('description') === 'string' ? (formData.get('description') as string) : ''
    const rights = typeof formData.get('rights') === 'string' ? (formData.get('rights') as string) : ''

    const config = await resolvePublishingConfig()
    const result = await createAdhocSource({
      file,
      description,
      rights,
      userId,
      maxUploadMegabytes: config.maxUploadMegabytes,
    })
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    return { ok: true, sourceId: result.data?.sourceId }
  } catch (error) {
    return failed(error, 'Could not save the upload.')
  }
}

export async function generateDraftsAction(input: {
  sourceType: string
  sourceId: string
  channel: string
}): Promise<PublishingActionState> {
  try {
    const { supabase, userId } = await requireCommsOperator()
    if (!isAiEnabled()) return { ok: false, error: 'AI features are switched off on this platform.' }

    const source = await resolveSource({ supabase }, input.sourceType, input.sourceId)
    if (!source) return { ok: false, error: 'This source could not be found.' }

    const result = await generateDrafts({ source, channel: input.channel, userId })
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not generate drafts.')
  }
}

export async function editDraftAction(input: { draftId: string; body: string }): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await editDraft(input)
    if (!result.ok) return result
    revalidatePath(SPACE_PATH)
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not save the edit.')
  }
}

export async function approveDraftAction(input: {
  draftId: string
  sourceType: string
  sourceId: string
}): Promise<PublishingActionState> {
  try {
    const { supabase, userId } = await requireCommsOperator()

    // The live fingerprint powers the stale-source gate; an ad-hoc source is
    // immutable so resolving it again is unnecessary.
    let currentFingerprint: string | null = null
    if (input.sourceType !== 'adhoc') {
      const source = await resolveSource({ supabase }, input.sourceType, input.sourceId)
      currentFingerprint = source?.fingerprint ?? null
    }

    const result = await approveDraft({ draftId: input.draftId, userId, currentFingerprint })
    if (!result.ok) return result

    // Approving is also the moment the copy becomes a post someone owns: it
    // arrives ready to publish rather than as a draft (ADR-0015).
    const post = await savePostFromDraft({ draftId: input.draftId, userId, status: 'ready_to_publish' })
    if (!post.ok) return post

    revalidatePath(SPACE_PATH)
    return { ok: true, postId: post.data?.postId }
  } catch (error) {
    return failed(error, 'Could not approve the draft.')
  }
}

export async function dismissDraftAction(input: { draftId: string }): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await dismissDraft(input)
    if (!result.ok) return result
    revalidatePath(SPACE_PATH)
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not dismiss the draft.')
  }
}

// ─── saved posts (ADR-0015) ───────────────────────────────────────────────────

/** Keep a variant as a post without approving it — the "save it for later" path. */
export async function savePostAction(input: { draftId: string }): Promise<PublishingActionState> {
  try {
    const { userId } = await requireCommsOperator()
    const result = await savePostFromDraft({ draftId: input.draftId, userId })
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    return {
      ok: true,
      postId: result.data?.postId,
      message: result.data?.existed ? 'Already saved.' : 'Saved.',
    }
  } catch (error) {
    return failed(error, 'Could not save the post.')
  }
}

export async function updatePostAction(input: {
  postId: string
  body?: string
  title?: string | null
  hashtags?: string[]
}): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await updatePost(input)
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(input.postId))
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not save the post.')
  }
}

export async function setPostStatusAction(input: {
  postId: string
  status: PostStatus
}): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await setPostStatus(input)
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(input.postId))
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not change the status.')
  }
}

export async function setPostOwnerAction(input: {
  postId: string
  ownerId: string
}): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await setPostOwner(input)
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(input.postId))
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not change the owner.')
  }
}

export async function attachPostImageAction(formData: FormData): Promise<PublishingActionState> {
  try {
    const { userId } = await requireCommsOperator()

    const postId = formData.get('postId')
    if (typeof postId !== 'string' || !postId) return { ok: false, error: 'Which post?' }
    const file = formData.get('image')
    if (!(file instanceof File)) return { ok: false, error: 'Pick an image first.' }
    const alt = typeof formData.get('alt') === 'string' ? (formData.get('alt') as string) : ''

    const config = await resolvePublishingConfig()
    const result = await attachPostImage({
      postId,
      file,
      alt,
      userId,
      maxUploadMegabytes: config.maxUploadMegabytes,
    })
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(postId))
    return { ok: true, message: 'Picture added.' }
  } catch (error) {
    return failed(error, 'Could not add the picture.')
  }
}

export async function removePostImageAction(input: { postId: string }): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await removePostImage(input)
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(input.postId))
    return { ok: true }
  } catch (error) {
    return failed(error, 'Could not remove the picture.')
  }
}

export async function deletePostAction(input: { postId: string }): Promise<PublishingActionState> {
  try {
    await requireCommsOperator()
    const result = await deletePost(input)
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    return { ok: true, message: 'Post deleted.' }
  } catch (error) {
    return failed(error, 'Could not delete the post.')
  }
}

/**
 * Put the post on the content calendar. Handover reads the post's current text,
 * not the frozen draft, which is why it hangs off the post (ADR-0015).
 */
export async function handOverPostAction(input: { postId: string }): Promise<PublishingActionState> {
  try {
    const { supabase, userId } = await requireCommsOperator()

    const post = await loadPost(input.postId)
    if (!post) return { ok: false, error: 'Post not found.' }

    // Resolve the source for its public link and the owner's provenance hook.
    const source = await resolveSource({ supabase }, post.sourceType, post.sourceId)

    const result = await handOverPost({
      postId: input.postId,
      userId,
      sourceLink: source?.publicUrl ?? null,
      onPublished: onPublishedHook({ supabase }, post.sourceType, post.sourceId),
    })
    if (!result.ok) return result

    revalidatePath(SPACE_PATH)
    revalidatePath(postPath(input.postId))
    revalidatePath('/app/comms/calendar')
    return { ok: true, warning: result.data?.warning, message: 'On the calendar.' }
  } catch (error) {
    return failed(error, 'Could not hand the post over.')
  }
}
