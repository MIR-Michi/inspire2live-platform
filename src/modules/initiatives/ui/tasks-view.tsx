'use client'

import { useState } from 'react'

export type TaskRow = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  assignee: string
  assignee_id?: string
  isOverdue: boolean
  isDueThisWeek: boolean
}

const priorityStyle: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-neutral-100 text-neutral-600',
}

const statusStyle: Record<string, string> = {
  todo: 'border-neutral-300 text-neutral-600 bg-white',
  in_progress: 'border-blue-300 text-blue-700 bg-blue-50',
  review: 'border-purple-300 text-purple-700 bg-purple-50',
  blocked: 'border-red-300 text-red-700 bg-red-50',
  done: 'border-emerald-300 text-emerald-700 bg-emerald-50',
}

const statusLabel: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
}

type FilterKey = 'all' | 'blocked' | 'overdue' | 'unassigned' | 'due_this_week'
type GroupKey = 'status' | 'assignee'

const STATUS_ORDER = ['blocked', 'in_progress', 'review', 'todo', 'done']

function TaskCard({ t }: { t: TaskRow }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm hover:border-orange-200 transition-colors">
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${priorityStyle[t.priority] ?? priorityStyle.medium}`}
      >
        {t.priority}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 truncate">{t.title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {t.assignee !== 'Unassigned' ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-700">
                {t.assignee.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              {t.assignee}
            </span>
          ) : (
            <span className="italic text-neutral-400">Unassigned</span>
          )}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle[t.status] ?? statusStyle.todo}`}
      >
        {statusLabel[t.status] ?? t.status}
      </span>
      {t.due_date && (
        <span
          className={`shrink-0 text-xs ${t.isOverdue ? 'font-semibold text-red-600' : t.isDueThisWeek ? 'font-medium text-amber-600' : 'text-neutral-500'}`}
        >
          {t.isOverdue ? '⚠ ' : t.isDueThisWeek ? '⏰ ' : ''}
          {new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  )
}

export function TasksView({
  tasks,
  initiativeId,
}: {
  tasks: TaskRow[]
  initiativeId: string
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [groupBy, setGroupBy] = useState<GroupKey>('status')

  // Counts for filter chips
  const counts = {
    all: tasks.length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    overdue: tasks.filter((t) => t.isOverdue).length,
    unassigned: tasks.filter((t) => t.assignee === 'Unassigned').length,
    due_this_week: tasks.filter((t) => t.isDueThisWeek && !t.isOverdue).length,
  }

  // Apply filter
  const filtered = tasks.filter((t) => {
    if (filter === 'blocked') return t.status === 'blocked'
    if (filter === 'overdue') return t.isOverdue
    if (filter === 'unassigned') return t.assignee === 'Unassigned'
    if (filter === 'due_this_week') return t.isDueThisWeek && !t.isOverdue
    return true
  })

  // Group
  let groups: { label: string; tasks: TaskRow[] }[] = []

  if (groupBy === 'status') {
    for (const status of STATUS_ORDER) {
      const group = filtered.filter((t) => t.status === status)
      if (group.length > 0) {
        groups.push({ label: statusLabel[status] ?? status, tasks: group })
      }
    }
  } else {
    // Group by assignee
    const assigneeMap = new Map<string, TaskRow[]>()
    for (const t of filtered) {
      if (!assigneeMap.has(t.assignee)) assigneeMap.set(t.assignee, [])
      assigneeMap.get(t.assignee)!.push(t)
    }
    // Sort: most tasks first, Unassigned last
    const sorted = [...assigneeMap.entries()].sort(([aName, aTasks], [bName, bTasks]) => {
      if (aName === 'Unassigned') return 1
      if (bName === 'Unassigned') return -1
      return bTasks.length - aTasks.length
    })
    groups = sorted.map(([label, tasks]) => ({ label, tasks }))
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'blocked', label: '⛔ Blocked' },
    { key: 'overdue', label: '⚠ Overdue' },
    { key: 'due_this_week', label: '⏰ Due this week' },
    { key: 'unassigned', label: 'Unassigned' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ key, label }) => {
          const count = counts[key]
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              disabled={count === 0 && key !== 'all'}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? 'border-orange-400 bg-orange-100 text-orange-800'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-orange-200 text-orange-800' : 'bg-neutral-100 text-neutral-500'}`}
              >
                {count}
              </span>
            </button>
          )
        })}

        {/* Group toggle */}
        <div className="ml-auto flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          <button
            onClick={() => setGroupBy('status')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${groupBy === 'status' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            By Status
          </button>
          <button
            onClick={() => setGroupBy('assignee')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${groupBy === 'assignee' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            By Assignee
          </button>
        </div>
      </div>

      {/* Task groups */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-400">
          No tasks match the current filter.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ label, tasks: groupTasks }) => (
            <div key={label}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {label}
                </h3>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                  {groupTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {groupTasks.map((t) => (
                  <TaskCard key={t.id} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden initiativeId to keep lint happy */}
      <input type="hidden" value={initiativeId} />
    </div>
  )
}
