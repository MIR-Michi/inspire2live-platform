/**
 * publishing/domain/lifecycle.ts — edit, approve, dismiss.
 *
 * The hard rule lives here, in the domain, not in the UI: `ai_body` is never
 * overwritten — the distance between it and the approved `body` is the only
 * honest calibration signal (concept §11 stage 4).
 *
 * Handover to the calendar is deliberately *not* here. It hangs off the saved
 * post (`domain/posts.ts`, ADR-0015), because the post is the copy that keeps
 * changing after approval; handing the frozen draft over would put stale text
 * on the calendar.
 */

import { isSourceStale } from '@/kernel/publishing'
import {
  canApproveDraft,
  canDismissDraft,
  canEditDraft,
} from '@/modules/publishing/domain/rights'
import { resolvePublishingConfig } from '@/modules/publishing/domain/config'
import { loadDraft, publishingDb } from '@/modules/publishing/domain/repository'
import type { ActionResult, PublishingDraft } from '@/modules/publishing/domain/types'

/** Human edits land in `body`; `ai_body` stays untouched. */
export async function editDraft(params: {
  draftId: string
  body: string
}): Promise<ActionResult> {
  const body = params.body.trim()
  if (!body) return { ok: false, error: 'The draft text cannot be empty.' }

  const draft = await loadDraft(params.draftId)
  if (!draft) return { ok: false, error: 'Draft not found.' }
  if (!canEditDraft(draft.status)) {
    return { ok: false, error: 'Only a pending draft can be edited.' }
  }

  const db = await publishingDb()
  const { error } = await db.from('publishing_drafts').update({ body }).eq('id', params.draftId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Approve one variant: stamps who approved what, dismisses the sibling
 * variants of the same run. When the linked source changed since generation
 * and `staleDraftBehaviour` is 'block', approval is refused until regenerated.
 */
export async function approveDraft(params: {
  draftId: string
  userId: string
  /** The live source fingerprint, when the caller resolved the source (linked sources). */
  currentFingerprint?: string | null
}): Promise<ActionResult<{ draft: PublishingDraft }>> {
  const draft = await loadDraft(params.draftId)
  if (!draft) return { ok: false, error: 'Draft not found.' }
  if (!canApproveDraft(draft.status)) {
    return {
      ok: false,
      error:
        draft.status === 'superseded'
          ? 'This run was superseded by a newer generation.'
          : 'Only a pending draft can be approved.',
    }
  }

  if (params.currentFingerprint && isSourceStale(draft.sourceFingerprint, params.currentFingerprint)) {
    const config = await resolvePublishingConfig()
    if (config.staleDraftBehaviour === 'block') {
      return { ok: false, error: 'The source changed after this draft was generated — regenerate before approving.' }
    }
  }

  const db = await publishingDb()
  const approvedAt = new Date().toISOString()
  const { error } = await db
    .from('publishing_drafts')
    .update({ status: 'approved', approved_by: params.userId, approved_at: approvedAt })
    .eq('id', params.draftId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }

  const siblings = await db
    .from('publishing_drafts')
    .update({ status: 'dismissed' })
    .eq('run_id', draft.runId)
    .eq('status', 'pending')
    .neq('id', params.draftId)
  if (siblings.error) return { ok: false, error: siblings.error.message }

  const approved = await loadDraft(params.draftId)
  return approved ? { ok: true, data: { draft: approved } } : { ok: true }
}

export async function dismissDraft(params: { draftId: string }): Promise<ActionResult> {
  const draft = await loadDraft(params.draftId)
  if (!draft) return { ok: false, error: 'Draft not found.' }
  if (!canDismissDraft(draft.status)) {
    return { ok: false, error: 'Only a pending draft can be dismissed.' }
  }

  const db = await publishingDb()
  const { error } = await db
    .from('publishing_drafts')
    .update({ status: 'dismissed' })
    .eq('id', params.draftId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
