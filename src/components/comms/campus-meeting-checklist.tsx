'use client'

import { TaskStatusControl } from '@/components/comms/task-status-control'
import { updateCommsTaskOwner } from '@/app/app/comms/dashboard/actions'
import type { CommsTaskRecord } from '@/lib/comms-tasks'
import type { TeamMemberOption } from '@/lib/comms-dashboard-data'

/**
 * The standard checklist for a monthly campus meeting. Each task already has an
 * owner (seeded to the meeting's creator) and a status. The owner can be
 * reassigned to any comms-workspace member, and the status updated inline.
 */
export function CampusMeetingChecklist({
  tasks,
  teamMembers,
}: {
  tasks: CommsTaskRecord[]
  teamMembers: TeamMemberOption[]
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
        No meeting checklist yet.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{task.title}</span>
          <form action={updateCommsTaskOwner} className="inline-flex">
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="task_title" value={task.title} />
            <select
              name="owner_id"
              defaultValue={task.ownerId ?? ''}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              aria-label={`Reassign owner of ${task.title}`}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-800 focus:outline-none"
            >
              {!task.ownerId && <option value="">Unassigned</option>}
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </form>
          <TaskStatusControl taskId={task.id} status={task.status} />
        </li>
      ))}
    </ul>
  )
}
