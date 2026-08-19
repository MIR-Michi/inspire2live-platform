/**
 * publishing/domain/types.ts — the component's vocabulary.
 *
 * Kept out of the 'use server' action files so types and pure metadata can be
 * imported anywhere (UI, tests) without pulling server-only code.
 */

import type { PublishableField, SourceRightsStatus } from '@/kernel/publishing'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

/** Draft lifecycle. `published` means *handed over* — the real publishing
 * lifecycle (draft → in_review → scheduled → published → archived) stays in
 * content_calendar, which already owns and validates it. */
export type DraftStatus = 'pending' | 'approved' | 'dismissed' | 'superseded' | 'published'

export type DraftClaim = {
  text: string
  /** Must cite a field key that was actually sent — validated, never trusted. */
  sourceFieldKey: string
}

/** The image travelling with a draft or a post (a pointer into private storage). */
export type PostImageRef = {
  bucket: string
  storagePath: string
  mediaType: string
  alt: string
}

export type PublishingDraft = {
  id: string
  sourceType: string
  sourceId: string
  sourceFingerprint: string
  /** Exactly the fields that were sent to the model (provenance for review). */
  sourceFields: PublishableField[]
  channel: string
  runId: string
  variantIndex: number
  angle: string | null
  body: string
  aiBody: string
  hashtags: string[]
  claims: DraftClaim[]
  imageRef: PostImageRef | null
  imageDescription: string | null
  omitted: string[]
  status: DraftStatus
  model: string | null
  contentCalendarId: string | null
  createdBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Runtime shape of the manifest `config` (resolved default → DB → env). */
export type PublishingConfig = {
  variantsPerRun: number
  brandVoice: string
  bannedPhrases: string
  hashtagPolicy: 'none' | 'suggest' | 'fixed'
  fixedHashtags: string
  includeSourceLink: boolean
  minimumSourceCharacters: number
  maxUploadMegabytes: number
  staleDraftBehaviour: 'warn' | 'block'
}

export const DEFAULT_PUBLISHING_CONFIG: PublishingConfig = {
  variantsPerRun: 3,
  brandVoice:
    'Warm, direct and factual. We write as patient advocates: hopeful but never overpromising, always grounded in what actually happened.',
  bannedPhrases: 'breakthrough, game-changer, revolutionary, miracle cure, cure for cancer',
  hashtagPolicy: 'suggest',
  fixedHashtags: '',
  includeSourceLink: true,
  minimumSourceCharacters: 120,
  maxUploadMegabytes: 10,
  staleDraftBehaviour: 'warn',
}

/** Rights vocabulary on an ad-hoc source (reuses media_assets.rights_status values). */
export const RIGHTS_STATUSES: readonly SourceRightsStatus[] = [
  'approved_for_publication',
  'internal_only',
  'needs_clearance',
]

export const RIGHTS_META: Record<SourceRightsStatus, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  approved_for_publication: { label: 'Cleared', tone: 'green' },
  internal_only: { label: 'Internal', tone: 'amber' },
  needs_clearance: { label: 'Unclear', tone: 'red' },
}

export const DRAFT_STATUS_META: Record<DraftStatus, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }> = {
  pending: { label: 'Pending', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
  superseded: { label: 'Superseded', tone: 'neutral' },
  published: { label: 'Handed over', tone: 'blue' },
}

/**
 * A saved post's own lifecycle (ADR-0015) — three states a person recognises,
 * unlike `DraftStatus`, which is the mechanics of a generation run.
 * `published` is a human statement that the copy went out: nothing in the
 * platform posts to a channel by itself.
 */
export type PostStatus = 'draft' | 'ready_to_publish' | 'published'

export const POST_STATUSES: readonly PostStatus[] = ['draft', 'ready_to_publish', 'published']

export const POST_STATUS_META: Record<PostStatus, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  ready_to_publish: { label: 'Ready to publish', tone: 'green' },
  published: { label: 'Published', tone: 'blue' },
}

export type PublishingPost = {
  id: string
  title: string | null
  sourceType: string
  sourceId: string
  /** The variant it was saved from, when it came from a generation run. */
  draftId: string | null
  channel: string
  body: string
  hashtags: string[]
  imageRef: PostImageRef | null
  status: PostStatus
  /** Who is responsible for the post — reassignable. */
  ownerId: string
  /** Who created it — never changes. */
  createdBy: string
  contentCalendarId: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}
