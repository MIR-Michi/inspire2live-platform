/**
 * lib/tasks/repository.ts
 *
 * Reads tasks through the `unified_tasks` view (ADR-0008) and resolves owner
 * and context labels/links into `UnifiedTask`s. This is the single place the
 * application loads tasks from, regardless of which table they live in.
 *
 * The view is read-only and runs with the caller's RLS (security_invoker), so
 * a user only ever sees rows they could already read in the source tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUnifiedTaskStatus, isTaskOpen } from '@/lib/tasks/status'
import type { TaskContext, TaskContextKind, TaskSource, UnifiedTask } from '@/lib/tasks/types'

type UnifiedTaskRow = {
  source: TaskSource
  id: string
  title: string
  description: string | null
  owner_id: string | null
  status: string
  due_date: string | null
  priority: string | null
  position: number | null
  context_kind: TaskContextKind
  context_id: string | null
  created_at: string
  updated_at: string
}

const UNIFIED_TASK_COLUMNS =
  'source, id, title, description, owner_id, status, due_date, priority, position, context_kind, context_id, created_at, updated_at'

function campusHref(sessionDate: string | null): string | null {
  if (!sessionDate) return '/app/comms/campus'
  const d = new Date(`${sessionDate}T00:00:00Z`)
  return `/app/comms/campus/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`
}

/** Actionable order: dated tasks first (earliest), then undated by title. */
function byDueDate(a: UnifiedTask, b: UnifiedTask): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
  if (a.dueDate) return -1
  if (b.dueDate) return 1
  return a.title.localeCompare(b.title)
}

/**
 * Turn raw `unified_tasks` rows into `UnifiedTask`s: resolve each task's context
 * label/href and its owner label (from the supplied owner→label map), then sort.
 * Shared by the per-user and team loaders so both stay consistent.
 */
