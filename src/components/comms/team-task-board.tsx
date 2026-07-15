'use client'

import { useMemo, useState } from 'react'
import { UnifiedTaskList } from '@/components/tasks/unified-task-list'
import type { TaskContextKind, UnifiedTask } from '@/lib/tasks/types'

/** Human labels for the task "type" filter (mirrors the list's context chips). */
const TYPE_LABEL: Record<TaskContextKind, string> = {
  initiative: 'Initiative',
  campus_session: 'Campus',
  agenda_item: 'Agenda',
  onboarding_member: 'Onboarding',
  whatsapp_topic: 'WhatsApp',
  standalone: 'Task',
}

type DateFilter = 'all' | 'overdue' | 'week' | 'later' | 'undated'

const DATE_OPTIONS: Array<{ key: DateFilter; label: string }> = [
  { key: 'all', label: 'Any date' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week', label: 'Due this week' },
  { key: 'later', label: 'Due later' },
  { key: 'undated', label: 'No date' },
]

const selectClass =
  'rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500'

/**
 * The team task board: every open task the viewer can read across all owners,
 * filterable by person (owner), type (context kind), and due date. Client-side
 * filtering over the already-loaded list — no extra round-trips.
 */
export function TeamTaskBoard({ tasks }: { tasks: UnifiedTask[] }) {
  const [person, setPerson] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  // Computed at render top (matches UnifiedTaskList's `new Date()` usage).
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const weekEnd = new Date(today)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  const weekKey = weekEnd.toISOString().slice(0, 10)

  // Distinct owners and types actually present in the tasks, for the dropdowns.
  const owners = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) if (t.ownerId) map.set(t.ownerId, t.ownerLabel ?? 'Unknown')
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [tasks])

  const types = useMemo(() => {
    const present = new Set<TaskContextKind>()
    for (const t of tasks) present.add(t.context.kind)
    return Array.from(present).sort((a, b) => TYPE_LABEL[a].localeCompare(TYPE_LABEL[b]))
  }, [tasks])

  // Plain render-time filter (not memoised): the date keys are impure reads, so
  // they must not feed a hook dependency — same pattern as UnifiedTaskList.
  const filtered = tasks.filter((t) => {
    if (person !== 'all' && t.ownerId !== person) return false
    if (type !== 'all' && t.context.kind !== type) return false
    switch (dateFilter) {
      case 'overdue':
        return Boolean(t.dueDate && t.dueDate < todayKey)
      case 'week':
        return Boolean(t.dueDate && t.dueDate >= todayKey && t.dueDate <= weekKey)
      case 'later':
        return Boolean(t.dueDate && t.dueDate > weekKey)
      case 'undated':
        return !t.dueDate
      default:
        return true
    }
  })

  const anyFilter = person !== 'all' || type !== 'all' || dateFilter !== 'all'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by person" value={person} onChange={(e) => setPerson(e.target.value)} className={selectClass}>
          <option value="all">Everyone</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>

        <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="all">All types</option>
          {types.map((k) => (
            <option key={k} value={k}>{TYPE_LABEL[k]}</option>
          ))}
        </select>

        <select aria-label="Filter by date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className={selectClass}>
          {DATE_OPTIONS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-neutral-500">
          {filtered.length} of {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </span>

        {anyFilter && (
          <button
            type="button"
            onClick={() => { setPerson('all'); setType('all'); setDateFilter('all') }}
            className="text-xs font-semibold text-orange-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <UnifiedTaskList
        tasks={filtered}
        showOwner
        emptyLabel={anyFilter ? 'No tasks match these filters.' : 'No open team tasks right now.'}
      />
    </div>
  )
}
