'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { findTargetedConferences } from '@/lib/ai/conference-targeted-search'
import { sendWhatsAppMessage } from '@/lib/whatsapp-send'
import {
  enrichConference,
  validateConferences,
  type ConferenceDetail,
  type ConferenceRegion,
  type DiscoveredConference,
} from '@/lib/ai/conferences'
import { loadConference } from '@/lib/comms-conferences'
import { CONFERENCE_STAGES, type ConferenceStage } from '@/lib/comms-conferences'
import {
  isConferencePrepFlag,
  parseKeyPeople,
  prepFlagColumn,
  type ConferenceKeyPerson,
} from '@/lib/comms-conference-prep'
import { parseDelimitedList } from '@/lib/comms-events'

const CONFERENCES_PATH = '/app/comms/conferences'
const CONFERENCE_ASSIGNMENT_TOKEN = /\[conference:([0-9a-f-]{36})\]/i

/** Revalidate both the pipeline list and a conference's operating page. */
function revalidateConference(conferenceId: string) {
  revalidatePath(CONFERENCES_PATH)
  revalidatePath(`${CONFERENCES_PATH}/${conferenceId}`)
}

type ActionResult = { ok: boolean; message?: string }

type DbError = { message: string }
type Row = Record<string, unknown>
type RowsResult = Promise<{ data: Row[] | null; error: DbError | null }>
type RowResult = Promise<{ data: Row | null; error: DbError | null }>
type WriteResult = Promise<{ error: DbError | null }>

export type DiscoverMoreCriteria = {
  region?: ConferenceRegion | 'all'
  country?: string | null
  keywords?: string | null
}

export type DiscoverMoreResult =
  | { ok: true; conferences: DiscoveredConference[]; message: string; candidateCount: number; validatedCount: number }
  | { ok: false; message: string }

export type AddDiscoveredResult =
  | { ok: true; inserted: number; message: string }
  | { ok: false; message: string }

export type ConferenceContactOption = {
  id: string
  fullName: string
  email: string | null
  whatsappId: string | null
  meta: string | null
}

export type AssignedConferenceContact = ConferenceContactOption & {
  assignmentId: string
  role: string
  notificationStatus: string
  notificationDetail: string | null
  assignedAt: string
}

export type AssignConferenceContactInput = {
  conferenceId: string
  contactId?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  whatsappId?: string | null
}

async function requireCommsUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'Not authenticated.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return { ok: false as const, message: 'You do not have access to the Conferences workspace.' }
  return { ok: true as const, supabase, userId: user.id }
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
      }
    }
    upsert: (
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict: string; ignoreDuplicates?: boolean }
    ) => Promise<{ data?: unknown[] | null; error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
    delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
  }
}

type ConferenceContactDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => RowResult
        order: (column: string, opts: { ascending: boolean }) => RowsResult
      }
      ilike: (column: string, pattern: string) => {
        order: (column: string, opts: { ascending: boolean }) => { limit: (n: number) => RowsResult }
      }
      in: (column: string, values: string[]) => { limit: (n: number) => RowsResult }
    }
    insert: (payload: Row | Row[]) => {
      select: (columns: string) => { maybeSingle: () => RowResult }
    } & WriteResult
    upsert: (payload: Row | Row[], options?: { onConflict: string }) => WriteResult
    update: (payload: Row) => { eq: (column: string, value: string) => WriteResult }
  }
}

function conferenceRow(conf: DiscoveredConference, createdBy: string | null): Record<string, unknown> {
  return {
    name: conf.name,
    organizer: conf.organizer,
    region: conf.region,
    location: conf.location,
    main_focus: conf.mainFocus,
    topics: conf.topics,
    format: conf.format,
    start_date: conf.startDate,
    end_date: conf.endDate,
    website_url: conf.websiteUrl,
    source_url: conf.sourceUrl,
    summary: conf.summary,
    relevance: conf.relevance,
    dedupe_key: conf.dedupeKey,
    created_by: createdBy,
  }
}

function normalizeContactEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase()
  return email && email.includes('@') ? email : null
}

function clean(value: string | null | undefined, max = 160): string | null {
  const text = value?.trim()
  return text ? text.slice(0, max) : null
}

function assignmentToken(conferenceId: string): string {
  return `[conference:${conferenceId}]`
}

