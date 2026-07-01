import { describe, expect, it } from 'vitest'
import { isTaskFinished, isTaskOpen } from '@/lib/tasks/status'

describe('task visibility helpers', () => {
  it('treats not started and in progress as active work', () => {
    expect(isTaskOpen('not_started')).toBe(true)
    expect(isTaskOpen('in_progress')).toBe(true)
    expect(isTaskFinished('not_started')).toBe(false)
    expect(isTaskFinished('in_progress')).toBe(false)
  })

  it('treats completed and skipped as finished work', () => {
    expect(isTaskOpen('completed')).toBe(false)
    expect(isTaskOpen('skipped')).toBe(false)
    expect(isTaskFinished('completed')).toBe(true)
    expect(isTaskFinished('skipped')).toBe(true)
  })
})
