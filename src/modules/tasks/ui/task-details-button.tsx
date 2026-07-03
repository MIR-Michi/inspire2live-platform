'use client'

import { useState } from 'react'
import { RoleBadge } from '@/components/comms/role-badge'
import { TaskStatusControl } from '@/components/comms/task-status-control'
import { updateCommsTaskOwner } from '@/app/app/comms/dashboard/actions'
import { isCommsTaskCompleted, type CommsTaskRecord } from '@/lib/comms-tasks'

export type TaskOwnerOption = { id: string; label: string }

function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function TaskDetailsButton({
  task,
  ownerOptions = [],
}: {
  task: CommsTaskRecord
  ownerOptions?: TaskOwnerOption[]
}) {
  const [open, setOpen] = useState(false)
  const completed = isCommsTaskCompleted(task.status)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition',
          completed
            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        ].join(' ')}
        aria-label={`Open action item: ${task.title}`}
      >
        <span aria-hidden>{completed ? '✓' : '!'}</span>
        <span className="truncate">Action item</span>
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
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Action item</p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-900">{task.title}</h3>
              </div>
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

            <div className="space-y-4 text-sm">
              {task.description ? (
                <p className="rounded-lg bg-neutral-50 p-3 text-neutral-700">{task.description}</p>
              ) : (
                <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-neutral-400">No description.</p>
              )}

              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Owner</dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-neutral-800">
                    {ownerOptions.length > 0 ? (
                      <form action={updateCommsTaskOwner} className="inline-flex items-center gap-1.5">
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="task_title" value={task.title} />
                        <select
                          name="owner_id"
                          defaultValue={task.ownerId ?? ''}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          aria-label="Reassign task owner"
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-800 focus:outline-none"
                        >
                          {!task.ownerId && <option value="">Unassigned</option>}
                          {ownerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <RoleBadge role={task.ownerRole} />
                      </form>
                    ) : (
                      <>
                        {task.ownerLabel ?? 'Unassigned'}
                        <RoleBadge role={task.ownerRole} />
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Deadline</dt>
                  <dd className="mt-1 text-neutral-800">{formatDate(task.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</dt>
                  <dd className="mt-1">
                    <TaskStatusControl taskId={task.id} status={task.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Agenda item</dt>
                  <dd className="mt-1 text-neutral-800">{task.agendaItemTitle ?? 'Not linked'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
