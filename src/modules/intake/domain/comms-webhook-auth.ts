import { createHmac, timingSafeEqual } from 'node:crypto'

export const COMMS_WEBHOOK_SECRET_HEADER = 'x-inspire2live-webhook-secret'

type AuthenticateWhatsAppWebhookInput = {
  rawBody: string
  signatureHeader: string | null
  secretHeader: string | null
  appSecret?: string
  webhookSecret?: string
}

type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function buildWhatsAppSignature(rawBody: string, appSecret: string) {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}

export function authenticateWhatsAppWebhookRequest({
  rawBody,
  signatureHeader,
  secretHeader,
  appSecret,
  webhookSecret,
}: AuthenticateWhatsAppWebhookInput): WebhookAuthResult {
  if (appSecret) {
    if (!signatureHeader) {
      return { ok: false, status: 401, error: 'Missing WhatsApp signature header.' }
    }

    const expectedSignature = buildWhatsAppSignature(rawBody, appSecret)
    if (!secureCompare(signatureHeader, expectedSignature)) {
      return { ok: false, status: 401, error: 'Invalid WhatsApp webhook signature.' }
    }

    return { ok: true }
  }

  if (webhookSecret) {
    if (!secretHeader) {
      return { ok: false, status: 401, error: 'Missing webhook secret header.' }
    }

    if (!secureCompare(secretHeader, webhookSecret)) {
      return { ok: false, status: 401, error: 'Invalid webhook secret.' }
    }

    return { ok: true }
  }

  return {
    ok: false,
    status: 500,
    error: 'WhatsApp webhook auth is not configured. Set WHATSAPP_APP_SECRET or WHATSAPP_WEBHOOK_SECRET.',
  }
}