async function hydrateTasks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  taskRows: UnifiedTaskRow[],
  ownerLabelById: Map<string, string>,
): Promise<UnifiedTask[]> {
  // ── Resolve context labels/hrefs, batched per context kind ───────────────
  const idsByKind = new Map<TaskContextKind, Set<string>>()
  for (const row of taskRows) {
    if (!row.context_id) continue
    const set = idsByKind.get(row.context_kind) ?? new Set<string>()
    set.add(row.context_id)
    idsByKind.set(row.context_kind, set)
  }
  const idList = (kind: TaskContextKind) => Array.from(idsByKind.get(kind) ?? [])

  const [initiativeRes, campusRes, memberRes, agendaRes, topicRes] = await Promise.all([
    idList('initiative').length
      ? db.from('initiatives').select('id, title').in('id', idList('initiative'))
      : Promise.resolve({ data: [] }),
    idList('campus_session').length
      ? db.from('campus_sessions').select('id, session_date, theme').in('id', idList('campus_session'))
      : Promise.resolve({ data: [] }),
    idList('onboarding_member').length
      ? db.from('member_onboarding').select('id, full_name').in('id', idList('onboarding_member'))
      : Promise.resolve({ data: [] }),
    idList('agenda_item').length
      ? db.from('comms_weekly_agenda_items').select('id, title').in('id', idList('agenda_item'))
      : Promise.resolve({ data: [] }),
    idList('whatsapp_topic').length
      ? db.from('whatsapp_feed_items').select('id, title').in('id', idList('whatsapp_topic'))
      : Promise.resolve({ data: [] }),
  ])

  const initiativeTitle = new Map<string, string>(
    ((initiativeRes.data ?? []) as Array<{ id: string; title: string | null }>).map((r) => [r.id, r.title ?? 'Initiative'])
  )
  const campusById = new Map<string, { session_date: string | null; theme: string | null }>(
    ((campusRes.data ?? []) as Array<{ id: string; session_date: string | null; theme: string | null }>).map((r) => [
      r.id,
      { session_date: r.session_date, theme: r.theme },
    ])
  )
  const memberName = new Map<string, string>(
    ((memberRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((r) => [r.id, r.full_name ?? 'New member'])
  )
  const agendaTitle = new Map<string, string>(
    ((agendaRes.data ?? []) as Array<{ id: string; title: string | null }>).map((r) => [r.id, r.title ?? 'Agenda item'])
  )
  const topicTitle = new Map<string, string>(
    ((topicRes.data ?? []) as Array<{ id: string; title: string | null }>).map((r) => [r.id, r.title ?? 'WhatsApp topic'])
  )

  function buildContext(row: UnifiedTaskRow): TaskContext {
    const id = row.context_id
    switch (row.context_kind) {
      case 'initiative':
        return {
          kind: 'initiative',
          id,
          label: id ? initiativeTitle.get(id) ?? 'Initiative' : null,
          href: id ? `/app/initiatives/${id}/tasks` : null,
        }
      case 'campus_session': {
        const campus = id ? campusById.get(id) : null
        return {
          kind: 'campus_session',
          id,
          label: campus?.theme ?? 'Campus meeting',
          href: campusHref(campus?.session_date ?? null),
        }
      }
      case 'agenda_item':
        return {
          kind: 'agenda_item',
          id,
          label: id ? agendaTitle.get(id) ?? 'Agenda item' : null,
          href: '/app/comms/dashboard?view=team',
        }
      case 'onboarding_member':
        return {
          kind: 'onboarding_member',
          id,
          label: id ? memberName.get(id) ?? 'New member' : null,
          href: '/app/comms/dashboard?view=team',
        }
      case 'whatsapp_topic':
        return {
          kind: 'whatsapp_topic',
          id,
          label: id ? topicTitle.get(id) ?? 'WhatsApp topic' : null,
          href: '/app/comms/whatsapp',
        }
      default:
        return { kind: 'standalone', id: null, label: null, href: '/app/comms/dashboard' }
    }
  }

  const tasks: UnifiedTask[] = taskRows.map((row) => ({
    source: row.source,
    id: row.id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    ownerLabel: row.owner_id ? ownerLabelById.get(row.owner_id) ?? null : null,
    status: normalizeUnifiedTaskStatus(row.source, row.status),
    rawStatus: row.status,
    dueDate: row.due_date,
    priority: row.priority,
    position: row.position,
    context: buildContext(row),
    editable: row.source === 'comms' || row.source === 'onboarding',
  }))

  return tasks.sort(byDueDate)
}

/**
 * Loads every task owned by `userId` across all sources, newest-actionable
 * first. `openOnly` keeps just the tasks that still need attention.
 */
export async function loadTasksForUser(
  supabase: SupabaseClient,
  userId: string,
  { openOnly = false, limit = 100 }: { openOnly?: boolean; limit?: number } = {}
): Promise<UnifiedTask[]> {
  // Loosely-typed handle: unified_tasks + comms_* tables are not in the
  // generated Database types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: rows, error } = await db
    .from('unified_tasks')
    .select(UNIFIED_TASK_COLUMNS)
    .eq('owner_id', userId)
    .limit(limit)

  // The view may not exist in an environment that hasn't run migration 00075.
  if (error || !rows) return []

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', userId)
    .maybeSingle()
  const ownerLabel = ownerProfile?.name ?? ownerProfile?.email ?? null
  const ownerLabelById = new Map<string, string>(ownerLabel ? [[userId, ownerLabel]] : [])

  const tasks = await hydrateTasks(db, rows as UnifiedTaskRow[], ownerLabelById)
  return openOnly ? tasks.filter((t) => isTaskOpen(t.status)) : tasks
}

/**
 * Loads every task the caller can read across all owners (for a team board),
 * resolving each task's owner label. RLS still applies — a comms member/admin
 * sees the team's comms tasks; nobody sees rows they couldn't already read.
 */
export async function loadTeamTasks(
  supabase: SupabaseClient,
  { openOnly = false, limit = 500 }: { openOnly?: boolean; limit?: number } = {}
): Promise<UnifiedTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: rows, error } = await db
    .from('unified_tasks')
    .select(UNIFIED_TASK_COLUMNS)
    .limit(limit)

  if (error || !rows) return []
  const taskRows = rows as UnifiedTaskRow[]

  const ownerIds = Array.from(
    new Set(taskRows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))
  )
  const ownerLabelById = new Map<string, string>()
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', ownerIds)
    for (const p of (profs ?? []) as Array<{ id: string; name: string | null; email: string | null }>) {
      ownerLabelById.set(p.id, p.name ?? p.email ?? 'Unknown')
    }
  }

  const tasks = await hydrateTasks(db, taskRows, ownerLabelById)
  return openOnly ? tasks.filter((t) => isTaskOpen(t.status)) : tasks
}
