/**
 * POST /api/congress-guest/submit
 *
 * Public: submits a conference attendance form via a guest magic-link token.
 * On success: sends email notification to the token creator and returns the
 * submissionId so the client can redirect to the workspace.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const submitterName = typeof body.submitterName === 'string' ? body.submitterName.trim() : ''
  const conferenceName = typeof body.conferenceName === 'string' ? body.conferenceName.trim() : ''

  if (!token || !submitterName || !conferenceName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('submit_conference_guest_form', {
    p_raw_token: token,
    p_submitter_name: submitterName,
    p_submitter_email: (body.submitterEmail as string | null) ?? null,
    p_submitter_phone: (body.submitterPhone as string | null) ?? null,
    p_submitter_org: (body.submitterOrg as string | null) ?? null,
    p_conference_id: (body.conferenceId as string | null) ?? null,
    p_conference_name: conferenceName,
    p_conference_start: (body.conferenceStart as string | null) ?? null,
    p_conference_end: (body.conferenceEnd as string | null) ?? null,
    p_conference_location: (body.conferenceLocation as string | null) ?? null,
    p_role: (body.role as string | null) ?? 'attendee',
    p_notes: (body.notes as string | null) ?? null,
    p_is_registered: (body.isRegistered as boolean | null) ?? false,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 403 })
    }
    console.error('[congress-guest/submit] RPC error', error)
    return NextResponse.json({ error: 'Could not save your submission.' }, { status: 500 })
  }

  const result = data as { submissionId: string; creatorId: string }

  // Fire-and-forget: notify the creator and comms team.
  void sendSubmissionNotification({
    creatorId: result.creatorId,
    submitterName,
    conferenceName,
    role: (body.role as string | null) ?? 'attendee',
    token,
  })

  return NextResponse.json({ ok: true, submissionId: result.submissionId })
}

async function sendSubmissionNotification(params: {
  creatorId: string
  submitterName: string
  conferenceName: string
  role: string
  token: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  // Fetch creator email via service role (we need auth.users access).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Get creator email
    const { data: authUser } = await admin.auth.admin.getUserById(params.creatorId)
    const creatorEmail = authUser?.user?.email

    // Get comms team emails
    const { data: commsProfiles } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['Comms', 'PlatformAdmin'])
      .not('email', 'is', null)
      .limit(20)

    const recipients = [
      ...new Set([
        ...(creatorEmail ? [creatorEmail] : []),
        ...((commsProfiles ?? []).map((p: { email: string }) => p.email).filter(Boolean)),
      ]),
    ]

    if (recipients.length === 0) return

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
    const reviewUrl = `${base}/app/admin/guest-submissions`
    const workspaceUrl = `${base}/congress/attend/${params.token}/workspace`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
        to: recipients,
        subject: `New attendance report: ${params.submitterName} at ${params.conferenceName}`,
        html: buildNotificationHtml({
          submitterName: params.submitterName,
          conferenceName: params.conferenceName,
          role: params.role,
          reviewUrl,
          workspaceUrl,
        }),
      }),
    })
  } catch {
    // Notification failure must not affect the response
  }
}

function buildNotificationHtml(p: {
  submitterName: string
  conferenceName: string
  role: string
  reviewUrl: string
  workspaceUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:20px 32px;">
          <p style="margin:0;color:#fff;font-size:17px;font-weight:700;">Inspire2Live</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:17px;">New conference attendance report</h2>
          <p style="margin:0 0 6px;color:#374151;font-size:15px;">
            <strong>${p.submitterName}</strong> reported attending
            <strong>${p.conferenceName}</strong> as <strong>${p.role}</strong>.
          </p>
          <p style="margin:16px 0 24px;color:#6b7280;font-size:14px;">
            They have access to a guest workspace to add photos, presentations and a meeting summary.
          </p>
          <table style="border-spacing:8px;border-collapse:separate;">
            <tr>
              <td style="border-radius:8px;background:#ea580c;">
                <a href="${p.reviewUrl}" style="display:inline-block;padding:10px 20px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                  Review submission →
                </a>
              </td>
              <td style="border-radius:8px;background:#fff;border:1px solid #e5e7eb;">
                <a href="${p.workspaceUrl}" style="display:inline-block;padding:10px 20px;color:#374151;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                  Guest workspace →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© Inspire2Live</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
