'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteUserAccount } from '@/app/app/admin/users/actions'
import { isPlatformAdmin, normalizeRole, type PlatformRole } from '@/lib/role-access'

export type AccessDecisionState = {
  ok: boolean
  error?: string
  message?: string
}

const INVITABLE_ROLES = new Set<PlatformRole>([
  'PatientAdvocate',
  'Clinician',
  'Researcher',
  'Moderator',
  'Comms',
  'HubCoordinator',
  'IndustryPartner',
  'BoardMember',
])

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isPlatformAdmin(normalizeRole(profile?.role))) {
    return { ok: false as const, error: 'Only a PlatformAdmin can approve or decline platform access.' }
  }

  return { ok: true as const, userId: user.id }
}

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  if (host) return `${protocol}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
}

async function sendDecisionEmail(input: {
  email: string
  name: string
  conferenceName: string
  approved: boolean
  responseMessage: string
  alreadyActive: boolean
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return false

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
  const headline = input.approved ? 'Your Inspire2Live access request was approved' : 'Update on your Inspire2Live access request'
  const primaryText = input.approved
    ? input.alreadyActive
      ? 'Your existing account already has access. You can open the platform now.'
      : 'Your request was approved. A separate account invitation email has been sent to you.'
    : 'Your request was not approved at this time.'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
      to: [input.email],
      subject: headline,
      html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:20px 32px;color:#fff;font-weight:700;">Inspire2Live</td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">${escapeHtml(headline)}</h2>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;">Hello ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;">${escapeHtml(primaryText)}</p>
          <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Conference: ${escapeHtml(input.conferenceName)}</p>
          ${input.responseMessage ? `<div style="margin:0 0 20px;padding:14px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:4px;color:#9a3412;font-size:14px;">${escapeHtml(input.responseMessage)}</div>` : ''}
          ${input.approved && input.alreadyActive ? `<a href="${escapeHtml(base)}/app" style="display:inline-block;padding:10px 22px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open platform →</a>` : ''}
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

export async function decideGuestAccessRequest(
  _previous: AccessDecisionState,
  formData: FormData
): Promise<AccessDecisionState> {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const requestId = text(formData.get('requestId'), 100)
  const decision = text(formData.get('decision'), 20)
  const responseMessage = text(formData.get('responseMessage'))
  const requestedRole = normalizeRole(text(formData.get('role'), 50))

  if (!requestId || !['approve', 'decline'].includes(decision)) {
    return { ok: false, error: 'Invalid access decision.' }
  }
  if (decision === 'approve' && !INVITABLE_ROLES.has(requestedRole)) {
    return { ok: false, error: 'Select a valid non-admin platform role.' }
  }

  const admin = createAdminClient()
  // Migration 00165 adds fields not yet represented in the checked-in generated
  // Database type, so this narrow workflow uses the runtime client until types
  // are regenerated from the deployed schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessDb = admin as any
  const { data: request, error: requestError } = await accessDb
    .from('conference_guest_access_requests')
    .select('id, status, contact_name, contact_email, conference_guest_submissions(submitter_name, submitter_email, conference_name)')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError || !request) return { ok: false, error: 'Access request not found.' }
  if (request.status !== 'pending') return { ok: false, error: 'This access request has already been reviewed.' }

  const submission = Array.isArray(request.conference_guest_submissions)
    ? request.conference_guest_submissions[0]
    : request.conference_guest_submissions
  const name = String(request.contact_name ?? submission?.submitter_name ?? 'Conference guest')
  const email = String(request.contact_email ?? submission?.submitter_email ?? '').trim().toLowerCase()
  const conferenceName = String(submission?.conference_name ?? 'Conference')

  if (!email || !email.includes('@')) {
    return { ok: false, error: 'This request has no valid email address.' }
  }

  let alreadyActive = false
  if (decision === 'approve') {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, onboarding_completed')
      .ilike('email', email)
      .maybeSingle()

    alreadyActive = Boolean(existingProfile?.id && existingProfile.onboarding_completed)
    if (!alreadyActive) {
      const result = await inviteUserAccount(email, requestedRole, await requestOrigin())
      if (result.error) return { ok: false, error: result.error }
    }
  }

  const status = decision === 'approve' ? 'granted' : 'declined'
  const { error: updateError } = await accessDb
    .from('conference_guest_access_requests')
    .update({
      status,
      requested_role: requestedRole,
      response_message: responseMessage || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (updateError) return { ok: false, error: updateError.message }

  const notified = await sendDecisionEmail({
    email,
    name,
    conferenceName,
    approved: decision === 'approve',
    responseMessage,
    alreadyActive,
  })

  revalidatePath('/app/comms/conferences/submissions')
  revalidatePath('/app/admin/users')

  const outcome = decision === 'approve'
    ? alreadyActive ? 'Access confirmed for the existing user.' : 'Request approved and platform invitation sent.'
    : 'Request declined.'

  return {
    ok: true,
    message: notified ? `${outcome} Decision email sent.` : `${outcome} Decision saved, but the email could not be sent.`,
  }
}
