'use client'

import { useRef, useState } from 'react'
import { createCommsTask } from '@/app/app/comms/dashboard/actions'
import type { AgendaItemOption, TeamMemberOption } from '@/lib/comms-dashboard-data'

function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00Z`))
}

export function TaskCreateForm({
  teamMembers,
  agendaItems,
}: {
  teamMembers: TeamMemberOption[]
  agendaItems: AgendaItemOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
      >
        <span className="text-base leading-none">+</span> New task
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">New task</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              ref={formRef}
              action={async (formData) => {
                setPending(true)
                setError(null)
                try {
                  await createCommsTask(formData)
                  formRef.current?.reset()
                  setOpen(false)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not create the task.')
                } finally {
                  setPending(false)
                }
              }}
              className="space-y-4"
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-neutral-800">Title</span>
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="What needs to be done?"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-neutral-800">
                  Description <span className="font-normal text-neutral-400">(optional)</span>
                </span>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={1000}
                  placeholder="Add any context or details."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-800">Owner</span>
                  <select
                    name="owner_id"
                    defaultValue=""
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                  >
                    <option value="">Me</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-neutral-800">
                    Deadline <span className="font-normal text-neutral-400">(optional)</span>
                  </span>
                  <input
                    name="due_date"
                    type="date"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-neutral-800">
                  Agenda item <span className="font-normal text-neutral-400">(optional)</span>
                </span>
                <select
                  name="agenda_item_id"
                  defaultValue=""
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                >
                  <option value="">No agenda link</option>
                  {agendaItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} · {formatAgendaDate(item.meetingDate)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-neutral-500">
                  Linked tasks appear as red or green action items on the selected agenda topic.
                </span>
              </label>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {pending ? 'Creating…' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
