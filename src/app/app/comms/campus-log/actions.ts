'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { normalizeRole } from '@/lib/role-access'
import {
  CAMPUS_MEETING_TASK_TEMPLATE,
  CAMPUS_MEETING_DEFAULT_OWNERS,
} from '@/lib/campus-meeting-tasks'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { generateCampusBriefing, type CampusBriefing } from '@/lib/ai/campus-briefing'
import { notifyUser } from '@/lib/notify'

/**
 * Resolves the template's default owner names (e.g. "Peter Kapitein") to
 * platform profile ids. Names without a matching profile are simply absent from
 * the map, so the caller falls back to the meeting's creator.
 */
async function resolveDefaultOwnerIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (CAMPUS_MEETING_DEFAULT_OWNERS.length === 0) return map

  const { data } = await supabase.from('profiles').select('id, name')
  for (const profile of (data ?? []) as Array<{ id: string; name: string | null }>) {
    const name = (profile.name ?? '').trim().toLowerCase()
    if (!name) continue
    const match = CAMPUS_MEETING_DEFAULT_OWNERS.find((owner) => owner.toLowerCase() === name)
    if (match && !map.has(match)) map.set(match, profile.id)
  }
  return map
}

/**
 * Seeds the standard campus-meeting checklist as comms_tasks tied to a session.
 * Each task is owned by its template default owner (resolved by name), falling
 * back to the meeting's creator so every task always has an owner. created_at is
 * staggered by index so the checklist renders in template order. Best-effort: a
 * failure to seed must not block creating the meeting itself.
 */
