import { describe, expect, it } from 'vitest'
import {
  authenticateWhatsAppWebhookRequest,
  COMMS_WEBHOOK_SECRET_HEADER,
} from '@/lib/comms-webhook-auth'

describe('WhatsApp webhook auth', () => {
  it('accepts a matching shared-secret header', () => {
    const result = authenticateWhatsAppWebhookRequest({
      rawBody: '{"entry":[]}',
      signatureHeader: null,
      secretHeader: 'local-secret',
      webhookSecret: 'local-secret',
    })

    expect(result).toEqual({ ok: true })
  })

  it('rejects a missing shared-secret header when webhook auth is enabled', () => {
    const result = authenticateWhatsAppWebhookRequest({
      rawBody: '{"entry":[]}',
      signatureHeader: null,
      secretHeader: null,
      webhookSecret: 'local-secret',
    })

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: 'Missing webhook secret header.',
    })
  })

  it('surfaces a configuration error when no POST auth method is configured', () => {
    const result = authenticateWhatsAppWebhookRequest({
      rawBody: '{"entry":[]}',
      signatureHeader: null,
      secretHeader: null,
    })

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'WhatsApp webhook auth is not configured. Set WHATSAPP_APP_SECRET or WHATSAPP_WEBHOOK_SECRET.',
    })
  })

  it('keeps the shared-secret header name stable for clients', () => {
    expect(COMMS_WEBHOOK_SECRET_HEADER).toBe('x-inspire2live-webhook-secret')
  })
})