function isMissingAssignmentTable(error: DbError | null | undefined): boolean {
  const message = error?.message.toLowerCase() ?? ''
  return message.includes('conference_contact_assignments') && (
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('does not exist') ||
    message.includes('relation')
  )
}

function assignmentSummary(conferenceId: string, conferenceName: string): string {
  return `${assignmentToken(conferenceId)} Assigned to attend/contact ${conferenceName}.`
}

function notificationStatusFromSummary(summary: string): string {
  const match = summary.match(/Notification status: ([a-z_]+)/i)
  return match?.[1]?.toLowerCase() ?? 'recorded'
}

function notificationDetailFromSummary(summary: string): string | null {
  return clean(summary.replace(CONFERENCE_ASSIGNMENT_TOKEN, '').replace(/^\s*Assigned to attend\/contact .*?\.\s*/i, ''), 600)
}

function contactOptionFromRow(row: Row): ConferenceContactOption {
  const title = clean(String(row.title ?? ''))
  const organisation = clean(String(row.organisation ?? ''))
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? 'Unnamed contact'),
    email: clean(String(row.email ?? '')),
    whatsappId: clean(String(row.whatsapp_id ?? '')),
    meta: [title, organisation, clean(String(row.email ?? ''))].filter(Boolean).join(' · ') || null,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendConferenceEmail(to: string, subject: string, body: string, linkUrl: string): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, detail: 'Email not sent: RESEND_API_KEY is not configured.' }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
  const actionUrl = `${base}${linkUrl}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
      to: [to],
      subject,
      html: `<!DOCTYPE html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#111827"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(actionUrl)}">Open conference</a></p></body></html>`,
    }),
  }).catch(() => null)
  if (!response?.ok) return { ok: false, detail: `Email not sent: provider returned ${response?.status ?? 'network error'}.` }
  return { ok: true, detail: 'Email sent.' }
}

async function notifyConferenceContact(contact: ConferenceContactOption, conferenceName: string, conferenceId: string, sentBy: string) {
  const subject = `You were added to ${conferenceName}`
  const body = `You have been added as an Inspire2Live attendee/contact for ${conferenceName}.`
  const linkUrl = `${CONFERENCES_PATH}?conference=${conferenceId}`
  const details: string[] = []
  let emailOk = false
  let whatsappOk = false

  if (contact.email) {
    const result = await sendConferenceEmail(contact.email, subject, body, linkUrl)
    emailOk = result.ok
    details.push(result.detail)
  } else {
    details.push('Email not sent: contact has no email address.')
  }

  if (contact.whatsappId) {
    const whatsapp = await sendWhatsAppMessage(contact.whatsappId, body)
    whatsappOk = whatsapp.ok
    details.push(whatsapp.ok ? 'WhatsApp sent.' : `WhatsApp not sent: ${whatsapp.error}`)
    const admin = createAdminClient() as unknown as ConferenceContactDb
    await admin.from('whatsapp_outbound_messages').insert({
      recipient_whatsapp_id: contact.whatsappId,
      body,
      sent_by: sentBy,
      graph_message_id: whatsapp.ok ? whatsapp.messageId : null,
      delivery_status: whatsapp.ok ? 'sent' : 'failed',
      error_detail: whatsapp.ok ? null : whatsapp.error,
    })
  } else {
    details.push('WhatsApp not sent: contact has no WhatsApp id.')
  }

  const status = emailOk && whatsappOk ? 'sent' : emailOk || whatsappOk ? 'partial' : 'failed'
  return { status, detail: details.join(' ') }
}

