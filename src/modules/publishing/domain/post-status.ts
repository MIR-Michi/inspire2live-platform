/**
 * publishing/domain/post-status.ts — the saved post's lifecycle, as pure
 * functions so every rule can be unit-tested without a database and enforced
 * again in the domain layer, never only in the UI.
 *
 * Two rules are worth stating out loud:
 *
 * 1. **A post is editable at every status** — that is the point of it existing
 *    (ADR-0015). The frozen artifact is the `publishing_drafts` row it was
 *    saved from, whose `ai_body` still carries the untouched model output.
 * 2. **The rights answer gates the whole right-hand side of the lifecycle**,
 *    not just handover: material that is internal-only or awaiting clearance
 *    cannot be marked ready to publish, and cannot be marked published. The
 *    same `rightsAllowHandover` predicate decides all three.
 */

import type { SourceRightsStatus } from '@/kernel/publishing'
import { rightsBlockReason } from '@/modules/publishing/domain/rights'
import type { PostStatus } from '@/modules/publishing/domain/types'

/**
 * Where a post may go from where it is. Deliberately forgiving in both
 * directions: a post marked published by mistake can be walked back, because
 * the alternative is a wrong tile nobody can correct.
 */
const ALLOWED_POST_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['ready_to_publish'],
  ready_to_publish: ['draft', 'published'],
  published: ['ready_to_publish'],
}

/** How each status reads inside a sentence. */
const POST_STATUS_WORDS: Record<PostStatus, string> = {
  draft: 'draft',
  ready_to_publish: 'ready-to-publish',
  published: 'published',
}

export function nextPostStatuses(current: PostStatus): PostStatus[] {
  return ALLOWED_POST_TRANSITIONS[current] ?? []
}

export function canTransitionPost(current: PostStatus, next: PostStatus): boolean {
  return nextPostStatuses(current).includes(next)
}

/** A post can always be rewritten, re-pictured and reassigned. */
export function canEditPost(): boolean {
  return true
}

/**
 * The gate for moving a post forward. Returns null when the move may proceed,
 * otherwise the human-readable reason it must not.
 *
 * `rights` is null for a linked source — its owning component already curates
 * publication-intended fields only, so nothing extra blocks it.
 */
export function postTransitionBlockReason(
  post: { status: PostStatus; body: string },
  next: PostStatus,
  rights: SourceRightsStatus | null | undefined,
): string | null {
  if (post.status === next) return null

  if (!canTransitionPost(post.status, next)) {
    return `A ${POST_STATUS_WORDS[post.status]} post cannot move straight to ${POST_STATUS_WORDS[next]}.`
  }

  // Moving backwards is always allowed — only the forward moves are gated.
  const forward = next === 'ready_to_publish' || next === 'published'
  if (!forward) return null

  if (!post.body.trim()) return 'Write the post before marking it ready.'

  return rightsBlockReason(rights)
}

/**
 * The title shown on a tile: the explicit title when there is one, otherwise
 * the first non-empty line of the body, otherwise a placeholder — a saved post
 * may legitimately be empty while someone is still working on it.
 */
export function postDisplayTitle(post: { title: string | null; body: string }): string {
  const explicit = post.title?.trim()
  if (explicit) return explicit

  const firstLine = post.body.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (firstLine) return firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine

  return 'Untitled post'
}
