/**
 * lib/tasks/types.ts
 *
 * The single task type the application works with, regardless of which
 * storage table a task actually lives in. See ADR-0008.
 */

import type { UnifiedStatus } from '@/lib/comms-status'

export type TaskSource = 'initiative' | 'comms' | 'onboarding'

export type TaskContextKind =
  | 'initiative'
  | 'campus_session'
  | 'agenda_item'
  | 'onboarding_member'
  | 'standalone'

export type TaskContext = {
  kind: TaskContextKind
  id: string | null
  /** Human label for the context (initiative title, member name, …). */
  label: string | null
  /** Where to go to act on the task in its native surface. */
  href: string | null
}

export type UnifiedTask = {
  source: TaskSource
  id: string
  title: string
  description: string | null
  ownerId: string | null
  ownerLabel: string | null
  /** Canonical status (mapped from the source vocabulary). */
  status: UnifiedStatus
  /** The raw status as stored in the source table (for round-tripping/debug). */
  rawStatus: string
  dueDate: string | null
  priority: string | null
  position: number | null
  context: TaskContext
  /**
   * Whether status/owner can be changed from a shared/aggregated surface.
   * Comms and onboarding tasks are interactive everywhere; initiative tasks
   * are edited in the initiative workspace and shown read-only elsewhere.
   */
  editable: boolean
}
