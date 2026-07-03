'use server'

/**
 * lib/tasks/actions.ts
 *
 * One entry point for mutating a task, regardless of source. Each call
 * delegates to the existing source-specific server action, which already
 * encapsulates that table's RLS, validation, revalidation, notifications, and
 * side-effects (onboarding completion reconcile + CRM logging). See ADR-0008.
 *
 * The unified UI always speaks the canonical status vocabulary and passes a
 * `source` field; comms and onboarding store that vocabulary natively, so no
 * mapping is needed. Initiative tasks are read-only on shared surfaces and are
 * not routed here.
 */

import { updateCommsTaskStatus, updateCommsTaskOwner } from '@/app/app/comms/dashboard/actions'
import {
  updateMemberOnboardingTaskStatus,
  updateMemberOnboardingTaskAssignee,
} from '@/app/app/comms/dashboard/member-onboarding-actions'

function source(formData: FormData) {
  return typeof formData.get('source') === 'string' ? (formData.get('source') as string) : ''
}

export async function updateTaskStatus(formData: FormData) {
  switch (source(formData)) {
    case 'comms':
      return updateCommsTaskStatus(formData)
    case 'onboarding':
      return updateMemberOnboardingTaskStatus(formData)
    default:
      throw new Error('This task type cannot be updated from here.')
  }
}

export async function reassignTask(formData: FormData) {
  switch (source(formData)) {
    case 'comms':
      // expects: task_id, owner_id, (optional) task_title
      return updateCommsTaskOwner(formData)
    case 'onboarding':
      // expects: task_id, assignee_id
      return updateMemberOnboardingTaskAssignee(formData)
    default:
      throw new Error('This task type cannot be reassigned from here.')
  }
}
