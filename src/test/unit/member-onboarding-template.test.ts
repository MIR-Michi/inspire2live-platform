import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ONBOARDING_TASKS,
  buildOnboardingSeedRows,
  normalizeOwnerName,
} from '@/lib/member-onboarding-template'

describe('member onboarding default checklist', () => {
  const profiles = [
    { id: 'ieva', name: 'Ieva Kovalevskyte' },
    { id: 'guido', name: '  guido   schouw ' }, // messy casing/spacing still matches
    { id: 'peter', name: 'Peter Kapitein' },
  ]

  it('seeds the default tasks with owners resolved by name', () => {
    const rows = buildOnboardingSeedRows({ onboardingId: 'm1', actorId: 'admin', profiles, existing: [] })

    expect(rows.map((r) => [r.title, r.assignee_id])).toEqual([
      ['Send template for invitation', 'ieva'],
      ['Add to MS', 'guido'],
      ['Add to WordPress', 'ieva'],
      ['Add to WhatsApp', 'peter'],
    ])
    // Positions are a clean 0-based sequence and metadata is carried through.
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3])
    expect(rows.every((r) => r.onboarding_id === 'm1' && r.created_by === 'admin' && r.status === 'not_started')).toBe(true)
  })

  it('leaves the owner unassigned when the person cannot be resolved', () => {
    const rows = buildOnboardingSeedRows({ onboardingId: 'm1', actorId: 'admin', profiles: [], existing: [] })
    expect(rows).toHaveLength(DEFAULT_ONBOARDING_TASKS.length)
    expect(rows.every((r) => r.assignee_id === null)).toBe(true)
  })

  it('skips titles already present and continues the position sequence', () => {
    const existing = [{ title: 'Add to MS', position: 0 }, { title: 'Add to WhatsApp', position: 1 }]
    const rows = buildOnboardingSeedRows({ onboardingId: 'm1', actorId: 'admin', profiles, existing })

    // Only the two not-yet-present templates are seeded.
    expect(rows.map((r) => r.title)).toEqual(['Send template for invitation', 'Add to WordPress'])
    // Positions continue after the highest existing one (max 1 → 2, 3).
    expect(rows.map((r) => r.position)).toEqual([2, 3])
  })

  it('normalizes owner names for tolerant matching', () => {
    expect(normalizeOwnerName('  Ieva   Kovalevskyte ')).toBe('ieva kovalevskyte')
    expect(normalizeOwnerName(null)).toBe('')
  })
})
