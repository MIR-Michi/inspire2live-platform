'use client'

import { useMemo } from 'react'
import type { NewMemberRecord, MemberTaskStatus } from '@/lib/member-onboarding'
import type { TeamMemberOption } from '@/lib/comms-dashboard-data'
import {
  registerNewMember,
  confirmMemberOnboarding,
  declineMemberOnboarding,
  addMemberOnboardingTask,
  updateMemberOnboardingTaskStatus,
  removeMemberOnboardingTask,
} from '@/app/app/comms/dashboard/member-onboarding-actions'

const STATUS_OPTIONS: { value: MemberTaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
]

export function NewMembersSection({
  members,
  teamMembers,
  canApprove,
}: {
  members: NewMemberRecord[]
  teamMembers: TeamMemberOption[]
  canApprove: boolean
}) {
  const labelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of teamMembers) map.set(m.id, m.label)
    return map
  }, [teamMembers])

  return (
    <div className="space-y-4">
      {/* Register a new member — email may be a not-yet-live @inspire2live.org address. */}
      <form
        action={registerNewMember}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <label className="flex-1 min-w-[10rem] space-y-1">
          <span className="text-xs font-semibold text-neutral-600">Full name</span>
          <input
            name="full_name"
            required
            placeholder="New member name"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        <label className="flex-1 min-w-[12rem] space-y-1">
          <span className="text-xs font-semibold text-neutral-600">Email (optional, may not exist yet)</span>
          <input
            name="email"
            type="text"
            placeholder="name@inspire2live.org"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Register
        </button>
      </form>

      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
          No members are currently being onboarded.
        </p>
      ) : (
        members.map((member) => (
          <MemberCard key={member.id} member={member} teamMembers={teamMembers} labelById={labelById} canApprove={canApprove} />
        ))
      )}
    </div>
  )
}

function MemberCard({
  member,
  teamMembers,
  labelById,
  canApprove,
}: {
  member: NewMemberRecord
  teamMembers: TeamMemberOption[]
  labelById: Map<string, string>
  canApprove: boolean
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{member.fullName}</p>
          <p className="truncate text-xs text-neutral-500">{member.email || 'No email yet'}</p>
        </div>
        {member.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Awaiting confirmation
            </span>
            {canApprove && (
              <>
                <form action={confirmMemberOnboarding}>
                  <input type="hidden" name="onboarding_id" value={member.id} />
                  <button className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">
                    Confirm
                  </button>
                </form>
                <form action={declineMemberOnboarding}>
                  <input type="hidden" name="onboarding_id" value={member.id} />
                  <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                    Decline
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
            {member.completedCount}/{member.totalCount} done
          </span>
        )}
      </div>

      {member.status === 'active' && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          {member.tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm text-neutral-800">
                {task.title}
                {task.assigneeId && (
                  <span className="ml-2 text-xs text-neutral-500">· {labelById.get(task.assigneeId) ?? 'Assigned'}</span>
                )}
              </span>
              <form action={updateMemberOnboardingTaskStatus}>
                <input type="hidden" name="task_id" value={task.id} />
                <select
                  name="status"
                  defaultValue={task.status}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </form>
              <form action={removeMemberOnboardingTask}>
                <input type="hidden" name="task_id" value={task.id} />
                <button
                  aria-label={`Remove ${task.title}`}
                  className="rounded-md px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}
          {member.tasks.length === 0 && (
            <p className="text-xs text-neutral-400">No tasks yet. Add the first onboarding task below.</p>
          )}

          {/* Add a task */}
          <form action={addMemberOnboardingTask} className="flex flex-wrap items-center gap-2 pt-1">
            <input type="hidden" name="onboarding_id" value={member.id} />
            <input
              name="title"
              required
              placeholder="Add a task (e.g. create email address)"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none ring-orange-300 focus:ring"
            />
            <select name="assignee_id" defaultValue="" className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs">
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800">
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
