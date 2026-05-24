import { formatInTimeZone } from 'date-fns-tz'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { CONTENT_TYPE_META, getDigestTime, getDigestWindowLabel } from '@/lib/comms-workflow'

type AdminClient = SupabaseClient<Database>
type IntakeRow = Database['public']['Tables']['intake_items']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type DigestItem = Pick<IntakeRow, 'id' | 'sender_name' | 'content_type' | 'raw_content' | 'source_url' | 'captured_at'>

const DIGEST_ITEM_SELECT = 'id, sender_name, content_type, raw_content, source_url, captured_at'

type DigestRecipient = Pick<
  ProfileRow,
  'id' | 'email' | 'name' | 'role' | 'timezone' | 'notification_prefs' | 'comms_team'
>

interface SendDigestOptions {
  supabase: AdminClient
  recipient: DigestRecipient
  baseUrl: string
  now?: Date
  reason?: 'manual' | 'scheduled'
}

interface DigestRunResult {
  sent: boolean
  itemCount: number
  error?: string
}

function buildDigestEmailHtml(params: {
  recipientName: string
  items: DigestItem[]
  reviewUrl: string
  breakdown: Array<{ label: string; count: number }>
  generatedAt: string
}) {
  const rows = params.items
    .slice(0, 8)
    .map((item) => {
      const type = CONTENT_TYPE_META[item.content_type as keyof typeof CONTENT_TYPE_META] ?? CONTENT_TYPE_META.noise
      const source = item.source_url
        ? `<a href="${item.source_url}" style="color:#2563eb;text-decoration:none;">Open source</a>`
        : 'No source URL'
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:12px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.06em;">${type.label}</div>
            <div style="font-size:15px;font-weight:600;color:#111827;margin-top:4px;">${item.sender_name}</div>
            <div style="font-size:14px;color:#4b5563;line-height:1.5;margin-top:6px;">${escapeHtml(item.raw_content)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:8px;">${source}</div>
          </td>
        </tr>
      `
    })
    .join('')

  const breakdownHtml = params.breakdown
    .map(
      (entry) =>
        `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:600;">${entry.count} ${entry.label}</span>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily intake digest</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="640" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#ea580c,#fb923c);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffedd5;">Communications workspace</div>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;">Daily intake digest</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#ffedd5;">${params.generatedAt}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;color:#111827;font-size:16px;">Hi ${escapeHtml(params.recipientName)},</p>
              <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.6;">
                ${getDigestWindowLabel(params.items.length)} have been captured for review since the last digest run.
              </p>
              <div style="margin:0 0 20px;">${breakdownHtml}</div>
              <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
              <div style="margin-top:24px;">
                <a href="${params.reviewUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Open intake queue</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function attemptDigestDelivery(params: {
  recipientEmail: string
  subject: string
  html: string
}) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Inspire2Live <no-reply@inspire2live.org>',
        to: [params.recipientEmail],
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!res.ok) {
      return { sent: false, error: `Resend API error ${res.status}: ${await res.text()}` }
    }

    return { sent: true }
  }

  console.info('[comms-digest] No email provider configured. Would send digest:', {
    to: params.recipientEmail,
    subject: params.subject,
  })
  return { sent: false, error: 'No email provider configured (RESEND_API_KEY missing).' }
}

