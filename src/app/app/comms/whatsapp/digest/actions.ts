'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { notifyUser } from '@/kernel/notifications/notify'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { categorizeWhatsAppFeed, type WhatsAppCategory } from '@/lib/ai/whatsapp-feed-categorization'
import { loadWhatsAppFeedWindow } from '@/modules/ai-features/domain/whatsapp-feed-store'
import type { Database } from '@/types/database'

export interface DigestActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: DigestActionState = { ok: false }
const DIGEST_PATH = '/app/comms/whatsapp/digest'

type AppSupabaseClient = SupabaseClient<Database>

// whatsapp_feed_* / content_calendar / member_onboarding are not all in the
// generated Database types, so we narrow through a structural cast, mirroring
// src/app/app/comms/transcripts/actions.ts.
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    } & Promise<{ error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string | boolean) => Promise<{ error: { message: string } | null }> & {
        eq: (column: string, value: string | boolean) => {
          eq: (column: string, value: string | boolean) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  }
}

function asText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isoDate(value: FormDataEntryValue | null): string | null {
  const text = asText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

/** Categories that generate a reviewable downstream proposal. */
const PROPOSAL_CATEGORIES: ReadonlySet<WhatsAppCategory> = new Set(['birthday', 'new_member', 'event'])

async function requireCommsOperator() {
  const supabase = (await createClient()) as AppSupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }
  return { supabase, user, profile }
}

