/**
 * comms-conference-invites.ts
 *
 * Loader + writer helpers for the conference guest invite log (Sprint 18,
 * migration 00162). The log answers "who did we invite, how, when, and did it
 * land" — surfaced on the operating page and the overview.
 *
 * Writes go through the admin client from the server action so the background
 * send can update delivery status even without a user session; the loader runs
 * under the caller's RLS (comms/admin only).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type ConferenceInviteChannel = 'email' | 'whatsapp'
export type ConferenceInviteStatus = 'queued' | 'sent' | 'partial' | 'failed'

export type ConferenceInvite = {
  id: string
  conferenceId: string | null
  recipientName: string | null
  recipientEmail: string | null
  recipientPhone: string | null
  channels: ConferenceInviteChannel[]
  emailStatus: 'sent' | 'failed' | null
  whatsappStatus: 'sent' | 'failed' | null
  status: ConferenceInviteStatus
  detail: string | null
  createdAt: string
  sentAt: string | null
}

const INVITE_COLUMNS =
  'id, conference_id, recipient_name, recipient_email, recipient_phone, channels, email_status, whatsapp_status, status, detail, created_at, sent_at'

function asChannelArray(value: unknown): ConferenceInviteChannel[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => (v === 'email' || v === 'whatsapp' ? [v] : []))
}

function rowToInvite(row: Record<string, unknown>): ConferenceInvite {
  const email = row.email_status === 'sent' || row.email_status === 'failed' ? row.email_status : null
  const whatsapp = row.whatsapp_status === 'sent' || row.whatsapp_status === 'failed' ? row.whatsapp_status : null
  const status = ['queued', 'sent', 'partial', 'failed'].includes(String(row.status))
    ? (String(row.status) as ConferenceInviteStatus)
    : 'queued'
  return {
    id: String(row.id),
    conferenceId: (row.conference_id as string | null) ?? null,
    recipientName: (row.recipient_name as string | null) ?? null,
    recipientEmail: (row.recipient_email as string | null) ?? null,
    recipientPhone: (row.recipient_phone as string | null) ?? null,
    channels: asChannelArray(row.channels),
    emailStatus: email,
    whatsappStatus: whatsapp,
    status,
    detail: (row.detail as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    sentAt: (row.sent_at as string | null) ?? null,
  }
}

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          opts: { ascending: boolean }
        ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      }
    }
  }
}

/** Load the invite log for one conference, newest first. Best-effort. */
export async function loadConferenceInvites(
  supabase: SupabaseClient<Database>,
  conferenceId: string
): Promise<ConferenceInvite[]> {
  const db = supabase as unknown as LooseDb
  try {
    const { data, error } = await db
      .from('conference_guest_invites')
      .select(INVITE_COLUMNS)
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []).map(rowToInvite)
  } catch (error) {
    console.error('[conferences] loadConferenceInvites failed', error)
    return []
  }
}

export type LogInviteInput = {
  tokenId?: string | null
  conferenceId?: string | null
  contactId?: string | null
  recipientName?: string | null
  recipientEmail?: string | null
  recipientPhone?: string | null
  channels: ConferenceInviteChannel[]
  invitedBy: string
}

type InsertDb = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from2?: any
}

/**
 * Insert a queued invite row and return its id. Best-effort: a failure here
 * must never block sending the invite, so callers treat a null id as "not
 * logged" rather than an error.
 */
export async function logConferenceInvite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: LogInviteInput
): Promise<string | null> {
  try {
    const db = admin as InsertDb
    const { data, error } = await db
      .from('conference_guest_invites')
      .insert({
        token_id: input.tokenId ?? null,
        conference_id: input.conferenceId ?? null,
        contact_id: input.contactId ?? null,
        recipient_name: input.recipientName ?? null,
        recipient_email: input.recipientEmail ?? null,
        recipient_phone: input.recipientPhone ?? null,
        channels: input.channels,
        status: 'queued',
        invited_by: input.invitedBy,
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return String(data.id)
  } catch {
    return null
  }
}

export type InviteSendOutcome = {
  emailStatus?: 'sent' | 'failed' | null
  whatsappStatus?: 'sent' | 'failed' | null
  detail?: string | null
}

/** Roll per-channel outcomes into an overall status. */
export function rollUpInviteStatus(outcome: InviteSendOutcome): ConferenceInviteStatus {
  const results = [outcome.emailStatus, outcome.whatsappStatus].filter(
    (s): s is 'sent' | 'failed' => s === 'sent' || s === 'failed'
  )
  if (results.length === 0) return 'queued'
  if (results.every((s) => s === 'sent')) return 'sent'
  if (results.every((s) => s === 'failed')) return 'failed'
  return 'partial'
}

/** Update a queued invite with the resolved per-channel delivery status. */
export async function updateConferenceInviteResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  inviteId: string,
  outcome: InviteSendOutcome
): Promise<void> {
  try {
    await admin
      .from('conference_guest_invites')
      .update({
        email_status: outcome.emailStatus ?? null,
        whatsapp_status: outcome.whatsappStatus ?? null,
        status: rollUpInviteStatus(outcome),
        detail: outcome.detail ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
  } catch (error) {
    console.error('[conferences] updateConferenceInviteResult failed', error)
  }
}
