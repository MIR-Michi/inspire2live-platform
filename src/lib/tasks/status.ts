/**
 * lib/tasks/status.ts
 *
 * One canonical task-status vocabulary (the comms set) and the per-source
 * normalizers that map each table's raw status onto it. See ADR-0008.
 *
 * Comms and onboarding tasks store the canonical vocabulary natively.
 * Initiative tasks use a richer workflow (todo/in_progress/review/done/blocked)
 * that we fold into the four canonical states for shared surfaces.
 */

import type { UnifiedStatus } from '@/lib/comms-status'
import type { TaskSource } from '@/lib/tasks/types'

const CANONICAL = new Set<UnifiedStatus>(['not_started', 'in_progress', 'completed', 'skipped'])

export function normalizeUnifiedTaskStatus(
  source: TaskSource,
  raw: string | null | undefined
): UnifiedStatus {
  if (source === 'comms' || source === 'onboarding') {
    return raw && CANONICAL.has(raw as UnifiedStatus) ? (raw as UnifiedStatus) : 'not_started'
  }

  // Initiative vocabulary (+ a few legacy values seen across the codebase).
  switch (raw) {
    case 'done':
      return 'completed'
    case 'cancelled':
    case 'archived':
      return 'skipped'
    case 'in_progress':
    case 'review':
    case 'blocked':
      return 'in_progress'
    default:
      // todo / open / backlog / null
      return 'not_started'
  }
}

/** A task that still needs attention (not finished or explicitly skipped). */
export function isTaskOpen(status: UnifiedStatus): boolean {
  return status !== 'completed' && status !== 'skipped'
}
