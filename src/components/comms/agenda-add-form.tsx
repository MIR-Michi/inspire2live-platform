'use client'

import { useRef, useState } from 'react'
import { addAgendaItem } from '@/app/app/comms/dashboard/actions'

export function AgendaAddForm({ meetingDate }: { meetingDate: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-600 transition hover:border-orange-400 hover:text-orange-700"
      >
        + Add agenda item
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setPending(true)
        setError(null)
        try {
          await addAgendaItem(formData)
          formRef.current?.reset()
          setOpen(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not add the agenda item.')
        } finally {
          setPending(false)
        }
      }}
      className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
    >
      <input type="hidden" name="meeting_date" value={meetingDate} />
      <div>
        <label htmlFor="agenda-title" className="text-xs font-semibold text-neutral-600">
          Title
        </label>
        <input
          id="agenda-title"
          name="title"
          required
          maxLength={160}
          placeholder="What should we discuss?"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>
      <div>
        <label htmlFor="agenda-summary" className="text-xs font-semibold text-neutral-600">
          Short summary
        </label>
        <textarea
          id="agenda-summary"
          name="summary"
          rows={2}
          maxLength={400}
          placeholder="A sentence or two of context."
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>
      <p className="text-[11px] text-neutral-500">
        You&apos;ll be set as the owner and a task will appear on the dashboard.
      </p>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add item'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