async function seedCampusMeetingTasks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sessionId: string,
  ownerId: string
) {
  const ownerIds = await resolveDefaultOwnerIds(supabase)
  const total = CAMPUS_MEETING_TASK_TEMPLATE.length
  const base = Date.now()
  const rows = CAMPUS_MEETING_TASK_TEMPLATE.map((task, index) => ({
    title: task.title,
    owner_id: (task.defaultOwnerName && ownerIds.get(task.defaultOwnerName)) || ownerId,
    status: 'not_started',
    campus_session_id: sessionId,
    created_by: ownerId,
    // Stagger into the recent past so the checklist renders in template order
    // (loaders sort by created_at asc) without dating tasks in the future.
    created_at: new Date(base - (total - index) * 1000).toISOString(),
  }))
  await supabase.from('comms_tasks').insert(rows)
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function parseLineList(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatCampusDecision(decision: string, owner: string) {
  return `Decision: ${decision.slice(0, 220)} | Owner: ${owner.slice(0, 80)}`
}

function safeReturnPath(formData: FormData) {
  const path = asText(formData.get('return_path'))
  return path.startsWith('/app/comms/') ? path : '/app/comms/campus'
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, role: profile.role as string | null }
}

export async function createCampusSession(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const sessionDate = asText(formData.get('session_date'))
  const theme = asText(formData.get('theme'))

  if (!sessionDate) throw new Error('Session date is required.')

  const { data, error } = await supabase
    .from('campus_sessions')
    .insert({
      session_date: sessionDate,
      theme: theme || null,
      summary: asText(formData.get('summary')) || null,
      decisions_for_publication: parseLineList(asText(formData.get('decisions_for_publication'))),
      created_by: user.id,
      participating_hub_ids: parseValues(formData, 'participating_hub_ids'),
      initiative_ids: parseValues(formData, 'initiative_ids'),
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (data?.id) await seedCampusMeetingTasks(supabase, data.id, user.id)

  revalidatePath('/app/comms/campus-log')
  redirect(`/app/comms/campus-log/sessions/${data?.id}`)
}

/**
 * Creates a campus monthly session and returns the user to where they started
 * (used from the campus month page so a meeting can be started inline without
 * leaving the briefing workspace). Mirrors createCampusSession but redirects
 * back to the originating page instead of the session log.
 */
export async function startCampusMeeting(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const sessionDate = asText(formData.get('session_date'))
  const returnPath = safeReturnPath(formData)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new Error('A valid session date is required.')

  // Idempotent per month: if a meeting already exists for this month, reuse it
  // instead of creating a duplicate. Duplicate sessions sharing a month split a
  // meeting's data (checklist on one row, briefing on another) and make the
  // briefing workspace's "primary" session ambiguous.
  const [yearPart, monthPart] = sessionDate.split('-').map(Number)
  const monthStart = `${yearPart}-${String(monthPart).padStart(2, '0')}-01`
  const nextMonth =
    monthPart === 12
      ? `${yearPart + 1}-01-01`
      : `${yearPart}-${String(monthPart + 1).padStart(2, '0')}-01`

  const { data: existing } = await supabase
    .from('campus_sessions')
    .select('id')
    .gte('session_date', monthStart)
    .lt('session_date', nextMonth)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    revalidatePath('/app/comms/campus')
    revalidatePath(returnPath)
    redirect(returnPath)
  }

  const { data, error } = await supabase
    .from('campus_sessions')
    .insert({ session_date: sessionDate, created_by: user.id })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (data?.id) await seedCampusMeetingTasks(supabase, data.id, user.id)

  revalidatePath('/app/comms/campus')
  revalidatePath(returnPath)
  redirect(returnPath)
}

export async function saveCampusSession(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  if (!sessionId) throw new Error('Session is required.')

  const { error } = await supabase
    .from('campus_sessions')
    .update({
      session_date: asText(formData.get('session_date')),
      theme: asText(formData.get('theme')) || null,
      summary: asText(formData.get('summary')) || null,
      decisions_for_publication: parseLineList(asText(formData.get('decisions_for_publication'))),
      action_items_for_publication: parseLineList(asText(formData.get('action_items_for_publication'))),
      recording_url: asText(formData.get('recording_url')) || null,
      slides_media_id: asText(formData.get('slides_media_id')) || null,
      participating_hub_ids: parseValues(formData, 'participating_hub_ids'),
      initiative_ids: parseValues(formData, 'initiative_ids'),
      published_outputs: parseValues(formData, 'published_outputs'),
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus-log')
  revalidatePath(`/app/comms/campus-log/sessions/${sessionId}`)
  redirect(`/app/comms/campus-log/sessions/${sessionId}`)
}

export async function addCampusAgendaItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const agendaItem = asText(formData.get('agenda_item'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !agendaItem) throw new Error('Session and agenda item are required.')

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('action_items_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = `Agenda: ${agendaItem.slice(0, 180)}`
  const existingItems = session.action_items_for_publication ?? []
  const actionItems = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ action_items_for_publication: actionItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function addCampusDecisionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const decision = asText(formData.get('decision_item'))
  const owner = asText(formData.get('decision_owner'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !decision || !owner) {
    throw new Error('Decision and owner are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('decisions_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = formatCampusDecision(decision, owner)
  const existingItems = session.decisions_for_publication ?? []
  const decisions = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ decisions_for_publication: decisions })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function updateCampusDecisionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const decision = asText(formData.get('decision_item'))
  const owner = asText(formData.get('decision_owner'))
  const returnPath = safeReturnPath(formData)
  const index = Number(asText(formData.get('decision_index')))

  if (!sessionId || !decision || !owner || !Number.isInteger(index) || index < 0) {
    throw new Error('Decision, owner, and valid index are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('decisions_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const existingItems = [...(session.decisions_for_publication ?? [])]
  if (index >= existingItems.length) throw new Error('Decision not found.')
  existingItems[index] = formatCampusDecision(decision, owner)

  const { error } = await supabase
    .from('campus_sessions')
    .update({ decisions_for_publication: existingItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

export async function addCampusSessionFile(formData: FormData) {
  const { supabase, user } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const title = asText(formData.get('title'))
  const assetType = asText(formData.get('asset_type'))
  const url = asText(formData.get('url'))

  if (!sessionId || !title || !url) throw new Error('Session, title, and URL are required.')
  const validTypes = ['slides', 'document', 'recording', 'photo', 'video', 'report']
  const type = validTypes.includes(assetType) ? assetType : 'document'

  const { error } = await supabase.from('media_assets').insert({
    title: title.slice(0, 200),
    asset_type: type,
    sharepoint_url: url.slice(0, 1000),
    session_id: sessionId,
    contributed_by: user.id,
    rights_status: 'internal_only',
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/app/comms/campus-log/sessions/${sessionId}`)
}

export async function deleteCampusSessionFile(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const fileId = asText(formData.get('file_id'))
  const sessionId = asText(formData.get('session_id'))

  if (!fileId || !sessionId) throw new Error('File and session are required.')

  const { error } = await supabase.from('media_assets').delete().eq('id', fileId).eq('session_id', sessionId)
  if (error) throw new Error(error.message)

  revalidatePath(`/app/comms/campus-log/sessions/${sessionId}`)
}

type BriefingResult = { ok: boolean; message?: string; briefing?: CampusBriefing }

const BRIEFING_MIGRATION_MISSING =
  'Briefing generated, but it can’t be saved yet: the database is missing the briefing columns. Apply migration 00104 by running the "Deploy to Vercel (Production)" GitHub Action (or `pnpm db:push` against the linked project), then regenerate. It will not persist across reloads until then.'

/**
 * Generates an educational pre-meeting briefing about a campus session's
 * presenter and topic. Never runs automatically — only on explicit request.
 * The first generation is open to any comms operator; regenerating an existing
 * briefing is restricted to platform admins.
 *
 * Degrades gracefully when the `briefing*` columns are not yet present in the
 * database (migration 00104 lands in production only on merge to main): the
 * briefing is still generated and returned for display, just not persisted.
 */
export async function generateCampusBriefingAction(formData: FormData): Promise<BriefingResult> {
  try {
    const { supabase, user, role } = await requireCommsOperator()
    const sessionId = asText(formData.get('session_id'))
    const presenter = asText(formData.get('presenter'))
    const topic = asText(formData.get('topic'))
    const returnPath = safeReturnPath(formData)

    if (!sessionId) return { ok: false, message: 'Session is required.' }
    if (!topic) return { ok: false, message: 'A topic is required to generate a briefing.' }
    if (!isAiEnabled()) return { ok: false, message: 'AI features are disabled for this environment.' }

    // briefing* columns are not in the generated Database types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: session, error: loadError } = await db
      .from('campus_sessions')
      .select('id, theme, session_date')
      .eq('id', sessionId)
      .maybeSingle()

    if (loadError) return { ok: false, message: loadError.message }
    if (!session) return { ok: false, message: 'Campus session not found.' }

    // Probe whether the briefing column exists, and whether one is already saved.
    // A query error here means migration 00104 hasn't been applied — in that case
    // we treat it as a first-time generation and skip persistence below.
    let briefingColumnExists = true
    let hasExistingBriefing = false
    const { data: existing, error: existingError } = await db
      .from('campus_sessions')
      .select('briefing')
      .eq('id', sessionId)
      .maybeSingle()
    if (existingError) {
      briefingColumnExists = false
    } else {
      hasExistingBriefing = Boolean(existing?.briefing)
    }

    // Regenerating an existing (persisted) briefing is admin-only.
    if (hasExistingBriefing && normalizeRole(role) !== 'PlatformAdmin') {
      return { ok: false, message: 'Only admins can regenerate an existing briefing.' }
    }

    const briefing = await generateCampusBriefing({
      presenter,
      topic,
      theme: session.theme ?? null,
      sessionDate: session.session_date ?? null,
      createdBy: user.id,
    })

    if (!briefingColumnExists) {
      return { ok: true, briefing, message: BRIEFING_MIGRATION_MISSING }
    }

    // `.select('id')` confirms a row was actually written — a 0-row result with
    // no error means row-level security silently blocked the update.
    const { data: updated, error: updateError } = await db
      .from('campus_sessions')
      .update({
        briefing,
        briefing_presenter: presenter || null,
        briefing_topic: topic,
        briefing_generated_at: new Date().toISOString(),
        briefing_generated_by: user.id,
      })
      .eq('id', sessionId)
      .select('id')

    if (updateError) {
      // Surface the real cause (e.g. a stale PostgREST schema cache reports
      // "Could not find the 'briefing' column ... in the schema cache").
      const message = /schema cache|does not exist|column/i.test(updateError.message)
        ? BRIEFING_MIGRATION_MISSING
        : `Briefing generated, but saving failed: ${updateError.message}`
      return { ok: true, briefing, message }
    }

    if (!updated || updated.length === 0) {
      return {
        ok: true,
        briefing,
        message: 'Briefing generated, but no row was saved — your account may not have permission to update this session (row-level security).',
      }
    }

    revalidatePath('/app/comms/campus')
    revalidatePath('/app/comms/campus-log')
    revalidatePath(returnPath)
    revalidatePath(`/app/comms/campus-log/sessions/${sessionId}`)
    return { ok: true, briefing }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to generate briefing.' }
  }
}

export async function addCampusActionItem(formData: FormData) {
  const { supabase } = await requireCommsOperator()
  const sessionId = asText(formData.get('session_id'))
  const action = asText(formData.get('action_item'))
  const assignee = asText(formData.get('assigned_to'))
  const dueDate = asText(formData.get('due_date'))
  const returnPath = safeReturnPath(formData)

  if (!sessionId || !action || !assignee || !dueDate) {
    throw new Error('Action item, assigned person, and date are required.')
  }

  const { data: session, error: loadError } = await supabase
    .from('campus_sessions')
    .select('action_items_for_publication')
    .eq('id', sessionId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!session) throw new Error('Campus session not found.')

  const nextItem = `Action: ${action.slice(0, 180)} | Owner: ${assignee.slice(0, 80)} | Due: ${dueDate}`
  const existingItems = session.action_items_for_publication ?? []
  const actionItems = existingItems.includes(nextItem) ? existingItems : [...existingItems, nextItem]

  const { error } = await supabase
    .from('campus_sessions')
    .update({ action_items_for_publication: actionItems })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath(returnPath)
}

// ─── Campus meeting checklist (comms_tasks scoped to a campus session) ────────

type ChecklistResult = { ok: boolean; message?: string }

const VALID_TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped'])

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function revalidateChecklist(year?: string, month?: string) {
  revalidatePath('/app/comms/campus')
  revalidatePath('/app/comms/campus-log')
  revalidatePath('/app/dashboard')
  if (year && month) revalidatePath(`/app/comms/campus/${year}/${month}`)
}

/** Seeds the standard checklist for a session that has none yet (e.g. an older
 *  meeting created before the template existed). No-op if tasks already exist. */
export async function seedCampusChecklist(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const sessionId = asText(formData.get('session_id'))
    if (!sessionId) return { ok: false, message: 'Session is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { count } = await db
      .from('comms_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('campus_session_id', sessionId)

    if ((count ?? 0) > 0) return { ok: true }

    await seedCampusMeetingTasks(supabase, sessionId, user.id)
    revalidateChecklist(asText(formData.get('year')), asText(formData.get('month')))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to set up checklist.' }
  }
}

export async function createCampusChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const sessionId = asText(formData.get('session_id'))
    const title = asText(formData.get('title'))
    const ownerId = asText(formData.get('owner_id')) || null
    const dueInput = asText(formData.get('due_date'))
    const dueDate = isIsoDate(dueInput) ? dueInput : null

    if (!sessionId) return { ok: false, message: 'Session is required.' }
    if (!title) return { ok: false, message: 'A task title is required.' }

    const resolvedOwnerId = ownerId ?? user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').insert({
      title: title.slice(0, 200),
      owner_id: resolvedOwnerId,
      due_date: dueDate,
      status: 'not_started',
      campus_session_id: sessionId,
      created_by: user.id,
    })
    if (error) return { ok: false, message: error.message }

    if (resolvedOwnerId !== user.id) {
      await notifyUser({
        recipientId: resolvedOwnerId,
        event: 'task_assigned',
        title: 'New campus task assigned to you',
        body: `You have been assigned a campus task: "${title}"`,
        linkUrl: '/app/comms/campus',
      })
    }

    revalidateChecklist(asText(formData.get('year')), asText(formData.get('month')))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to add task.' }
  }
}

export async function updateCampusChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const taskId = asText(formData.get('task_id'))
    if (!taskId) return { ok: false, message: 'Task is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }

    const title = asText(formData.get('title'))
    if (formData.has('title')) {
      if (!title) return { ok: false, message: 'A task title is required.' }
      patch.title = title.slice(0, 200)
    }
    if (formData.has('owner_id')) {
      patch.owner_id = asText(formData.get('owner_id')) || null
    }
    if (formData.has('status')) {
      const status = asText(formData.get('status'))
      if (!VALID_TASK_STATUSES.has(status)) return { ok: false, message: 'Invalid status.' }
      patch.status = status
    }
    if (formData.has('due_date')) {
      const dueInput = asText(formData.get('due_date'))
      patch.due_date = isIsoDate(dueInput) ? dueInput : null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').update(patch).eq('id', taskId)
    if (error) return { ok: false, message: error.message }

    // Notify a newly assigned owner (unless they assigned it to themselves).
    if (patch.owner_id && patch.owner_id !== user.id) {
      await notifyUser({
        recipientId: patch.owner_id,
        event: 'task_assigned',
        title: 'A campus task was assigned to you',
        body: `You are now the owner of: "${asText(formData.get('task_title')) || 'a campus task'}"`,
        linkUrl: '/app/comms/campus',
      })
    }

    revalidateChecklist(asText(formData.get('year')), asText(formData.get('month')))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to update task.' }
  }
}

export async function deleteCampusChecklistTask(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase } = await requireCommsOperator()
    const taskId = asText(formData.get('task_id'))
    if (!taskId) return { ok: false, message: 'Task is required.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('comms_tasks').delete().eq('id', taskId)
    if (error) return { ok: false, message: error.message }

    revalidateChecklist(asText(formData.get('year')), asText(formData.get('month')))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete task.' }
  }
}

// ─── Campus presenter (highlight of the month) ───────────────────────────────

export async function saveCampusPresenter(formData: FormData): Promise<ChecklistResult> {
  try {
    const { supabase } = await requireCommsOperator()
    const sessionId = asText(formData.get('session_id'))
    if (!sessionId) return { ok: false, message: 'Session is required.' }

    const name = asText(formData.get('presenter_name'))
    const avatarUrl = asText(formData.get('presenter_avatar_url'))
    const linkedinUrl = asText(formData.get('presenter_linkedin_url'))

    const safeUrl = (value: string) => {
      if (!value) return null
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? value.slice(0, 1000) : null
      } catch {
        return null
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('campus_sessions')
      .update({
        presenter_name: name ? name.slice(0, 200) : null,
        presenter_avatar_url: safeUrl(avatarUrl),
        presenter_linkedin_url: safeUrl(linkedinUrl),
      })
      .eq('id', sessionId)
    if (error) return { ok: false, message: error.message }

    revalidateChecklist(asText(formData.get('year')), asText(formData.get('month')))
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to save presenter.' }
  }
}
