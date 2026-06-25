'use client'

import { updateMemberOnboardingTaskStatus } from '@/app/app/comms/dashboard/member-onboarding-actions'
import { UNIFIED_STATUS_ORDER, UNIFIED_STATUS_META, type UnifiedStatus } from '@/lib/comms-status'
import type { MemberTaskStatus } from '@/lib/member-onboarding'

/**
 * Inline status control for a new-member onboarding task. Mirrors
 * TaskStatusControl but targets the member_onboarding_tasks update action. The
 * onboarding task statuses share the unified vocabulary.
 */
export function MemberTaskStatusControl({ taskId, status }: { taskId: string; status: MemberTaskStatus }) {
  return (
    <form action={updateMemberOnboardingTaskStatus} className="inline-flex">
      <input type="hidden" name="task_id" value={taskId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Update onboarding task status"
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${UNIFIED_STATUS_META[status as UnifiedStatus].badgeClass}`}
      >
        {UNIFIED_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {UNIFIED_STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  )
}
