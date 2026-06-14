/**
 * lib/comms-tasks.ts
 *
 * Types for standalone communications team tasks. A task has a title,
 * description, an owner, a deadline, and a completion status (the shared
 * unified vocabulary). Created on the team dashboard and surfaced on the
 * owner's personal dashboard.
 */

import type { UnifiedStatus } from '@/lib/comms-status'

export type CommsTaskRecord = {
  id: string
  title: string
  description: string | null
  ownerId: string | null
  ownerLabel: string | null
  ownerRole: string | null
  dueDate: string | null
  status: UnifiedStatus
}

export function normalizeCommsTaskStatus(value: string | null | undefined): UnifiedStatus {
  if (value === 'in_progress' || value === 'completed' || value === 'skipped') return value
  return 'not_started'
}
