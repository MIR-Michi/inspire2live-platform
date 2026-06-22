/**
 * lib/notify.ts
 *
 * Generic notification dispatcher. Fans out a single event to each channel
 * (in-app, email, WhatsApp) based on the recipient's notification_prefs.
 *
 * Usage:
 *   await notifyUser({ recipientId, event: 'task_assigned', title, body, linkUrl })
 *
 * WhatsApp is always a no-op until the API is configured.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

// ─── Event registry ───────────────────────────────────────────────────────────

export type NotificationEvent = 'task_assigned'

export const NOTIFICATION_EVENT_META: Record<
  NotificationEvent,
  { label: string; description: string }
> = {
  task_assigned: {
    label: 'Task assigned',
    description: 'Someone assigns a comms task to you',
  },
}

// ─── Channel types ────────────────────────────────────────────────────────────

export type NotificationChannels = {
  inApp: boolean
  email: boolean
  whatsapp: boolean
}

const CHANNEL_DEFAULTS: Record<NotificationEvent, NotificationChannels> = {
  task_assigned: { inApp: true, email: true, whatsapp: false },
}

type RawPrefs = Database['public']['Tables']['profiles']['Row']['notification_prefs']

export function resolveChannels(raw: RawPrefs, event: NotificationEvent): NotificationChannels {
  const defaults = CHANNEL_DEFAULTS[event]
  const prefs =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const eventPrefs =
    prefs.events &&
    typeof prefs.events === 'object' &&
    !Array.isArray(prefs.events) &&
    event in (prefs.events as object)
      ? (prefs.events as Record<string, Partial<NotificationChannels>>)[event]
      : {}
  return {
    inApp: eventPrefs?.inApp ?? defaults.inApp,
    email: eventPrefs?.email ?? defaults.email,
    whatsapp: false, // Always off until WhatsApp API is live
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export type NotifyParams = {
  recipientId: string
  event: NotificationEvent
  title: string
  body: string
  linkUrl?: string
}

export async function notifyUser(params: NotifyParams): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: recipient } = await admin
      .from('profiles')
      .select('email, notification_prefs')
      .eq('id', params.recipientId)
      .maybeSingle()

    if (!recipient) return

    const channels = resolveChannels(recipient.notification_prefs, params.event)

    if (channels.inApp) {
      await admin.from('notifications').insert({
        user_id: params.recipientId,
        type: params.event,
        title: params.title,
        body: params.body,
        is_read: false,
        link_url: params.linkUrl ?? null,
      })
    }

    if (channels.email && recipient.email && process.env.RESEND_API_KEY) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://i2l.austriq.com'
      const actionUrl = params.linkUrl ? `${base}${params.linkUrl}` : `${base}/app/dashboard`
      await sendNotificationEmail({
        to: recipient.email,
        subject: params.title,
        body: params.body,
        actionUrl,
      })
    }

    // WhatsApp: no-op until API is wired
  } catch {
    // Notification failure must never break the calling action
  }
}

// ─── Email delivery ───────────────────────────────────────────────────────────

async function sendNotificationEmail(params: {
  to: string
  subject: string
  body: string
  actionUrl: string
}) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
      to: [params.to],
      subject: params.subject,
      html: buildNotificationHtml(params),
    }),
  }).catch(() => {/* ignore delivery errors */})
}

function buildNotificationHtml(params: { subject: string; body: string; actionUrl: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#ea580c;padding:20px 32px;">
          <p style="margin:0;color:#fff;font-size:17px;font-weight:700;">Inspire2Live</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 10px;color:#111827;font-size:17px;">${params.subject}</h2>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${params.body}</p>
          <a href="${params.actionUrl}"
             style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;">
            Open →
          </a>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© Inspire2Live · You can manage notification preferences in your profile settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
