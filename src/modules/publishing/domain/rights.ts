/**
 * publishing/domain/rights.ts — the rights gate (concept §8) and the lifecycle
 * guards. Both are pure so they can be unit-tested without a database, and
 * both are enforced in the domain layer — never only in the UI.
 *
 * Human approval before handover is deliberately NOT a setting (ADR-0014 §8):
 * `handoverBlockReason` is the single chokepoint, and there is no code path
 * around it.
 */

import type { SourceRightsStatus } from '@/kernel/publishing'
import type { DraftStatus } from '@/modules/publishing/domain/types'

/**
 * Whether the rights answer allows the material to leave the building.
 * `null`/`undefined` means a linked source — its owner already curates
 * publication-intended fields only, so nothing extra blocks it.
 */
export function rightsAllowHandover(rights: SourceRightsStatus | null | undefined): boolean {
  if (rights === null || rights === undefined) return true
  return rights === 'approved_for_publication'
}

/** Only a live pending draft can be edited (approved copy is what was approved). */
export function canEditDraft(status: DraftStatus): boolean {
  return status === 'pending'
}

export function canApproveDraft(status: DraftStatus): boolean {
  return status === 'pending'
}

export function canDismissDraft(status: DraftStatus): boolean {
  return status === 'pending'
}

/**
 * The handover gate. Returns null when handover may proceed, otherwise the
 * human-readable reason it must not. Approval is unconditional and rights must
 * be cleared — enforced here, in the domain, for every caller.
 */
export function handoverBlockReason(
  draft: { status: DraftStatus },
  rights: SourceRightsStatus | null | undefined,
): string | null {
  if (draft.status === 'published') return 'This draft has already been handed over.'
  if (draft.status !== 'approved') return 'Only an approved draft can hand over — approve it first.'
  if (!rightsAllowHandover(rights)) {
    return rights === 'needs_clearance'
      ? 'The rights on this material are not cleared yet.'
      : 'This material is marked internal-only.'
  }
  return null
}
