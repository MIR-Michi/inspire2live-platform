/**
 * lib/comms-tasks.ts
 *
 * Types for communications tasks. A task has a title, description, a specific
 * owner, a deadline, and a completion status. Tasks may optionally be linked to
 * a weekly agenda item as follow-up action items.
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
  agendaItemId: string | null
  agendaItemTitle: string | null
}

export function normalizeCommsTaskStatus(value: string | null | undefined): UnifiedStatus {
  if (value === 'in_progress' || value === 'completed' || value === 'skipped') return value
  return 'not_started'
}

export function isCommsTaskCompleted(status: UnifiedStatus) {
  return status === 'completed'
}
