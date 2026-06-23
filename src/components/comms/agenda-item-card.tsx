'use client'

import { useRef, useState } from 'react'
import { deleteAgendaItem, updateAgendaItem } from '@/app/app/comms/dashboard/actions'
import { getRoleLabel } from '@/lib/role-access'
import { TaskDetailsButton } from '@/components/comms/task-details-button'
import type { AgendaItemRecord } from '@/lib/comms-agenda'

function ownerInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}

/** Owner avatar; the name (and role) appear on hover only. */
function OwnerAvatar({ item }: { item: AgendaItemRecord }) {
  if (!item.ownerLabel) return null
  const roleLabel = item.ownerRole ? getRoleLabel(item.ownerRole) : null
  const tooltip = roleLabel ? `${item.ownerLabel} · ${roleLabel}` : item.ownerLabel

  return (
    <span className="group relative inline-flex shrink-0">
      {item.ownerAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.ownerAvatarUrl}
          alt=""
          title={tooltip}
          className="h-6 w-6 rounded-full border border-neutral-200 object-cover"
        />
      ) : (
        <span
          title={tooltip}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-semibold text-white"
        >
          {ownerInitials(item.ownerLabel)}
        </span>
      )}
      {/* Styled tooltip on hover (in addition to the native title). */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
        {tooltip}
      </span>
    </span>
  )
}

export function AgendaItemCard({ item, dragHandle }: { item: AgendaItemRecord; dragHandle?: React.ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-600">Meeting notes</span>
          <textarea
            name="meeting_notes"
            rows={3}
            maxLength={4000}
            defaultValue={item.meetingNotes ?? ''}
            placeholder="Notes captured during the meeting on this topic."
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
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {dragHandle}
          <OwnerAvatar item={item} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-900">{item.title}</p>
            {item.summary && <p className="mt-0.5 text-xs text-neutral-600">{item.summary}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            Edit
          </button>
          <form
            action={async (formData) => {
              if (!confirm(`Delete agenda topic "${item.title}"?`)) return
              setDeleting(true)
              setError(null)
              try {
                await deleteAgendaItem(formData)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete the agenda item.')
              } finally {
                setDeleting(false)
              }
            }}
          >
            <input type="hidden" name="agenda_item_id" value={item.id} />
            <button
              type="submit"
              disabled={deleting}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}

      {item.meetingNotes && (
        <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Meeting notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-neutral-700">{item.meetingNotes}</p>
        </div>
      )}

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
