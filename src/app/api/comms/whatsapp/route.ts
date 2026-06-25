import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateWhatsAppWebhookRequest,
  COMMS_WEBHOOK_SECRET_HEADER,
} from '@/lib/comms-webhook-auth'
import {
  processWhatsAppStatusEvents,
  processWhatsAppWebhookPayload,
} from '@/lib/comms-webhook'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const verifyToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'WHATSAPP_VERIFY_TOKEN is not configured.' },
      { status: 500 },
    )
  }

  if (mode === 'subscribe' && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ ok: false, error: 'Verification failed.' }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const authResult = authenticateWhatsAppWebhookRequest({
      rawBody,
      signatureHeader: request.headers.get('x-hub-signature-256'),
      secretHeader: request.headers.get(COMMS_WEBHOOK_SECRET_HEADER),
      appSecret: process.env.WHATSAPP_APP_SECRET,
      webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
    })

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const payload = JSON.parse(rawBody) as unknown
    const admin = createAdminClient()
    // A single webhook call carries inbound messages, delivery receipts, or
    // both. Process each independently so a payload that is purely status
    // receipts still updates outbound delivery state.
    const [result, statuses] = await Promise.all([
      processWhatsAppWebhookPayload(admin, payload),
      processWhatsAppStatusEvents(admin, payload),
    ])

    return NextResponse.json({
      ok: true,
      ...result,
      statuses,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'Webhook payload must be valid JSON.' }, { status: 400 })
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed.',
      },
      { status: 500 }
    )
  }
}
