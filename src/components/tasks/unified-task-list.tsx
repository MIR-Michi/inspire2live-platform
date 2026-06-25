import Link from 'next/link'
import { UnifiedTaskStatusControl } from '@/components/tasks/unified-task-status-control'
import { UNIFIED_STATUS_META } from '@/lib/comms-status'
import type { TaskContextKind, UnifiedTask } from '@/lib/tasks/types'

const CONTEXT_LABEL: Record<TaskContextKind, string> = {
  initiative: 'Initiative',
  campus_session: 'Campus',
  agenda_item: 'Agenda',
  onboarding_member: 'Onboarding',
  standalone: 'Task',
}

const CONTEXT_CHIP: Record<TaskContextKind, string> = {
  initiative: 'bg-emerald-50 text-emerald-700',
  campus_session: 'bg-blue-50 text-blue-700',
  agenda_item: 'bg-violet-50 text-violet-700',
  onboarding_member: 'bg-amber-50 text-amber-700',
  standalone: 'bg-neutral-100 text-neutral-600',
}

function formatShortDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function isOverdue(task: UnifiedTask, todayKey: string) {
  return Boolean(
    task.dueDate && task.dueDate < todayKey && task.status !== 'completed' && task.status !== 'skipped'
  )
}

/**
 * Renders a flat list of unified tasks. Comms/onboarding tasks get an inline
 * status control; initiative tasks show a read-only status badge and deep-link
 * to their workspace (where the richer workflow lives). See ADR-0008.
 */
export function UnifiedTaskList({ tasks, emptyLabel = 'No tasks assigned to you yet.' }: { tasks: UnifiedTask[]; emptyLabel?: string }) {
  const todayKey = new Date().toISOString().slice(0, 10)

  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const overdue = isOverdue(task, todayKey)
        const due = formatShortDate(task.dueDate)
        const contextLabel = task.context.label
          ? `${CONTEXT_LABEL[task.context.kind]} · ${task.context.label}`
          : CONTEXT_LABEL[task.context.kind]

        return (
          <div
            key={`${task.source}-${task.id}`}
            className={[
              'flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2',
              overdue ? 'border-red-200 bg-red-50' : 'border-neutral-200',
            ].join(' ')}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONTEXT_CHIP[task.context.kind]}`}>
                  {contextLabel}
                </span>
                {overdue && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    Overdue
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-neutral-900">{task.title}</p>
              {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{task.description}</p>}
              {due && (
                <p className={`mt-1 text-xs ${overdue ? 'font-semibold text-red-700' : 'text-neutral-500'}`}>Due {due}</p>
              )}
            </div>

            {task.editable ? (
              <UnifiedTaskStatusControl source={task.source} taskId={task.id} status={task.status} />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${UNIFIED_STATUS_META[task.status].badgeClass}`}
                >
                  {UNIFIED_STATUS_META[task.status].label}
                </span>
                {task.context.href && (
                  <Link href={task.context.href} className="text-[11px] font-semibold text-orange-700 hover:underline">
                    Open
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
