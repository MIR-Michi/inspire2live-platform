import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWhatsAppWebhookPayload } from '@/lib/comms-webhook'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const verifyToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && expected && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ ok: false, error: 'Verification failed.' }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const admin = createAdminClient()
    const result = await processWhatsAppWebhookPayload(admin, payload)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed.',
      },
      { status: 500 }
    )
  }
}
