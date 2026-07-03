// ─── Task Helpers ─────────────────────────────────────────────────────────────

export const TASK_STATUS_ORDER = ['todo', 'in_progress', 'review', 'blocked', 'done'] as const

export type TaskStatus = (typeof TASK_STATUS_ORDER)[number]

export type WorkspaceTask = {
  id: string
  title: string
  status: string
  priority: string
  assignee_id: string
  due_date: string | null
}

export function groupTasksByStatus(tasks: WorkspaceTask[]) {
  const grouped: Record<TaskStatus, WorkspaceTask[]> = {
    todo: [],
    in_progress: [],
    review: [],
    blocked: [],
    done: [],
  }
  tasks.forEach((task) => {
    const status = task.status as TaskStatus
    if (grouped[status]) grouped[status].push(task)
  })
  return grouped
}

export function canManageInitiativeWorkspace(
  platformRole?: string | null,
  memberRole?: string | null,
) {
  return (
    platformRole === 'HubCoordinator' ||
    platformRole === 'PlatformAdmin' ||
    memberRole === 'lead'
  )
}

export function priorityTone(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700'
    case 'high':
      return 'bg-orange-100 text-orange-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
}

export function taskStatusStyle(status: string): string {
  switch (status) {
    case 'done':
      return 'bg-emerald-100 text-emerald-700'
    case 'in_progress':
      return 'bg-blue-100 text-blue-700'
    case 'review':
      return 'bg-violet-100 text-violet-700'
    case 'blocked':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-neutral-100 text-neutral-600'
  }
}

// ─── Milestone Helpers ────────────────────────────────────────────────────────

export function milestoneStatusConfig(status: string): {
  dot: string
  badge: string
  label: string
} {
  switch (status) {
    case 'completed':
      return {
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700',
        label: 'Completed',
      }
    case 'in_progress':
      return {
        dot: 'bg-blue-500',
        badge: 'bg-blue-100 text-blue-700',
        label: 'In Progress',
      }
    case 'overdue':
      return {
        dot: 'bg-red-500',
        badge: 'bg-red-100 text-red-700',
        label: 'Overdue',
      }
    default:
      return {
        dot: 'bg-neutral-300',
        badge: 'bg-neutral-100 text-neutral-600',
        label: 'Upcoming',
      }
  }
}

// ─── Discussion Helpers ────────────────────────────────────────────────────────

export function threadTypeConfig(type: string): { label: string; style: string } {
  switch (type) {
    case 'decision':
      return { label: 'Decision', style: 'bg-blue-100 text-blue-700' }
    case 'question':
      return { label: 'Question', style: 'bg-amber-100 text-amber-700' }
    case 'blocker':
      return { label: 'Blocker', style: 'bg-red-100 text-red-700' }
    case 'idea':
      return { label: 'Idea', style: 'bg-violet-100 text-violet-700' }
    default:
      return { label: 'General', style: 'bg-neutral-100 text-neutral-600' }
  }
}

// ─── Evidence / Resource Helpers ─────────────────────────────────────────────

export function translationBadge(status: string): { label: string; style: string } {
  switch (status) {
    case 'translated':
      return { label: 'Translated', style: 'bg-emerald-100 text-emerald-700' }
    case 'needs_translation':
      return { label: 'Needs Translation', style: 'bg-amber-100 text-amber-700' }
    default:
      return { label: 'Original', style: 'bg-neutral-100 text-neutral-600' }
  }
}

export function resourceTypeIcon(type: string): string {
  switch (type) {
    case 'document':
      return '📄'
    case 'data':
      return '📊'
    case 'recording':
      return '🎥'
    case 'template':
      return '📋'
    case 'report':
      return '📑'
    case 'link':
      return '🔗'
    default:
      return '📎'
  }
}

// ─── Team / Member Helpers ────────────────────────────────────────────────────

export function memberRoleStyle(role: string): string {
  switch (role) {
    case 'lead':
      return 'bg-primary-100 text-primary-700'
    case 'reviewer':
      return 'bg-violet-100 text-violet-700'
    case 'partner':
      return 'bg-orange-100 text-orange-700'
    default:
      return 'bg-neutral-100 text-neutral-600'
  }
}

export function memberRoleLabel(role: string): string {
  switch (role) {
    case 'lead':
      return 'Lead'
    case 'reviewer':
      return 'Reviewer'
    case 'partner':
      return 'Partner'
    default:
      return 'Contributor'
  }
}

export function activityLevel(
  lastActiveAt: string | null | undefined,
): 'active' | 'recent' | 'inactive' {
  if (!lastActiveAt) return 'inactive'
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24),
  )
  if (daysAgo <= 7) return 'active'
  if (daysAgo <= 14) return 'recent'
  return 'inactive'
}

export function activityDotStyle(level: 'active' | 'recent' | 'inactive'): string {
  switch (level) {
    case 'active':
      return 'bg-emerald-500'
    case 'recent':
      return 'bg-amber-400'
    default:
      return 'bg-neutral-300'
  }
}
