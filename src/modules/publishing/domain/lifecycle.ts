/**
 * publishing/domain/lifecycle.ts — edit, approve, dismiss, hand over.
 *
 * The two hard rules live here, in the domain, not in the UI:
 * 1. `ai_body` is never overwritten — the distance between it and the approved
 *    `body` is the only honest calibration signal (concept §11 stage 4).
 * 2. Handover is impossible without an explicit human approval and impossible
 *    while the rights answer is not cleared (`handoverBlockReason`) — there is
 *    no setting and no code path that skips the gate (ADR-0014 §8).
 */

import { createClient } from '@/kernel/data/server'
import { isSourceStale, type SourceRightsStatus } from '@/kernel/publishing'
import { createCalendarEntry, logIntegrationIntent } from '@/modules/content'
import {
  canApproveDraft,
  canDismissDraft,
  canEditDraft,
  handoverBlockReason,
} from '@/modules/publishing/domain/rights'
import { resolvePublishingConfig } from '@/modules/publishing/domain/config'
import {
  loadAdhocSourceRow,
  loadDraft,
  publishingDb,
} from '@/modules/publishing/domain/repository'
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

/** Channel → integration target for the Phase-1 delivery-intent log. */
const INTENT_TARGET_BY_CHANNEL: Record<string, 'linkedin' | 'mailchimp' | 'wordpress'> = {
  linkedin: 'linkedin',
  newsletter: 'mailchimp',
  wordpress: 'wordpress',
}

/**
 * Hand an approved draft over to the content calendar — through `content`'s
 * own action, never a direct insert. Then log the delivery intent and let the
 * caller run the source owner's `onPublished` hook (provenance write-back).
 */
export async function handOverApprovedDraft(params: {
  draftId: string
  userId: string
  /** Calendar entry title; falls back to the draft's first line. */
  title?: string | null
  /** The source's public URL, when its provider exposes one. */
  sourceLink?: string | null
  /** The owning provider's provenance hook, resolved by the app-layer registry. */
  onPublished?: (calendarEntryId: string) => Promise<void>
}): Promise<ActionResult<{ contentCalendarId: string; warning?: string }>> {
  const draft = await loadDraft(params.draftId)
  if (!draft) return { ok: false, error: 'Draft not found.' }

  // The rights answer lives on the ad-hoc source row; linked sources carry none.
  let rights: SourceRightsStatus | null = null
  if (draft.sourceType === 'adhoc') {
    const source = await loadAdhocSourceRow(draft.sourceId)
    if (!source) return { ok: false, error: 'The uploaded source behind this draft no longer exists.' }
    rights = source.rights_status
  }

  const blocked = handoverBlockReason(draft, rights)
  if (blocked) return { ok: false, error: blocked }

  const title =
    params.title?.trim() ||
    draft.body.split('\n').find((line) => line.trim().length > 0)?.trim().slice(0, 120) ||
    'Approved post'

  const bodyDraft = [draft.body, draft.hashtags.join(' ')].filter(Boolean).join('\n\n')

  const supabase = await createClient()
  const entry = await createCalendarEntry(supabase, {
    title,
    channels: [draft.channel],
    status: 'draft',
    bodyDraft,
    sourceLink: params.sourceLink ?? null,
    authorId: params.userId,
  })
  if (!entry.ok) return { ok: false, error: entry.error }

  const db = await publishingDb()
  const { data: updated, error: linkError } = await db
    .from('publishing_drafts')
    .update({ status: 'published', content_calendar_id: entry.id })
    .eq('id', params.draftId)
    .eq('status', 'approved')
    .select('*')
    .maybeSingle()
  if (linkError) return { ok: false, error: linkError.message }
  if (!updated) return { ok: false, error: 'The draft was modified while handing over — reload and retry.' }

  let warning: string | undefined

  const target = INTENT_TARGET_BY_CHANNEL[draft.channel]
  if (target) {
    try {
      await logIntegrationIntent(supabase, {
        target,
        actionName: 'schedule_stub',
        requestedBy: params.userId,
        entityType: 'publishing_drafts',
        entityId: draft.id,
        payload: { contentCalendarId: entry.id, channel: draft.channel, approvedBy: draft.approvedBy },
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