async function getConferenceContactsFromInteractions(
  db: ConferenceContactDb,
  conferenceId: string
): Promise<{ ok: true; contacts: AssignedConferenceContact[] } | { ok: false; message: string }> {
  const interactionsResult = await db
    .from('comms_crm_interactions')
    .select('id, contact_id, summary, occurred_at')
    .ilike('summary', `%${assignmentToken(conferenceId)}%`)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (interactionsResult.error) return { ok: false, message: interactionsResult.error.message }

  const interactions = interactionsResult.data ?? []
  const latestByContact = new Map<string, Row>()
  for (const interaction of interactions) {
    const contactId = String(interaction.contact_id ?? '')
    if (contactId && !latestByContact.has(contactId)) latestByContact.set(contactId, interaction)
  }

  const contactIds = [...latestByContact.keys()]
  if (contactIds.length === 0) return { ok: true, contacts: [] }

  const contactsResult = await db
    .from('comms_crm_contacts')
    .select('id, full_name, email, phone, whatsapp_id, title, organisation')
    .in('id', contactIds)
    .limit(100)

  if (contactsResult.error) return { ok: false, message: contactsResult.error.message }
  const byId = new Map((contactsResult.data ?? []).map((row) => [String(row.id), contactOptionFromRow(row)]))

  return {
    ok: true,
    contacts: contactIds.flatMap((contactId) => {
      const contact = byId.get(contactId)
      const interaction = latestByContact.get(contactId)
      if (!contact || !interaction) return []
      const summary = String(interaction.summary ?? '')
      return [{
        ...contact,
        assignmentId: String(interaction.id),
        role: 'attendee',
        notificationStatus: notificationStatusFromSummary(summary),
        notificationDetail: notificationDetailFromSummary(summary),
        assignedAt: String(interaction.occurred_at),
      }]
    }),
  }
}

