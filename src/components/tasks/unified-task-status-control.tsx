'use client'

import { updateTaskStatus } from '@/lib/tasks/actions'
import { UNIFIED_STATUS_ORDER, UNIFIED_STATUS_META, type UnifiedStatus } from '@/lib/comms-status'
import type { TaskSource } from '@/lib/tasks/types'

/**
 * Status control for a unified task. Posts the task's `source` so the unified
 * action can route to the right table. Only used for editable sources
 * (comms / onboarding); initiative tasks render a read-only badge instead.
 */
export function UnifiedTaskStatusControl({
  source,
  taskId,
  status,
}: {
  source: TaskSource
  taskId: string
  status: UnifiedStatus
}) {
  return (
    <form action={updateTaskStatus} className="inline-flex">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="task_id" value={taskId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Update task status"
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${UNIFIED_STATUS_META[status].badgeClass}`}
      >
        {UNIFIED_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {UNIFIED_STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  )
}
