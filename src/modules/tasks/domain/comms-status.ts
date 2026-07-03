/**
 * lib/comms-status.ts
 *
 * Unified work-status taxonomy for the Communications team dashboard.
 *
 * The platform uses several status vocabularies (content calendar,
 * event stage, task status, agenda status). The team dashboard maps them
 * all onto ONE simple set the team shares:
 *
 *   Not started · In progress · Completed · Skipped
 *
 * This is a presentation layer only — it does not change the underlying
 * models. "Completed" and "Skipped" both correspond to a finished/archived
 * state and are distinguished visually (green tick vs amber dash).
 */

export type UnifiedStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export const UNIFIED_STATUS_ORDER: UnifiedStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
]

export const UNIFIED_STATUS_META: Record<
  UnifiedStatus,
  { label: string; marker: string; badgeClass: string; dotClass: string }
> = {
  not_started: {
    label: 'Not started',
    marker: '○',
    badgeClass: 'border-neutral-200 bg-neutral-50 text-neutral-600',
    dotClass: 'bg-neutral-400',
  },
  in_progress: {
    label: 'In progress',
    marker: '◐',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    dotClass: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    marker: '✓',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  skipped: {
    label: 'Skipped',
    marker: '–',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-400',
  },
}

/** Content calendar status → unified status. */
export function normalizeCalendarStatus(status: string | null | undefined): UnifiedStatus {
  switch (status) {
    case 'draft':
      return 'not_started'
    case 'in_review':
    case 'scheduled':
      return 'in_progress'
    case 'published':
      return 'completed'
    case 'archived':
      return 'skipped'
    default:
      return 'not_started'
  }
}

/** Event stage → unified status. */
export function normalizeEventStage(stage: string | null | undefined): UnifiedStatus {
  switch (stage) {
    case 'announced':
      return 'not_started'
    case 'attending':
    case 'in_progress':
      return 'in_progress'
    case 'post_event':
      return 'completed'
    case 'archived':
      return 'skipped'
    default:
      return 'not_started'
  }
}

/** Task status → unified status. */
export function normalizeTaskStatus(status: string | null | undefined): UnifiedStatus {
  switch (status) {
    case 'done':
      return 'completed'
    case 'cancelled':
    case 'archived':
      return 'skipped'
    case 'in_progress':
      return 'in_progress'
    case 'todo':
    case 'open':
    case 'backlog':
      return 'not_started'
    default:
      return status === 'done' ? 'completed' : 'not_started'
  }
}

/** Agenda item status is already stored in the unified vocabulary. */
export function normalizeAgendaStatus(status: string | null | undefined): UnifiedStatus {
  if (status === 'in_progress' || status === 'completed' || status === 'skipped') return status
  return 'not_started'
}

export function getUnifiedStatusMeta(status: UnifiedStatus) {
  return UNIFIED_STATUS_META[status]
}