/** Add a discovered conference to the visit pipeline at the "intended" stage. */
export async function addConferenceToShortlist(conferenceId: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .upsert({ conference_id: conferenceId, stage: 'intended', added_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'conference_id' })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Move a tracked conference to a different pipeline stage. */
export async function setConferenceStage(conferenceId: string, stage: ConferenceStage): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!CONFERENCE_STAGES.includes(stage)) return { ok: false, message: 'Unknown stage.' }

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .upsert({ conference_id: conferenceId, stage, added_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'conference_id' })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Remove a conference from the pipeline entirely (back to "discovered"). */
export async function removeConferenceFromPipeline(conferenceId: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db.from('conference_tracking').delete().eq('conference_id', conferenceId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

/** Save free-text notes against a tracked conference. */
export async function setConferenceNotes(conferenceId: string, notes: string): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .update({ notes: notes.slice(0, 4000), updated_at: new Date().toISOString() })
    .eq('conference_id', conferenceId)
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return { ok: true }
}

// ── Conference prep (the "speaking" operating page) ──────────────────────────

function str(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function nullableId(formData: FormData, key: string): string | null {
  const value = str(formData, key)
  return value.length > 0 ? value : null
}

/** Tri-state presentation flag from a select: yes → true, no → false, else null. */
function parsePresentation(value: string): boolean | null {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

function parseKeyPeopleJson(raw: string): ConferenceKeyPerson[] {
  if (!raw) return []
  try {
    return parseKeyPeople(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * Save one stage section of a conference's prep record. The row is created
 * lazily on first save (upsert on conference_id). Each section only writes
 * the fields it owns, so saving "Follow-up" never clobbers "Registered".
 */
export async function saveConferencePrep(formData: FormData): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const conferenceId = str(formData, 'conference_id')
  const section = str(formData, 'section')
  if (!conferenceId) return { ok: false, message: 'Missing conference.' }

  const payload: Record<string, unknown> = { conference_id: conferenceId, updated_at: new Date().toISOString() }

  if (section === 'registered') {
    payload.has_presentation = parsePresentation(str(formData, 'has_presentation'))
    payload.presentation_title = str(formData, 'presentation_title').slice(0, 300) || null
    payload.abstract = str(formData, 'abstract').slice(0, 6000) || null
    payload.deck_url = str(formData, 'deck_url') || null
    payload.asset_urls = parseDelimitedList(str(formData, 'asset_urls'))
    payload.key_people = parseKeyPeopleJson(str(formData, 'key_people'))
    payload.comms_owner_id = nullableId(formData, 'comms_owner_id')
    payload.comms_contributor_id = nullableId(formData, 'comms_contributor_id')
  } else if (section === 'ongoing') {
    payload.photo_urls = parseDelimitedList(str(formData, 'photo_urls'))
    payload.takeaways = str(formData, 'takeaways').slice(0, 6000) || null
  } else if (section === 'follow_up') {
    payload.followup_notes = str(formData, 'followup_notes').slice(0, 6000) || null
    payload.podcast_event_id = nullableId(formData, 'podcast_event_id')
    payload.campus_session_id = nullableId(formData, 'campus_session_id')
  } else {
    return { ok: false, message: 'Unknown prep section.' }
  }

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db.from('conference_prep').upsert(payload, { onConflict: 'conference_id' })
  if (error) return { ok: false, message: error.message }

  revalidateConference(conferenceId)
  return { ok: true }
}

/** Flip a single boolean prep flag (checklist item / amplification output / idea toggle). */
export async function toggleConferencePrepFlag(
  conferenceId: string,
  flag: string,
  next: boolean
): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!conferenceId) return { ok: false, message: 'Missing conference.' }
  if (!isConferencePrepFlag(flag)) return { ok: false, message: 'Unknown prep field.' }

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db.from('conference_prep').upsert(
    { conference_id: conferenceId, [prepFlagColumn(flag)]: next, updated_at: new Date().toISOString() },
    { onConflict: 'conference_id' }
  )
  if (error) return { ok: false, message: error.message }

  revalidateConference(conferenceId)
  return { ok: true }
}

/**
 * Advance (or move) a conference to a pipeline stage from the operating page.
 * Shares the same write path as the stage dropdown but also revalidates the
 * conference's own page so the stepper reflects the new stage immediately.
 */
export async function advanceConferenceStage(conferenceId: string, stage: ConferenceStage): Promise<ActionResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!CONFERENCE_STAGES.includes(stage)) return { ok: false, message: 'Unknown stage.' }

  const db = auth.supabase as unknown as LooseDb
  const { error } = await db
    .from('conference_tracking')
    .upsert(
      { conference_id: conferenceId, stage, added_by: auth.userId, updated_at: new Date().toISOString() },
      { onConflict: 'conference_id' }
    )
  if (error) return { ok: false, message: error.message }

  revalidateConference(conferenceId)
  return { ok: true }
}

export type EnrichResult =
  | { ok: true; detail: ConferenceDetail; cached: boolean }
  | { ok: false; message: string }

/**
 * Gather (or return cached) rich detail for one conference. Detail is fetched
 * on first open and cached on the row, so subsequent opens are instant. Uses
 * the service role to write the cache (RLS write is comms-only anyway, but the
 * detail belongs to the shared list, not the user).
 */
export async function enrichConferenceDetail(conferenceId: string, options?: { refresh?: boolean }): Promise<EnrichResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const conference = await loadConference(auth.supabase, conferenceId)
  if (!conference) return { ok: false, message: 'Conference not found.' }

  // Serve the cache unless a refresh was explicitly requested.
  if (!options?.refresh && conference.detailStatus === 'ready' && conference.detail) {
    return { ok: true, detail: conference.detail, cached: true }
  }

  if (!isAiEnabled()) return { ok: false, message: 'AI features are disabled for this environment.' }

  const admin = createAdminClient() as unknown as LooseDb
  await admin.from('conferences').update({ detail_status: 'loading' }).eq('id', conferenceId)

  try {
    const detail = await enrichConference({
      name: conference.name,
      organizer: conference.organizer,
      location: conference.location,
      startDate: conference.startDate,
      endDate: conference.endDate,
      websiteUrl: conference.websiteUrl,
      sourceUrl: conference.sourceUrl,
    })
    await admin
      .from('conferences')
      .update({ detail, detail_status: 'ready', detail_fetched_at: new Date().toISOString() })
      .eq('id', conferenceId)
    revalidatePath(CONFERENCES_PATH)
    return { ok: true, detail, cached: false }
  } catch (error) {
    await admin.from('conferences').update({ detail_status: 'error' }).eq('id', conferenceId)
    return { ok: false, message: error instanceof Error ? error.message : 'Could not gather details for this conference.' }
  }
}

