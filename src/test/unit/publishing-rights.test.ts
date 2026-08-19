import { describe, expect, it } from 'vitest'
import {
  canApproveDraft,
  canDismissDraft,
  canEditDraft,
  rightsAllowHandover,
  rightsBlockReason,
} from '@/modules/publishing/domain/rights'

describe('rightsAllowHandover (concept §8)', () => {
  it('a linked source (no rights answer) may hand over', () => {
    expect(rightsAllowHandover(null)).toBe(true)
    expect(rightsAllowHandover(undefined)).toBe(true)
  })

  it('only approved_for_publication clears an ad-hoc source', () => {
    expect(rightsAllowHandover('approved_for_publication')).toBe(true)
    expect(rightsAllowHandover('internal_only')).toBe(false)
    expect(rightsAllowHandover('needs_clearance')).toBe(false)
  })
})

describe('lifecycle guards', () => {
  it('only a pending draft can be edited, approved or dismissed', () => {
    for (const guard of [canEditDraft, canApproveDraft, canDismissDraft]) {
      expect(guard('pending')).toBe(true)
      expect(guard('approved')).toBe(false)
      expect(guard('dismissed')).toBe(false)
      expect(guard('superseded')).toBe(false)
      expect(guard('published')).toBe(false)
    }
  })
})

describe('rightsBlockReason — the single chokepoint every forward move goes through', () => {
  it('blocks material that is not cleared, and says why', () => {
    expect(rightsBlockReason('needs_clearance')).toMatch(/not cleared/i)
    expect(rightsBlockReason('internal_only')).toMatch(/internal/i)
  })

  it('allows cleared material and a linked source that carries no answer', () => {
    expect(rightsBlockReason('approved_for_publication')).toBeNull()
    expect(rightsBlockReason(null)).toBeNull()
    expect(rightsBlockReason(undefined)).toBeNull()
  })
})
