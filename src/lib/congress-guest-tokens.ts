import 'server-only'
import { createHash, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/whatsapp-send'

export type TokenContact = {
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  conferenceId?: string
}

export type CreateTokenResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string }

/**
 * Creates a magic-link token for a CRM contact and returns the URL.
 * The raw token is returned once — we only store its SHA-256 hash.
 */
export async function createGuestToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  adminUserId: string,
  contact: TokenContact
): Promise<CreateTokenResult> {
  const rawToken = randomUUID()
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
  const url = `${baseUrl}/congress/attend/${rawToken}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('conference_guest_tokens').insert({
    token_hash: tokenHash,
    contact_id: contact.contactId ?? null,
    contact_name: contact.contactName ?? null,
    contact_email: contact.contactEmail ?? null,
    contact_phone: contact.contactPhone ?? null,
    conference_id: contact.conferenceId ?? null,
    created_by: adminUserId,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, token: rawToken, url }
}

export type SendResult = { channel: 'whatsapp' | 'email'; ok: boolean; error?: string }

/**
 * Sends the magic link to the contact via WhatsApp and/or email.
 */
export async function sendGuestTokenLink(params: {
  url: string
  conferenceName?: string
  contactName?: string
  contactPhone?: string | null
  contactEmail?: string | null
  channels: { whatsapp: boolean; email: boolean }
}): Promise<SendResult[]> {
  const results: SendResult[] = []
  const { url, conferenceName, contactName, contactPhone, contactEmail, channels } = params

  const greeting = contactName ? `Hi ${contactName}` : 'Hi'
  const confPart = conferenceName ? ` for *${conferenceName}*` : ''

  const whatsappText =
    `${greeting}! 👋\n\n` +
    `Inspire2Live would love to know about your conference attendance${confPart}.\n\n` +
    `Please fill in this quick form (less than 1 minute):\n${url}\n\n` +
    `Thank you! 🙏`

  const emailHtml = buildGuestEmailHtml({ greeting, confPart, url })

  if (channels.whatsapp && contactPhone) {
    const wa = await sendWhatsAppMessage(contactPhone, whatsappText)
    results.push({ channel: 'whatsapp', ok: wa.ok, error: wa.ok ? undefined : wa.error })
  }

  if (channels.email && contactEmail) {
    const emailResult = await sendGuestEmail({
      to: contactEmail,
      subject: 'Share your conference attendance with Inspire2Live',
      html: emailHtml,
    })
    results.push({ channel: 'email', ok: emailResult.ok, error: emailResult.error })
  }

  return results
}

async function sendGuestEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'Email not configured (RESEND_API_KEY missing).' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Resend ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function buildGuestEmailHtml(params: {
  greeting: string
  confPart: string
  url: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">Inspire2Live</p>
          <p style="margin:4px 0 0;color:#fed7aa;font-size:12px;">Empowering patients and researchers together</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#111827;font-size:15px;">${params.greeting}!</p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
            Inspire2Live would love to know about your conference attendance${params.confPart}.
            Could you take a moment to fill in a quick form?
          </p>
          <table><tr><td style="border-radius:8px;background:#ea580c;">
            <a href="${params.url}"
               style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
              Fill in the form →
            </a>
          </td></tr></table>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">
            Or copy this link: ${params.url}
          </p>
          <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
            This link is personal and expires after 90 days. If you received this by mistake, you can safely ignore it.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© Inspire2Live · Advancing cancer research together</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