/** Find extra conferences using user-specified region/country/keyword criteria. */
export async function findMoreConferences(criteria: DiscoverMoreCriteria): Promise<DiscoverMoreResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!isAiEnabled()) return { ok: false, message: 'AI features are disabled for this environment.' }

  const admin = createAdminClient() as unknown as LooseDb
  const { data: existing, error } = await admin
    .from('conferences')
    .select('name, dedupe_key')
    .order('discovered_at', { ascending: false })
    .limit(600)
  if (error) return { ok: false, message: error.message }

  const existingNames = (existing ?? []).map((row) => String(row.name ?? '')).filter(Boolean)
  const existingKeys = new Set((existing ?? []).map((row) => String(row.dedupe_key ?? '')).filter(Boolean))

  try {
    const result = await findTargetedConferences({
      region: criteria.region ?? 'all',
      country: criteria.country ?? null,
      keywords: criteria.keywords ?? null,
      existingNames,
      createdBy: auth.userId,
    })
    const fresh = result.conferences.filter((conf) => !existingKeys.has(conf.dedupeKey))
    const message = fresh.length > 0
      ? `Found ${fresh.length} new conference${fresh.length === 1 ? '' : 's'} matching the criteria.`
      : `No new conferences found. The search returned ${result.validatedCount} valid result${result.validatedCount === 1 ? '' : 's'}, but they are already saved or did not match the criteria.`
    return { ok: true, conferences: fresh, message, candidateCount: result.candidateCount, validatedCount: result.validatedCount }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Targeted conference search failed.' }
  }
}

/** Add one or more targeted-search results to the shared conference list. */
export async function addDiscoveredConferences(conferences: DiscoveredConference[]): Promise<AddDiscoveredResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const validated = validateConferences({ conferences }, 'global', 12)
  if (validated.length === 0) return { ok: false, message: 'No valid conferences selected.' }

  const rows = validated.map((conf) => conferenceRow(conf, auth.userId))
  const admin = createAdminClient() as unknown as LooseDb
  const { error } = await admin.from('conferences').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (error) return { ok: false, message: error.message }

  revalidatePath(CONFERENCES_PATH)
  return {
    ok: true,
    inserted: rows.length,
    message: `Added ${rows.length} conference${rows.length === 1 ? '' : 's'} to the list.`,
  }
}

export async function searchConferenceContacts(query: string): Promise<{ ok: true; contacts: ConferenceContactOption[] } | { ok: false; message: string }> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const q = query.trim().replace(/[%_]/g, '')
  if (q.length < 2) return { ok: true, contacts: [] }

  const db = createAdminClient() as unknown as ConferenceContactDb
  const { data, error } = await db
    .from('comms_crm_contacts')
    .select('id, full_name, email, phone, whatsapp_id, title, organisation')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(8)

  if (error) return { ok: false, message: error.message }
  return { ok: true, contacts: (data ?? []).map(contactOptionFromRow) }
}

export async function getConferenceContacts(conferenceId: string): Promise<{ ok: true; contacts: AssignedConferenceContact[] } | { ok: false; message: string }> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth

  const db = createAdminClient() as unknown as ConferenceContactDb
  const assignmentsResult = await db
    .from('conference_contact_assignments')
    .select('id, contact_id, role, notification_status, notification_detail, assigned_at')
    .eq('conference_id', conferenceId)
    .order('assigned_at', { ascending: false })

  if (assignmentsResult.error) {
    if (isMissingAssignmentTable(assignmentsResult.error)) return getConferenceContactsFromInteractions(db, conferenceId)
    return { ok: false, message: assignmentsResult.error.message }
  }

  const assignments = assignmentsResult.data ?? []
  const contactIds = Array.from(new Set(assignments.map((row) => String(row.contact_id)).filter(Boolean)))
  if (contactIds.length === 0) return { ok: true, contacts: [] }

  const contactsResult = await db
    .from('comms_crm_contacts')
    .select('id, full_name, email, phone, whatsapp_id, title, organisation')
    .in('id', contactIds)
    .limit(100)

  if (contactsResult.error) return { ok: false, message: contactsResult.error.message }
  const byId = new Map((contactsResult.data ?? []).map((row) => [String(row.id), contactOptionFromRow(row)]))

  return {
    ok: true,
    contacts: assignments.flatMap((assignment) => {
      const contact = byId.get(String(assignment.contact_id))
      if (!contact) return []
      return [{
        ...contact,
        assignmentId: String(assignment.id),
        role: String(assignment.role ?? 'attendee'),
        notificationStatus: String(assignment.notification_status ?? 'queued'),
        notificationDetail: clean(String(assignment.notification_detail ?? ''), 600),
        assignedAt: String(assignment.assigned_at),
      }]
    }),
  }
}

