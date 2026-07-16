/**
 * POST /api/congress-guest/request-access
 *
 * Public: records a full-platform access request and notifies the creator.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''

  if (!token || !submissionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, anonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creatorEmail, error } = await (supabase as any).rpc('request_guest_access', {
    p_raw_token: token,
    p_sub_id: submissionId,
    p_message: message || null,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 403 })
    }
    if (error.message?.includes('already_has_access')) {
      return NextResponse.json({
        error: 'This email already has access to the Inspire2Live platform.',
        code: 'already_has_access',
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not record request.' }, { status: 500 })
  }

  // Resolve the newly-created request so the notification says who requested
  // access and for which conference, instead of sending an anonymous alert.
  const resendKey = process.env.RESEND_API_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let requesterName = 'Conference guest'
  let requesterEmail = ''
  let conferenceName = 'a conference'

  if (serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: accessRequest } = await (admin as any)
      .from('conference_guest_access_requests')
      .select('contact_name, contact_email, conference_guest_submissions(conference_name)')
      .eq('submission_id', submissionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (accessRequest) {
      requesterName = String(accessRequest.contact_name ?? requesterName)
      requesterEmail = String(accessRequest.contact_email ?? '')
      const submission = Array.isArray(accessRequest.conference_guest_submissions)
        ? accessRequest.conference_guest_submissions[0]
        : accessRequest.conference_guest_submissions
      conferenceName = String(submission?.conference_name ?? conferenceName)
    }
  }

  // Notify the original inviter. The actionable queue itself lives on the
  // conference attendance reports page and can be resolved by a PlatformAdmin.
  if (resendKey && typeof creatorEmail === 'string' && creatorEmail) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
    void fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
        to: [creatorEmail],
        subject: `Platform access request from ${requesterName}`,
        html: buildAccessRequestHtml({
          requesterName,
          requesterEmail,
          conferenceName,
          message,
          reviewUrl: `${base}/app/comms/conferences/submissions#access-requests`,
        }),
      }),
    }).catch(() => {/* best-effort */})
  }

  return NextResponse.json({ ok: true })
}

function buildAccessRequestHtml(p: {
  requesterName: string
  requesterEmail: string
  conferenceName: string
  message: string
  reviewUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:20px 32px;">
          <p style="margin:0;color:#fff;font-size:17px;font-weight:700;">Inspire2Live</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:17px;">Platform access request</h2>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;">
            <strong>${escapeHtml(p.requesterName)}</strong>${p.requesterEmail ? ` (${escapeHtml(p.requesterEmail)})` : ''} requested platform access after responding for ${escapeHtml(p.conferenceName)}.
          </p>
          ${p.message ? `<div style="margin:16px 0 20px;padding:14px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:4px;">
            <p style="margin:0;color:#9a3412;font-size:14px;font-style:italic;">${escapeHtml(p.message)}</p>
          </div>` : ''}
          <a href="${escapeHtml(p.reviewUrl)}" style="display:inline-block;padding:10px 22px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
            Review request →
          </a>
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
