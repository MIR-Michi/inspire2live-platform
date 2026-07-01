/**
 * lib/invitation-email.ts
 *
 * Email dispatch for invitation-style messages.
 *
 * Transport strategy:
 *   - Prefer Resend when RESEND_API_KEY is configured.
 *   - Fall back to SendGrid when SENDGRID_API_KEY is configured.
 *   - If neither provider is configured, log the intended email and return a
 *     non-sent result so callers can surface a useful setup message.
 *
 * The sendInviteEmail path also writes an email_log audit trail regardless of
 * transport outcome.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface SendInviteEmailParams {
  supabase: SupabaseClient<Database>
  invitationId: string
  recipientEmail: string
  recipientName?: string
  inviterName: string
  scope: 'initiative' | 'congress'
  targetTitle: string
  inviteeRole: string
  message?: string
  /** Absolute base URL e.g. https://app.inspire2live.org */
  baseUrl: string
}

export interface EmailResult {
  sent: boolean
  error?: string
}

export interface SendTransactionalEmailParams {
  recipientEmail: string
  subject: string
  htmlBody: string
  logContext?: Record<string, unknown>
}

/**
 * Sends a transactional platform email through the configured app provider.
 */
export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<EmailResult> {
  if (hasEmailProviderConfigured()) {
    return attemptEmailDelivery(params)
  }

  console.info('[invitation-email] No email provider configured. Would send:', {
    to: params.recipientEmail,
    subject: params.subject,
    ...params.logContext,
  })
  return { sent: false, error: 'No email provider configured (RESEND_API_KEY / SENDGRID_API_KEY missing).' }
}

/**
 * Sends an invitation email and logs the result to email_log.
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<EmailResult> {
  const {
    supabase,
    invitationId,
    recipientEmail,
    recipientName,
    inviterName,
    scope,
    targetTitle,
    inviteeRole,
    message,
    baseUrl,
  } = params

  const subject = scope === 'initiative'
    ? `You've been invited to join an initiative on Inspire2Live`
    : `You've been invited to a congress on Inspire2Live`

  const actionUrl = `${baseUrl}/app/notifications`
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,'

  const htmlBody = buildEmailHtml({
    greeting,
    inviterName,
    scope,
    targetTitle,
    inviteeRole,
    message,
    actionUrl,
  })

  const providerConfigured = hasEmailProviderConfigured()
  const result = await sendTransactionalEmail({
    recipientEmail,
    subject,
    htmlBody,
    logContext: { scope, targetTitle, inviteeRole },
  })

  // ── Write audit log ───────────────────────────────────────────────────────

  await (supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> })
    .from('email_log')
    .insert({
      invitation_id: invitationId,
      recipient_email: recipientEmail,
      subject,
      status: result.sent ? 'sent' : providerConfigured ? 'failed' : 'skipped',
      error_message: result.error ?? null,
      sent_at: result.sent ? new Date().toISOString() : null,
    })
    .then(() => {/* fire and forget */})

  return result
}

// ─── Delivery implementation ──────────────────────────────────────────────────

function hasEmailProviderConfigured(): boolean {
  return !!process.env.RESEND_API_KEY || !!process.env.SENDGRID_API_KEY
}

async function attemptEmailDelivery(params: {
  recipientEmail: string
  subject: string
  htmlBody: string
}): Promise<EmailResult> {
  // Resend API (https://resend.com) — minimal integration
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
          to: [params.recipientEmail],
          subject: params.subject,
          html: params.htmlBody,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        return { sent: false, error: `Resend API error ${res.status}: ${body}` }
      }

      return { sent: true }
    } catch (err) {
      return { sent: false, error: String(err) }
    }
  }

  // SendGrid API fallback
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.recipientEmail }] }],
          from: { email: process.env.EMAIL_FROM ?? 'no-reply@inspire2live.org' },
          subject: params.subject,
          content: [{ type: 'text/html', value: params.htmlBody }],
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        return { sent: false, error: `SendGrid error ${res.status}: ${body}` }
      }

      return { sent: true }
    } catch (err) {
      return { sent: false, error: String(err) }
    }
  }

  return { sent: false, error: 'No supported email provider configured.' }
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildEmailHtml(params: {
  greeting: string
  inviterName: string
  scope: 'initiative' | 'congress'
  targetTitle: string
  inviteeRole: string
  message?: string
  actionUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inspire2Live Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#ea580c;padding:28px 32px;">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">Inspire2Live</p>
              <p style="margin:4px 0 0;color:#fed7aa;font-size:13px;">Empowering patients and researchers together</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#1a1a1a;font-size:16px;">${params.greeting}</p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                <strong>${params.inviterName}</strong> has invited you to join
                <strong>"${params.targetTitle}"</strong> as a
                <strong>${params.inviteeRole}</strong> on the Inspire2Live platform.
              </p>
              ${params.message ? `
              <div style="margin:0 0 24px;padding:16px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:4px;">
                <p style="margin:0;color:#9a3412;font-size:14px;font-style:italic;">"${params.message}"</p>
              </div>` : ''}
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                Log in to your Inspire2Live account to accept or decline this invitation.
              </p>
              <!-- CTA -->
              <table>
                <tr>
                  <td style="border-radius:8px;background:#ea580c;">
                    <a href="${params.actionUrl}"
                       style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      View Invitation →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © Inspire2Live · Advancing cancer research together
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