export async function assignConferenceContact(input: AssignConferenceContactInput): Promise<{ ok: true; contact: ConferenceContactOption; message: string } | { ok: false; message: string }> {
  const auth = await requireCommsUser()
  if (!auth.ok) return auth
  if (!input.conferenceId) return { ok: false, message: 'Conference is required.' }

  const db = createAdminClient() as unknown as ConferenceContactDb
  const [conferenceResult, trackingResult] = await Promise.all([
    db.from('conferences').select('id, name').eq('id', input.conferenceId).maybeSingle(),
    db.from('conference_tracking').select('stage').eq('conference_id', input.conferenceId).maybeSingle(),
  ])

  if (conferenceResult.error) return { ok: false, message: conferenceResult.error.message }
  if (!conferenceResult.data) return { ok: false, message: 'Conference not found.' }
  if (String(trackingResult.data?.stage ?? '') !== 'registered') {
    return { ok: false, message: 'Contacts can be assigned once the conference is in the Registered stage.' }
  }

  let contact: ConferenceContactOption | null = null
  if (input.contactId) {
    const contactResult = await db
      .from('comms_crm_contacts')
      .select('id, full_name, email, phone, whatsapp_id, title, organisation')
      .eq('id', input.contactId)
      .maybeSingle()
    if (contactResult.error) return { ok: false, message: contactResult.error.message }
    if (!contactResult.data) return { ok: false, message: 'CRM contact not found.' }
    contact = contactOptionFromRow(contactResult.data)
  } else {
    const firstName = clean(input.firstName, 80)
    const lastName = clean(input.lastName, 80)
    const email = normalizeContactEmail(input.email)
    const whatsappId = clean(input.whatsappId, 80)
    if (!firstName || !lastName || !email) return { ok: false, message: 'First name, last name, and email are required.' }

    const existing = await db
      .from('comms_crm_contacts')
      .select('id, full_name, email, phone, whatsapp_id, title, organisation')
      .eq('normalized_email', email)
      .maybeSingle()
    if (existing.error) return { ok: false, message: existing.error.message }

    if (existing.data) {
      contact = contactOptionFromRow(existing.data)
    } else {
      const contactKind = email.endsWith('@inspire2live.org') ? 'internal_contact' : 'external'
      const created = await db
        .from('comms_crm_contacts')
        .insert({
          segment: contactKind === 'external' ? 'external' : 'internal',
          source_type: 'manual',
          full_name: `${firstName} ${lastName}`,
          contact_kind: contactKind,
          platform_status: 'none',
          email,
          whatsapp_id: whatsappId,
          preferred_channel: whatsappId ? 'WhatsApp / Email' : 'Email',
          lifecycle_stage: 'active',
          consent_status: 'unknown',
          source_label: 'Conference assignment',
          tags: ['conference-attendee'],
          notes: `Created from conference assignment for ${String(conferenceResult.data.name)}.`,
          created_by: auth.userId,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        })
        .select('id, full_name, email, phone, whatsapp_id, title, organisation')
        .maybeSingle()
      if (created.error) return { ok: false, message: created.error.message }
      if (!created.data) return { ok: false, message: 'Could not create the CRM contact.' }
      contact = contactOptionFromRow(created.data)
    }
  }

  const conferenceName = String(conferenceResult.data.name)
  const assignedAt = new Date().toISOString()
  const assignment = await db.from('conference_contact_assignments').upsert({
    conference_id: input.conferenceId,
    contact_id: contact.id,
    role: 'attendee',
    notification_status: 'skipped',
    notification_detail: null,
    assigned_by: auth.userId,
    assigned_at: assignedAt,
    updated_at: assignedAt,
  }, { onConflict: 'conference_id,contact_id' })
  if (assignment.error && !isMissingAssignmentTable(assignment.error)) return { ok: false, message: assignment.error.message }

  const interaction = await db.from('comms_crm_interactions').insert({
    contact_id: contact.id,
    interaction_type: 'event',
    summary: assignmentSummary(input.conferenceId, conferenceName),
    occurred_at: assignedAt,
    created_by: auth.userId,
  })
  if (interaction.error) return { ok: false, message: interaction.error.message }

  await db.from('comms_crm_contacts').update({
    lifecycle_stage: 'active',
    last_interaction_at: assignedAt,
    updated_by: auth.userId,
    updated_at: assignedAt,
  }).eq('id', contact.id)

  revalidatePath(CONFERENCES_PATH)
  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')

  return { ok: true, contact, message: `Assigned ${contact.fullName} to ${conferenceName}.` }
}
