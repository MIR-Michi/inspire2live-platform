import { describe, expect, it } from 'vitest'
import {
  canApproveDraft,
  canDismissDraft,
  canEditDraft,
  handoverBlockReason,
  rightsAllowHandover,
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

describe('handoverBlockReason — approval is unconditional, rights have teeth', () => {
  it('blocks every non-approved status (approval before handover, no exceptions)', () => {
    expect(handoverBlockReason({ status: 'pending' }, null)).toMatch(/approve/i)
    expect(handoverBlockReason({ status: 'dismissed' }, null)).toMatch(/approve/i)
    expect(handoverBlockReason({ status: 'superseded' }, null)).toMatch(/approve/i)
    expect(handoverBlockReason({ status: 'published' }, null)).toMatch(/already/i)
  })

  it('blocks an approved draft whose material is not cleared', () => {
    expect(handoverBlockReason({ status: 'approved' }, 'needs_clearance')).toMatch(/not cleared/i)
    expect(handoverBlockReason({ status: 'approved' }, 'internal_only')).toMatch(/internal/i)
  })

  it('allows an approved draft with cleared or absent rights', () => {
    expect(handoverBlockReason({ status: 'approved' }, 'approved_for_publication')).toBeNull()
    expect(handoverBlockReason({ status: 'approved' }, null)).toBeNull()
  })
})
