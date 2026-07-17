'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { updateTaskStatus } from '@/lib/tasks/actions'
import { UNIFIED_STATUS_ORDER, UNIFIED_STATUS_META, type UnifiedStatus } from '@/lib/comms-status'
import type { TaskSource } from '@/lib/tasks/types'
import { announceTaskCompletion } from '@/kernel/ui/task-celebration-host'

/**
 * Unified editable task status control. Completion feedback fires only after a
 * deliberate user change has persisted successfully; initial render, imports,
 * background reconciliation and bulk updates never trigger celebration.
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
  const [current, setCurrent] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => setCurrent(status), [status])

  const change = (next: UnifiedStatus) => {
    const previous = current
    setCurrent(next)
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set('source', source)
    formData.set('task_id', taskId)
    formData.set('status', next)

    startTransition(async () => {
      try {
        await updateTaskStatus(formData)
        setSuccess(true)
        if (next === 'completed' && previous !== 'completed') {
          announceTaskCompletion(selectRef.current)
        }
        window.setTimeout(() => setSuccess(false), 900)
      } catch (cause) {
        setCurrent(previous)
        setError(cause instanceof Error ? cause.message : 'Could not update task status.')
      }
    })
  }

  return (
    <span className={['inline-flex flex-col items-end gap-1 transition', success ? 'scale-[1.03]' : ''].join(' ')}>
      <select
        ref={selectRef}
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value as UnifiedStatus)}
        aria-label="Update task status"
        aria-invalid={Boolean(error)}
        className={[
          'rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus:outline-none disabled:opacity-60',
          UNIFIED_STATUS_META[current].badgeClass,
          success ? 'ring-2 ring-emerald-300' : '',
        ].join(' ')}
      >
        {UNIFIED_STATUS_ORDER.map((item) => (
          <option key={item} value={item}>{UNIFIED_STATUS_META[item].label}</option>
        ))}
      </select>
      {error && <span className="max-w-48 text-right text-[10px] font-medium text-red-600" role="alert">{error}</span>}
    </span>
  )
}
