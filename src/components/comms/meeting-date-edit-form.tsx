'use client'

import { useRef, useState } from 'react'
import { updateMeetingDate } from '@/app/app/comms/dashboard/actions'

/**
 * Inline control to move a whole meeting to a different date. A meeting is
 * identified by its `meeting_date`, so saving rewrites the date on every agenda
 * item (and any transcript) that belongs to it. Works for both the upcoming and
 * previous meetings.
 */
export function MeetingDateEditForm({ meetingDate }: { meetingDate: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-orange-700"
        title="Change the meeting date"
      >
        📅 Edit date
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
          await updateMeetingDate(formData)
          setOpen(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not update the meeting date.')
        } finally {
          setPending(false)
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="current_meeting_date" value={meetingDate} />
      <input
        type="date"
        name="meeting_date"
        required
        defaultValue={meetingDate}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false)
          setError(null)
        }}
        className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
    </form>
  )
}