function buildBreakdown(items: DigestItem[]) {
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.content_type] = (acc[item.content_type] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([contentType, count]) => ({
      label: CONTENT_TYPE_META[contentType as keyof typeof CONTENT_TYPE_META]?.shortLabel ?? contentType,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

async function loadPendingItems(
  supabase: AdminClient,
  recipientId: string,
  digestDate: string,
  sendTime: string
) {
  const lastRunQuery = supabase
    .from('comms_digest_runs')
    .select('sent_at')
    .eq('recipient_id', recipientId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [{ data: lastRun }] = await Promise.all([lastRunQuery])

  let query = supabase
    .from('intake_items')
    .select(DIGEST_ITEM_SELECT)
    .neq('status', 'dismissed')
    .order('captured_at', { ascending: false })

  if (lastRun?.sent_at) {
    query = query.gt('captured_at', lastRun.sent_at)
  } else {
    query = query.gte('captured_at', `${digestDate}T00:00:00`)
  }

  const { data: items, error } = await query
  if (error) throw new Error(error.message)

  const { data: existingRun } = await supabase
    .from('comms_digest_runs')
    .select('id')
    .eq('recipient_id', recipientId)
    .eq('digest_date', digestDate)
    .eq('send_time', sendTime)
    .maybeSingle()

  return { items: items ?? [], alreadySent: !!existingRun }
}

export async function sendDailyCommsDigest(options: SendDigestOptions): Promise<DigestRunResult> {
  const { supabase, recipient, baseUrl, now = new Date() } = options
  const timezone = recipient.timezone || 'UTC'
  const sendTime = getDigestTime(recipient.notification_prefs)
  const digestDate = formatInTimeZone(now, timezone, 'yyyy-MM-dd')
  const generatedAt = formatInTimeZone(now, timezone, "EEE, d MMM yyyy 'at' HH:mm zzz")
  const { items, alreadySent } = await loadPendingItems(supabase, recipient.id, digestDate, sendTime)

  if (alreadySent && options.reason === 'scheduled') {
    return { sent: false, itemCount: items.length, error: 'Digest already sent for this window.' }
  }

  if (items.length === 0) {
    await supabase.from('comms_digest_runs').upsert(
      {
        recipient_id: recipient.id,
        recipient_email: recipient.email,
        digest_date: digestDate,
        send_time: sendTime,
        timezone,
        item_count: 0,
        status: 'skipped',
        error_message: null,
      },
      { onConflict: 'recipient_id,digest_date,send_time', ignoreDuplicates: false }
    )
    return { sent: false, itemCount: 0 }
  }

  const subject = `Daily intake digest: ${items.length} item${items.length === 1 ? '' : 's'} awaiting review`
  const html = buildDigestEmailHtml({
    recipientName: recipient.name || recipient.email,
    items,
    reviewUrl: `${baseUrl}/app/comms/intake`,
    breakdown: buildBreakdown(items),
    generatedAt,
  })

  const result = await attemptDigestDelivery({
    recipientEmail: recipient.email,
    subject,
    html,
  })

  await supabase.from('comms_digest_runs').upsert(
    {
      recipient_id: recipient.id,
      recipient_email: recipient.email,
      digest_date: digestDate,
      send_time: sendTime,
      timezone,
      item_count: items.length,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.error ?? null,
    },
    { onConflict: 'recipient_id,digest_date,send_time', ignoreDuplicates: false }
  )

  return { sent: result.sent, itemCount: items.length, error: result.error }
}

export async function sendScheduledCommsDigests(supabase: AdminClient, baseUrl: string, now = new Date()) {
  const { data: recipientRows, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, timezone, notification_prefs, comms_team')

  if (error) throw new Error(error.message)

  const recipients = (recipientRows ?? []).filter(
    (recipient) => canAccessCommsWorkspace(recipient.role, recipient.comms_team)
  )

  const results: Array<{ email: string; sent: boolean; itemCount: number; error?: string }> = []

  for (const recipient of recipients ?? []) {
    const timezone = recipient.timezone || 'UTC'
    const currentTime = formatInTimeZone(now, timezone, 'HH:mm')
    const expectedTime = getDigestTime(recipient.notification_prefs)

    if (currentTime !== expectedTime) continue

    const result = await sendDailyCommsDigest({
      supabase,
      recipient,
      baseUrl,
      now,
      reason: 'scheduled',
    })

    results.push({
      email: recipient.email,
      sent: result.sent,
      itemCount: result.itemCount,
      error: result.error,
    })
  }

  return results
}
