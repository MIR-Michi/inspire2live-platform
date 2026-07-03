'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCampusChecklistTask,
  deleteCampusChecklistTask,
  seedCampusChecklist,
  updateCampusChecklistTask,
} from '@/app/app/comms/campus-log/actions'
import { UNIFIED_STATUS_ORDER, UNIFIED_STATUS_META } from '@/lib/comms-status'
import { ConfettiBurst } from '@/components/ui/confetti-burst'
import type { CommsTaskRecord } from '@/lib/comms-tasks'
import type { TeamMemberOption } from '@/lib/comms-dashboard-data'

/**
 * The editable checklist for a monthly campus meeting. Each task is a comms_task
 * tied to the campus session (so it also appears on its owner's personal
 * dashboard). Owners, titles, due dates and status are editable; tasks can be
 * added or deleted. An empty session can be seeded with the standard template.
 */
export function CampusMeetingChecklist({
  sessionId,
  year,
  month,
  tasks,
  teamMembers,
}: {
  sessionId: string
  year: string
  month: string
  tasks: CommsTaskRecord[]
  teamMembers: TeamMemberOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [newDue, setNewDue] = useState('')
  // Transient animation state: which row is "popping", and a counter to fire
  // confetti when the last open task gets completed.
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const [fireKey, setFireKey] = useState(0)

  const isClosed = (status: string) => status === 'completed' || status === 'skipped'

  const changeStatus = (task: CommsTaskRecord, value: string) => {
    if (value === 'completed' && task.status !== 'completed') {
      setPoppingId(task.id)
      window.setTimeout(() => setPoppingId((id) => (id === task.id ? null : id)), 450)
      // Celebrate when this completion clears the last open task.
      const everyOtherClosed = tasks.every((t) => t.id === task.id || isClosed(t.status))
      if (everyOtherClosed) setFireKey((k) => k + 1)
    }
    run(updateCampusChecklistTask, { task_id: task.id, status: value })
  }

  const withContext = (fields: Record<string, string>) => {
    const fd = new FormData()
    fd.set('session_id', sessionId)
    fd.set('year', year)
    fd.set('month', month)
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }

  const run = (
    action: (fd: FormData) => Promise<{ ok: boolean; message?: string }>,
    fields: Record<string, string>,
    onDone?: () => void
  ) => {
    setError(null)
    startTransition(async () => {
      const result = await action(withContext(fields))
      if (!result.ok) {
        setError(result.message ?? 'Something went wrong.')
        return
      }
      onDone?.()
      router.refresh()
    })
  }

  const seed = () => run(seedCampusChecklist, {})
  const addTask = () => {
    if (!newTitle.trim()) return
    run(
      createCampusChecklistTask,
      { title: newTitle.trim(), owner_id: newOwner, due_date: newDue },
      () => {
        setNewTitle('')
        setNewOwner('')
        setNewDue('')
        setAdding(false)
      }
    )
  }
  const saveTitle = (task: CommsTaskRecord) => {
    const title = editingTitle.trim()
    if (!title || title === task.title) {
      setEditingId(null)
      return
    }
    run(updateCampusChecklistTask, { task_id: task.id, title }, () => setEditingId(null))
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
          No meeting checklist yet.
        </p>
        <button
          type="button"
          onClick={seed}
          disabled={pending}
          className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? 'Setting up…' : 'Set up standard checklist'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative">
      <ConfettiBurst fireKey={fireKey} />
      <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
        {tasks.map((task, index) => (
          <li
            key={task.id}
            className="flex flex-wrap items-center gap-2 px-4 py-3 animate-fade-up"
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
          >
            {/* Status */}
            <select
              value={task.status}
              onChange={(e) => changeStatus(task, e.target.value)}
              disabled={pending}
              aria-label={`Status of ${task.title}`}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-transform focus:outline-none ${UNIFIED_STATUS_META[task.status].badgeClass} ${poppingId === task.id ? 'animate-check-pop' : ''}`}
            >
              {UNIFIED_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {UNIFIED_STATUS_META[s].label}
                </option>
              ))}
            </select>

            {/* Title (click to edit) */}
            {editingId === task.id ? (
              <input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => saveTitle(task)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle(task)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-blue-300 px-2 py-1 text-sm focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(task.id)
                  setEditingTitle(task.title)
                }}
                className={`min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors hover:text-blue-800 ${task.status === 'completed' ? 'text-neutral-400' : 'text-neutral-900'}`}
                title="Click to edit"
              >
                <span className="strike-sweep" data-struck={task.status === 'completed'}>
                  {task.title}
                </span>
              </button>
            )}

            {/* Due date */}
            <input
              type="date"
              defaultValue={task.dueDate ?? ''}
              onChange={(e) => run(updateCampusChecklistTask, { task_id: task.id, due_date: e.target.value })}
              disabled={pending}
              aria-label={`Due date of ${task.title}`}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs text-neutral-700 focus:outline-none"
            />

            {/* Owner */}
            <select
              value={task.ownerId ?? ''}
              onChange={(e) =>
                run(updateCampusChecklistTask, { task_id: task.id, task_title: task.title, owner_id: e.target.value })
              }
              disabled={pending}
              aria-label={`Owner of ${task.title}`}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-800 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>

            {/* Delete */}
            <button
              type="button"
              onClick={() => run(deleteCampusChecklistTask, { task_id: task.id })}
              disabled={pending}
              aria-label={`Delete ${task.title}`}
              className="text-neutral-300 hover:text-red-500 disabled:opacity-40"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-neutral-200 px-4 py-3">
        {adding ? (
          <div className="space-y-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask()
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="New task title…"
              autoFocus
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={addTask}
                disabled={pending || !newTitle.trim()}
                className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                Add task
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-semibold text-blue-800 hover:text-blue-900"
          >
            + New task
          </button>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