export async function runWhatsAppDigest(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    if (!isAiEnabled()) return { ok: false, error: 'AI features are disabled for this environment.' }

    const { supabase, user } = await requireCommsOperator()

    const startDate = isoDate(formData.get('window_start'))
    const endDate = isoDate(formData.get('window_end'))
    if (!startDate || !endDate) return { ok: false, error: 'A start and end date are required.' }
    if (startDate > endDate) return { ok: false, error: 'The start date must be on or before the end date.' }

    const monthly = asText(formData.get('monthly')) === 'true'
    let campusSessionId = asText(formData.get('campus_session_id')) || null

    // Auto-link to the campus meeting the window closes on (window end === a
    // meeting date), so the Campus WhatsApp tab resolves this same digest record
    // without re-running the AI. Explicit selection wins.
    if (!campusSessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: closing } = await (supabase as any)
        .from('campus_sessions')
        .select('id')
        .eq('session_date', endDate)
        .order('created_at', { ascending: true })
        .limit(1)
      campusSessionId = (closing ?? [])[0]?.id ?? null
    }

    const startIso = `${startDate}T00:00:00.000Z`
    const endIso = `${endDate}T23:59:59.999Z`

    const messages = await loadWhatsAppFeedWindow(supabase, { startIso, endIso })
    const categorization = await categorizeWhatsAppFeed({ messages, monthly, createdBy: user.id })

    const db = supabase as unknown as LooseDb

    // Supersede any prior pending draft for this exact window + monthly flag.
    await db
      .from('whatsapp_feed_summaries')
      .update({ status: 'superseded' })
      .eq('window_start', startIso)
      .eq('window_end', endIso)
      .eq('monthly', monthly)

    const { data: inserted, error: insertError } = await db
      .from('whatsapp_feed_summaries')
      .insert({
        window_start: startIso,
        window_end: endIso,
        monthly,
        tldr: categorization.tldr,
        monthly_summary: categorization.monthlySummary,
        message_count: messages.length,
        campus_session_id: campusSessionId,
        status: 'pending',
        model: categorization.model,
        effort: categorization.effort,
        raw_response: categorization.rawResponse ?? {},
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(insertError.message)

    const summaryId = inserted?.id ? String(inserted.id) : null
    if (summaryId) {
      for (const item of categorization.items) {
        const { error: itemError } = await db.from('whatsapp_feed_items').insert({
          summary_id: summaryId,
          category: item.category,
          title: item.title,
          person: item.person,
          item_date: item.date,
          detail: item.detail,
          source_message_ids: item.sourceMessageIds,
          proposal_status: PROPOSAL_CATEGORIES.has(item.category) ? 'proposed' : 'none',
        })
        // Best-effort: one bad item must not fail the whole run.
        if (itemError) console.error('[whatsapp-digest] item insert failed', itemError)
      }
    }

    revalidatePath(DIGEST_PATH)
    const proposalCount = categorization.items.filter((i) => PROPOSAL_CATEGORIES.has(i.category)).length
    const tail = proposalCount > 0 ? ` ${proposalCount} action${proposalCount === 1 ? '' : 's'} proposed for review.` : ''
    return { ok: true, message: `Categorized ${messages.length} message${messages.length === 1 ? '' : 's'}.${tail}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not categorize the WhatsApp feed.' }
  }
}

export async function saveWhatsAppDigest(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const summaryId = asText(formData.get('summary_id'))
    if (!summaryId) return { ok: false, error: 'Summary is required.' }

    const db = supabase as unknown as LooseDb
    const { error } = await db
      .from('whatsapp_feed_summaries')
      .update({ status: 'saved', saved_by: user.id, saved_at: new Date().toISOString() })
      .eq('id', summaryId)
    if (error) throw new Error(error.message)

    revalidatePath(DIGEST_PATH)
    return { ok: true, message: 'Digest saved.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the digest.' }
  }
}

export async function discardWhatsAppDigest(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const summaryId = asText(formData.get('summary_id'))
    if (!summaryId) return { ok: false, error: 'Summary is required.' }

    const db = supabase as unknown as LooseDb
    const { error } = await db.from('whatsapp_feed_summaries').update({ status: 'discarded' }).eq('id', summaryId)
    if (error) throw new Error(error.message)

    revalidatePath(DIGEST_PATH)
    return { ok: true, message: 'Digest discarded.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not discard the digest.' }
  }
}

type FeedItemRow = {
  id: string
  category: string
  title: string
  person: string | null
  item_date: string | null
  detail: string | null
  source_message_ids: string[] | null
  proposal_status: string
}

async function loadItem(db: LooseDb, itemId: string): Promise<FeedItemRow> {
  const { data, error } = await db
    .from('whatsapp_feed_items')
    .select('id, category, title, person, item_date, detail, source_message_ids, proposal_status')
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Item not found.')
  return data as unknown as FeedItemRow
}

async function markItemConfirmed(db: LooseDb, itemId: string, userId: string, linkedType: string, linkedId: string | null) {
  const { error } = await db
    .from('whatsapp_feed_items')
    .update({
      proposal_status: 'confirmed',
      linked_type: linkedType,
      linked_id: linkedId,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
}

/** Birthday → content_calendar (a dated, comms-owned calendar entry). */
export async function confirmBirthday(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  return confirmCalendarEntry(formData, 'birthday')
}

/** Event → content_calendar. Only ever run on explicit operator action. */
export async function confirmEvent(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  return confirmCalendarEntry(formData, 'event')
}

async function confirmCalendarEntry(formData: FormData, kind: 'birthday' | 'event'): Promise<DigestActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const itemId = asText(formData.get('item_id'))
    if (!itemId) return { ok: false, error: 'Item is required.' }

    const db = supabase as unknown as LooseDb
    const item = await loadItem(db, itemId)

    const isoOnDate = item.item_date && /^\d{4}-\d{2}-\d{2}$/.test(item.item_date) ? `${item.item_date}T09:00:00.000Z` : null
    const title =
      kind === 'birthday'
        ? `Birthday — ${item.person ?? item.title}`
        : item.title
    const sourceIntakeId = (item.source_message_ids ?? [])[0] ?? null

    const { data: created, error: createError } = await db
      .from('content_calendar')
      .insert({
        title,
        channels: ['whatsapp'],
        status: isoOnDate ? 'scheduled' : 'draft',
        scheduled_at: isoOnDate,
        body_draft: item.detail,
        author_id: user.id,
        source_intake_id: sourceIntakeId,
      })
      .select('id')
      .single()
    if (createError) throw new Error(createError.message)

    await markItemConfirmed(db, itemId, user.id, 'content_calendar', created?.id ? String(created.id) : null)

    revalidatePath(DIGEST_PATH)
    return { ok: true, message: kind === 'birthday' ? 'Birthday added to the calendar.' : 'Event added to the calendar.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create the calendar entry.' }
  }
}

/** New member → member_onboarding (the comms-dashboard new-member flow). */
export async function confirmNewMember(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const itemId = asText(formData.get('item_id'))
    if (!itemId) return { ok: false, error: 'Item is required.' }

    const db = supabase as unknown as LooseDb
    const item = await loadItem(db, itemId)
    const fullName = (item.person ?? item.title).trim()
    if (!fullName) return { ok: false, error: 'No member name could be determined.' }

    const { data: created, error: createError } = await db
      .from('member_onboarding')
      .insert({ full_name: fullName, email: null, status: 'pending', created_by: user.id })
      .select('id')
      .single()
    if (createError) throw new Error(createError.message)

    await markItemConfirmed(db, itemId, user.id, 'member_onboarding', created?.id ? String(created.id) : null)

    revalidatePath(DIGEST_PATH)
    return { ok: true, message: `${fullName} set up for onboarding.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not set up the new member.' }
  }
}

/**
 * Turn a categorized WhatsApp topic into an assigned comms task. The task is a
 * normal `comms_tasks` row linked to the topic via `whatsapp_feed_item_id`, so
 * it surfaces in the owner's "my dashboard" through the unified_tasks view with
 * the topic as its context. Owner + optional deadline; the topic supplies the
 * context label/link (no data duplicated).
 */
export async function createTopicTask(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const itemId = asText(formData.get('item_id'))
    const title = asText(formData.get('title'))
    if (!itemId) return { ok: false, error: 'Topic is required.' }
    if (!title) return { ok: false, error: 'A task title is required.' }

    const ownerRaw = asText(formData.get('owner_id'))
    const ownerId = ownerRaw && ownerRaw !== 'none' ? ownerRaw : user.id
    const description = asText(formData.get('description')) || null
    const dueRaw = asText(formData.get('due_date'))
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null

    const db = supabase as unknown as LooseDb
    const { error } = await db.from('comms_tasks').insert({
      title,
      description,
      owner_id: ownerId,
      due_date: dueDate,
      status: 'not_started',
      whatsapp_feed_item_id: itemId,
      created_by: user.id,
    })
    if (error) throw new Error(error.message)

    if (ownerId !== user.id) {
      await notifyUser({
        recipientId: ownerId,
        event: 'task_assigned',
        title: 'New task assigned to you',
        body: `You have been assigned a task: "${title}"`,
        linkUrl: '/app/comms/dashboard',
      })
    }

    revalidatePath(DIGEST_PATH)
    revalidatePath('/app/comms/dashboard')
    revalidatePath('/app/dashboard')
    return { ok: true, message: 'Task created and assigned.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create the task.' }
  }
}

export async function dismissWhatsAppItem(
  _prev: DigestActionState = INITIAL_STATE,
  formData: FormData
): Promise<DigestActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const itemId = asText(formData.get('item_id'))
    if (!itemId) return { ok: false, error: 'Item is required.' }

    const db = supabase as unknown as LooseDb
    const { error } = await db.from('whatsapp_feed_items').update({ proposal_status: 'dismissed' }).eq('id', itemId)
    if (error) throw new Error(error.message)

    revalidatePath(DIGEST_PATH)
    return { ok: true, message: 'Proposal dismissed.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not dismiss the item.' }
  }
}
