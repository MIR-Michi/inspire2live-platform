'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'

const CONFERENCES_PATH = '/app/comms/conferences'

type RemovalRecipient = {
  submissionId?: string
  name?: string | null
  email?: string | null
  status?: string | null
}

type RemovalRpcResult = {
  conferenceId?: string | null
  conferenceName?: string | null
  recipients?: RemovalRecipient[] | null
  storagePaths?: string[] | null
  removedSubmissions?: number | null
}

export type ConferenceRemovalResult =
  | {
      ok: true
      message: string
      notified: number
      notificationFailures: number
      removedGuestEntries: number
    }
  | {
      ok: false
      message: string
      requiresConfirmation?: false
    }
  | {
      ok: false
      message: string
      requiresConfirmation: true
      attendeeCount: number
      attendeeNames: string[]
    }

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email && email.includes('@') ? email : null
}

function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  return name || 'Conference guest'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function uniqueRecipients(rows: RemovalRecipient[]): Array<{ name: string; email: string | null }> {
  const unique = new Map<string, { name: string; email: string | null }>()

  for (const row of rows) {
    const name = cleanName(row.name)
    const email = normalizeEmail(row.email)
    const key = email ?? `${name.toLowerCase()}:${String(row.submissionId ?? '')}`
    if (!unique.has(key)) unique.set(key, { name, email })
  }

  return [...unique.values()]
}

async function requireCommsUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!canAccessCommsWorkspace(profile?.role)) {
    return { ok: false as const, message: 'You do not have access to the Conferences workspace.' }
  }

  return { ok: true as const, supabase }
}

async function loadRemovalImpact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conferenceId: string
): Promise<{ recipients: Array<{ name: string; email: string | null }> } | { error: string }> {
  // Migration 00166 does not change generated table types; use a narrow dynamic
  // query for the existing guest tables and normalize the result immediately.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('conference_guest_submissions')
    .select(`
      id,
      submitter_name,
      submitter_email,
      status,
      conference_guest_tokens(contact_name, contact_email)
    `)
    .eq('conference_id', conferenceId)
    .neq('status', 'rejected')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const rows: RemovalRecipient[] = (data ?? []).map((row: Record<string, unknown>) => {
    const token = Array.isArray(row.conference_guest_tokens)
      ? row.conference_guest_tokens[0]
      : row.conference_guest_tokens
    const tokenRow = token && typeof token === 'object' ? token as Record<string, unknown> : {}

    return {
      submissionId: String(row.id ?? ''),
      name: String(row.submitter_name ?? tokenRow.contact_name ?? 'Conference guest'),
      email: String(row.submitter_email ?? tokenRow.contact_email ?? ''),
      status: String(row.status ?? ''),
    }
  })

  return { recipients: uniqueRecipients(rows) }
}

async function sendRemovalEmail(input: {
  email: string
  name: string
  conferenceName: string
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
      to: [input.email],
      subject: `${input.conferenceName} was removed from the Inspire2Live shortlist`,
      html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:20px 32px;color:#fff;font-weight:700;">Inspire2Live</td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Conference attendance update</h2>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;">Hello ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;">
            The Inspire2Live team removed <strong>${escapeHtml(input.conferenceName)}</strong> from its conference shortlist.
          </p>
          <p style="margin:0;color:#374151;font-size:15px;">
            It has therefore also been removed from your conference workspace. You are no longer listed as attending through Inspire2Live and no action is required from you.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }),
  }).catch(() => null)

  return Boolean(response?.ok)
}

/**
 * Remove one conference from the team pipeline.
 *
 * The first call is an impact check. If active guest attendees exist, it returns
 * `requiresConfirmation` without changing data. The client must ask the user and
 * call again with `confirmed=true`. The confirmed path atomically removes the
 * tracking row and all guest entries, then emails the affected attendees.
 */
export async function removeConferenceFromPipelineSafely(
  conferenceId: string,
  confirmed = false
): Promise<ConferenceRemovalResult> {
  const auth = await requireCommsUser()
  if (!auth.ok) return { ok: false, message: auth.message }
  if (!conferenceId) return { ok: false, message: 'Missing conference.' }

  const impact = await loadRemovalImpact(auth.supabase, conferenceId)
  if ('error' in impact) return { ok: false, message: impact.error }

  if (impact.recipients.length > 0 && !confirmed) {
    const attendeeCount = impact.recipients.length
    return {
      ok: false,
      requiresConfirmation: true,
      attendeeCount,
      attendeeNames: impact.recipients.map((recipient) => recipient.name),
      message: `${attendeeCount} guest attendee${attendeeCount === 1 ? '' : 's'} will be removed and informed by email.`,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any).rpc(
    'remove_conference_from_pipeline_with_guests',
    { p_conference_id: conferenceId }
  )

  if (error) {
    return {
      ok: false,
      message: error.message?.includes('not_authorized')
        ? 'You are not allowed to remove this conference.'
        : error.message ?? 'Could not remove the conference.',
    }
  }

  const result = (data ?? {}) as RemovalRpcResult
  const conferenceName = cleanName(result.conferenceName ?? 'Conference')
  const recipients = uniqueRecipients(Array.isArray(result.recipients) ? result.recipients : [])
  const storagePaths = Array.isArray(result.storagePaths)
    ? result.storagePaths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []

  if (storagePaths.length > 0) {
    const admin = createAdminClient()
    await admin.storage.from('congress-guest-uploads').remove(storagePaths).catch(() => null)
  }

  const emailRecipients = recipients.filter(
    (recipient): recipient is { name: string; email: string } => Boolean(recipient.email)
  )
  const notificationResults = await Promise.all(
    emailRecipients.map((recipient) => sendRemovalEmail({
      email: recipient.email,
      name: recipient.name,
      conferenceName,
    }))
  )
  const notified = notificationResults.filter(Boolean).length
  const recipientsWithoutEmail = recipients.length - emailRecipients.length
  const notificationFailures = notificationResults.length - notified + recipientsWithoutEmail
  const removedGuestEntries = Number(result.removedSubmissions ?? 0)

  revalidatePath(CONFERENCES_PATH)
  revalidatePath(`${CONFERENCES_PATH}/${conferenceId}`)
  revalidatePath(`${CONFERENCES_PATH}/submissions`)

  const notificationSummary = recipients.length === 0
    ? ''
    : notificationFailures === 0
      ? ` ${notified} attendee${notified === 1 ? '' : 's'} informed by email.`
      : ` ${notified} email${notified === 1 ? '' : 's'} sent; ${notificationFailures} notification${notificationFailures === 1 ? '' : 's'} could not be delivered.`

  return {
    ok: true,
    notified,
    notificationFailures,
    removedGuestEntries,
    message: `${conferenceName} was removed from the shortlist.${notificationSummary}`,
  }
}
