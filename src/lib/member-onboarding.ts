/**
 * lib/member-onboarding.ts
 *
 * Types and server-side loading for new-member onboarding checklists.
 * The `member_onboarding` / `member_onboarding_tasks` tables are not yet in the
 * generated Database types, so the loader uses a loosely-typed client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type MemberOnboardingStatus = 'pending' | 'active' | 'declined' | 'completed'
export type MemberTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export type MemberOnboardingTask = {
  id: string
  title: string
  assigneeId: string | null
  status: MemberTaskStatus
  position: number
}

export type NewMemberRecord = {
  id: string
  fullName: string
  email: string | null
  status: MemberOnboardingStatus
  profileId: string | null
  tasks: MemberOnboardingTask[]
  totalCount: number
  completedCount: number
}

const TASK_STATUSES = new Set<MemberTaskStatus>(['not_started', 'in_progress', 'completed', 'skipped'])

function normalizeTaskStatus(value: unknown): MemberTaskStatus {
  return typeof value === 'string' && TASK_STATUSES.has(value as MemberTaskStatus)
    ? (value as MemberTaskStatus)
    : 'not_started'
}

/**
 * Loads members still being onboarded (pending or active). Completed and
 * declined members are excluded so they drop off the dashboard automatically.
 */
export async function loadNewMembers(supabase: SupabaseClient): Promise<NewMemberRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: members, error } = await db
    .from('member_onboarding')
    .select('id, full_name, email, status, profile_id')
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  // Table may not exist yet in an environment that hasn't run migration 00058.
  if (error || !members || members.length === 0) return []

  const ids = (members as Array<{ id: string }>).map((m) => m.id)
  const { data: taskRows } = await db
    .from('member_onboarding_tasks')
    .select('id, onboarding_id, title, assignee_id, status, position')
    .in('onboarding_id', ids)
    .order('position', { ascending: true })

  const tasksByMember = new Map<string, MemberOnboardingTask[]>()
  for (const row of (taskRows ?? []) as Array<{
    id: string
    onboarding_id: string
    title: string
    assignee_id: string | null
    status: string
    position: number
  }>) {
    const list = tasksByMember.get(row.onboarding_id) ?? []
    list.push({
      id: row.id,
      title: row.title,
      assigneeId: row.assignee_id,
      status: normalizeTaskStatus(row.status),
      position: row.position,
    })
    tasksByMember.set(row.onboarding_id, list)
  }

  return (members as Array<{
    id: string
    full_name: string
    email: string | null
    status: string
    profile_id: string | null
  }>).map((m) => {
    const tasks = tasksByMember.get(m.id) ?? []
    return {
      id: m.id,
      fullName: m.full_name,
      email: m.email,
      status: (m.status as MemberOnboardingStatus) ?? 'pending',
      profileId: m.profile_id,
      tasks,
      totalCount: tasks.length,
      completedCount: tasks.filter((t) => t.status === 'completed').length,
    }
  })
}
