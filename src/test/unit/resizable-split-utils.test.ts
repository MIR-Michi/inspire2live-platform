import { describe, expect, it } from 'vitest'
import {
  clampRatio,
  columnsTemplate,
  parseStoredRatio,
  ratioFromPointer,
  roundRatio,
  stepRatio,
  storageKeyFor,
} from '@/components/ui/resizable-split-utils'

describe('clampRatio', () => {
  it('clamps into [min, max]', () => {
    expect(clampRatio(0.5, 0.2, 0.8)).toBe(0.5)
    expect(clampRatio(0.05, 0.2, 0.8)).toBe(0.2)
    expect(clampRatio(0.95, 0.2, 0.8)).toBe(0.8)
  })
  it('falls back to the midpoint for non-finite input', () => {
    expect(clampRatio(Number.NaN, 0.2, 0.8)).toBe(0.5)
    expect(clampRatio(Infinity, 0.3, 0.7)).toBe(0.5)
  })
})

describe('columnsTemplate', () => {
  it('produces a shrinkable three-track grid template', () => {
    expect(columnsTemplate(0.66, 12, 0.2, 0.8)).toBe('minmax(0, 0.66fr) 12px minmax(0, 0.34fr)')
  })
  it('clamps the ratio before templating', () => {
    expect(columnsTemplate(0.95, 10, 0.2, 0.8)).toBe('minmax(0, 0.8fr) 10px minmax(0, 0.2fr)')
  })
})

describe('ratioFromPointer', () => {
  const rect = { left: 100, width: 1000 }
  it('maps pointer x to a clamped ratio', () => {
    expect(ratioFromPointer(600, rect, 0.2, 0.8)).toBeCloseTo(0.5)
    expect(ratioFromPointer(100, rect, 0.2, 0.8)).toBe(0.2) // far left → min
    expect(ratioFromPointer(1100, rect, 0.2, 0.8)).toBe(0.8) // far right → max
  })
  it('returns the midpoint for a zero-width container', () => {
    expect(ratioFromPointer(600, { left: 0, width: 0 }, 0.2, 0.8)).toBe(0.5)
  })
})

describe('stepRatio', () => {
  it('nudges and clamps', () => {
    expect(stepRatio(0.5, 0.02, 0.2, 0.8)).toBe(0.52)
    expect(stepRatio(0.79, 0.02, 0.2, 0.8)).toBe(0.8)
    expect(stepRatio(0.21, -0.02, 0.2, 0.8)).toBe(0.2)
  })
})

describe('parseStoredRatio', () => {
  it('parses valid, clamped numbers', () => {
    expect(parseStoredRatio('0.5', 0.2, 0.8)).toBe(0.5)
    expect(parseStoredRatio('0.95', 0.2, 0.8)).toBe(0.8)
  })
  it('rejects empty/non-numeric input', () => {
    expect(parseStoredRatio(null)).toBeNull()
    expect(parseStoredRatio('')).toBeNull()
    expect(parseStoredRatio('abc')).toBeNull()
  })
})

describe('roundRatio / storageKeyFor', () => {
  it('rounds to 4 decimals', () => {
    expect(roundRatio(0.123456)).toBe(0.1235)
  })
  it('namespaces the storage key', () => {
    expect(storageKeyFor('whatsapp')).toBe('i2l:split:whatsapp')
  })
})
