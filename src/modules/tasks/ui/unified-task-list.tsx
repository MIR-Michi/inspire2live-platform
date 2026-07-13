'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { UnifiedTaskStatusControl } from '@/components/tasks/unified-task-status-control'
import { updateTaskStatus } from '@/lib/tasks/actions'
import { UNIFIED_STATUS_META } from '@/lib/comms-status'
import { isTaskFinished, isTaskOpen } from '@/lib/tasks/status'
import type { TaskContextKind, UnifiedTask } from '@/lib/tasks/types'

const CONTEXT_LABEL: Record<TaskContextKind, string> = {
  initiative: 'Initiative',
  campus_session: 'Campus',
  agenda_item: 'Agenda',
  onboarding_member: 'Onboarding',
  whatsapp_topic: 'WhatsApp',
  standalone: 'Task',
}

const CONTEXT_CHIP: Record<TaskContextKind, string> = {
  initiative: 'bg-emerald-50 text-emerald-700',
  campus_session: 'bg-blue-50 text-blue-700',
  agenda_item: 'bg-violet-50 text-violet-700',
  onboarding_member: 'bg-amber-50 text-amber-700',
  whatsapp_topic: 'bg-orange-50 text-orange-700',
  standalone: 'bg-neutral-100 text-neutral-600',
}

function formatShortDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function isOverdue(task: UnifiedTask, todayKey: string) {
  return Boolean(task.dueDate && task.dueDate < todayKey && isTaskOpen(task.status))
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel
}

function RestoreTaskButton({ task }: { task: UnifiedTask }) {
  if (!task.editable || !isTaskFinished(task.status)) return null

  return (
    <form action={updateTaskStatus} className="inline-flex">
      <input type="hidden" name="source" value={task.source} />
      <input type="hidden" name="task_id" value={task.id} />
      <input type="hidden" name="status" value="in_progress" />
      <button
        type="submit"
        className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-100"
      >
        Restore
      </button>
    </form>
  )
}

/**
 * Renders a flat list of unified tasks. Finished tasks are hidden by default
 * but recoverable through the explicit Show finished mode. Comms/onboarding
 * tasks can be restored inline; initiative tasks stay read-only with a link.
 */
export function UnifiedTaskList({
  tasks,
  emptyLabel = 'No open tasks assigned to you right now.',
}: {
  tasks: UnifiedTask[]
  emptyLabel?: string
}) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const [showFinished, setShowFinished] = useState(false)

  const { visibleTasks, finishedCount, hiddenFinishedCount } = useMemo(() => {
    const finished = tasks.filter((task) => isTaskFinished(task.status))
    return {
      visibleTasks: showFinished ? tasks : tasks.filter((task) => isTaskOpen(task.status)),
      finishedCount: finished.length,
      hiddenFinishedCount: showFinished ? 0 : finished.length,
    }
  }, [showFinished, tasks])

  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {finishedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
          <span>
            {showFinished
              ? `${finishedCount} finished ${plural(finishedCount, 'task')} shown`
              : `${hiddenFinishedCount} finished ${plural(hiddenFinishedCount, 'task')} hidden`}
          </span>
          <button
            type="button"
            onClick={() => setShowFinished((value) => !value)}
            aria-pressed={showFinished}
            className="font-semibold text-orange-700 hover:underline"
          >
            {showFinished ? 'Hide finished' : 'Show finished'}
          </button>
        </div>
      )}

      {visibleTasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const overdue = isOverdue(task, todayKey)
            const due = formatShortDate(task.dueDate)
            const contextLabel = task.context.label
              ? `${CONTEXT_LABEL[task.context.kind]} - ${task.context.label}`
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
                    <p className={`mt-1 text-xs ${overdue ? 'font-semibold text-red-700' : 'text-neutral-500'}`}>
                      Due {due}
                    </p>
                  )}
                </div>

                {task.editable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <UnifiedTaskStatusControl source={task.source} taskId={task.id} status={task.status} />
                    <RestoreTaskButton task={task} />
                  </div>
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
      )}
    </div>
  )
}
