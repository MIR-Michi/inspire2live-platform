'use client'

import { useRef, useState } from 'react'
import { updateAgendaItem } from '@/app/app/comms/dashboard/actions'
import { RoleBadge } from '@/components/comms/role-badge'
import { TaskDetailsButton } from '@/components/comms/task-details-button'
import type { AgendaItemRecord } from '@/lib/comms-agenda'

export function AgendaItemCard({ item }: { item: AgendaItemRecord }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (editing) {
    return (
      <form
        ref={formRef}
        action={async (formData) => {
          setPending(true)
          setError(null)
          try {
            await updateAgendaItem(formData)
            setEditing(false)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update the agenda item.')
          } finally {
            setPending(false)
          }
        }}
        className="space-y-2 rounded-xl border border-orange-200 bg-white px-3 py-2.5"
      >
        <input type="hidden" name="agenda_item_id" value={item.id} />
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-600">Title</span>
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={item.title}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-600">Short summary</span>
          <textarea
            name="summary"
            rows={2}
            maxLength={400}
            defaultValue={item.summary ?? ''}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setError(null)
              formRef.current?.reset()
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">{item.title}</p>
          {item.summary && <p className="mt-0.5 text-xs text-neutral-600">{item.summary}</p>}
          {item.ownerLabel && (
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
              {item.ownerLabel}
              <RoleBadge role={item.ownerRole} />
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          Edit
        </button>
      </div>

      {item.linkedTasks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.linkedTasks.map((task) => (
            <TaskDetailsButton key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
