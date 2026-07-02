import { describe, it, expect } from 'vitest'
import { normalizeStage, STAGE_META, STAGE_ORDER, type InitiativeStage } from '@/lib/initiative-stages'

describe('initiative-stages', () => {
  it('normalizes known phases (case-insensitive)', () => {
    expect(normalizeStage('Idea')).toBe('idea')
    expect(normalizeStage('planning')).toBe('planning')
    expect(normalizeStage('execution')).toBe('execution')
    expect(normalizeStage('public')).toBe('public')
    expect(normalizeStage('completed')).toBe('completed')
  })

  it('maps the legacy "research" phase onto execution', () => {
    expect(normalizeStage('research')).toBe('execution')
  })

  it('defaults unknown / empty phases to planning', () => {
    expect(normalizeStage(null)).toBe('planning')
    expect(normalizeStage(undefined)).toBe('planning')
    expect(normalizeStage('')).toBe('planning')
    expect(normalizeStage('something-else')).toBe('planning')
  })

  it('has metadata for every stage in order', () => {
    expect(STAGE_ORDER).toEqual(['idea', 'planning', 'execution', 'public', 'completed'])
    for (const stage of STAGE_ORDER) {
      const meta = STAGE_META[stage as InitiativeStage]
      expect(meta.label).toBeTruthy()
      expect(meta.color).toContain('bg-')
      expect(meta.description).toBeTruthy()
    }
  })
})
