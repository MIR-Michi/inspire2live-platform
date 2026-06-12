import { describe, expect, it } from 'vitest'
import {
  buildWebhookEnvelopeFromStoredMessage,
  parseWhatsAppStatusEvents,
  parseWhatsAppWebhookPayload,
  resolveStatusUpdate,
} from '@/lib/comms-webhook'
import { groupIntoThreads, type WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'
import { summarizeWebhookEvents } from '@/lib/comms-whatsapp-health'

// ── Realistic Meta webhook payload fixtures ──────────────────────────────────

function inboundMessagePayload() {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001111', phone_number_id: 'PNID' },
              contacts: [{ profile: { name: 'Atefeh Taherian' }, wa_id: '31600000001' }],
              messages: [
                {
                  from: '31600000001',
                  id: 'wamid.INBOUND1',
                  timestamp: '1718200000',
                  type: 'text',
                  text: { body: 'Please share the Congress recap on the newsletter.' },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function statusPayload(status: string, id = 'wamid.OUT1', withError = false) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001111', phone_number_id: 'PNID' },
              statuses: [
                {
                  id,
                  status,
                  timestamp: '1718200500',
                  recipient_id: '31600000001',
                  ...(withError
                    ? { errors: [{ code: 131026, title: 'Message undeliverable', message: 'Recipient not on WhatsApp' }] }
                    : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

// ── parseWhatsAppStatusEvents ────────────────────────────────────────────────

describe('parseWhatsAppStatusEvents', () => {
  it('extracts a delivered receipt with an ISO timestamp', () => {
    const events = parseWhatsAppStatusEvents(statusPayload('delivered'))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerMessageId: 'wamid.OUT1',
      status: 'delivered',
      recipientWhatsappId: '31600000001',
      errorDetail: null,
    })
    expect(events[0].timestamp).toBe(new Date(1718200500 * 1000).toISOString())
  })

  it('captures the error detail on a failed receipt', () => {
    const events = parseWhatsAppStatusEvents(statusPayload('failed', 'wamid.OUT1', true))
    expect(events[0].status).toBe('failed')
    expect(events[0].errorDetail).toBe('Message undeliverable — Recipient not on WhatsApp')
  })

  it('ignores unknown status values and non-status payloads', () => {
    expect(parseWhatsAppStatusEvents(statusPayload('teleported'))).toHaveLength(0)
    expect(parseWhatsAppStatusEvents(inboundMessagePayload())).toHaveLength(0)
    expect(parseWhatsAppStatusEvents(null)).toHaveLength(0)
    expect(parseWhatsAppStatusEvents({})).toHaveLength(0)
  })

  it('does not mistake inbound messages for status events (and vice versa)', () => {
    expect(parseWhatsAppWebhookPayload(statusPayload('read'))).toHaveLength(0)
    expect(parseWhatsAppWebhookPayload(inboundMessagePayload())).toHaveLength(1)
  })
})

// ── resolveStatusUpdate (forward-only ranking) ───────────────────────────────

describe('resolveStatusUpdate', () => {
  const base = { delivery_status: 'sent', delivered_at: null, read_at: null }

  it('advances sent -> delivered and stamps delivered_at', () => {
    const { apply, update } = resolveStatusUpdate(base, { status: 'delivered', timestamp: 'T1', errorDetail: null })
    expect(apply).toBe(true)
    expect(update).toMatchObject({ delivery_status: 'delivered', delivered_at: 'T1' })
  })

  it('advances to read, backfilling delivered_at when never delivered', () => {
    const { apply, update } = resolveStatusUpdate(base, { status: 'read', timestamp: 'T2', errorDetail: null })
    expect(apply).toBe(true)
    expect(update).toMatchObject({ delivery_status: 'read', delivered_at: 'T2', read_at: 'T2' })
  })

  it('ignores a stale delivered receipt arriving after read', () => {
    const current = { delivery_status: 'read', delivered_at: 'T1', read_at: 'T2' }
    const { apply } = resolveStatusUpdate(current, { status: 'delivered', timestamp: 'T3', errorDetail: null })
    expect(apply).toBe(false)
  })

  it('ignores a repeat of the same status', () => {
    const current = { delivery_status: 'delivered', delivered_at: 'T1', read_at: null }
    const { apply } = resolveStatusUpdate(current, { status: 'delivered', timestamp: 'T9', errorDetail: null })
    expect(apply).toBe(false)
  })

  it('always records a failure, even from a more-advanced status', () => {
    const current = { delivery_status: 'read', delivered_at: 'T1', read_at: 'T2' }
    const { apply, update } = resolveStatusUpdate(current, { status: 'failed', timestamp: 'T4', errorDetail: 'boom' })
    expect(apply).toBe(true)
    expect(update).toMatchObject({ delivery_status: 'failed', error_detail: 'boom' })
  })

  it('does not overwrite an existing delivered_at on a later read', () => {
    const current = { delivery_status: 'delivered', delivered_at: 'T1', read_at: null }
    const { update } = resolveStatusUpdate(current, { status: 'read', timestamp: 'T2', errorDetail: null })
    expect(update.delivered_at).toBeUndefined()
    expect(update.read_at).toBe('T2')
  })
})

// ── buildWebhookEnvelopeFromStoredMessage (replay round-trip) ─────────────────

describe('buildWebhookEnvelopeFromStoredMessage', () => {
  it('rebuilds an envelope that re-parses to the original message', () => {
    const original = parseWhatsAppWebhookPayload(inboundMessagePayload())[0]

    const envelope = buildWebhookEnvelopeFromStoredMessage({
      payload: original.payload,
      senderWhatsappId: original.senderWhatsappId,
      senderName: original.senderName,
    })

    const reparsed = parseWhatsAppWebhookPayload(envelope)
    expect(reparsed).toHaveLength(1)
    expect(reparsed[0]).toMatchObject({
      providerMessageId: 'wamid.INBOUND1',
      senderWhatsappId: '31600000001',
      senderName: 'Atefeh Taherian',
      rawContent: 'Please share the Congress recap on the newsletter.',
    })
  })

  it('still produces a parseable message when the sender name is missing', () => {
    const envelope = buildWebhookEnvelopeFromStoredMessage({
      payload: { from: '31600000002', id: 'wamid.X', type: 'text', text: { body: 'hi' } },
      senderWhatsappId: '31600000002',
      senderName: null,
    })
    const reparsed = parseWhatsAppWebhookPayload(envelope)
    expect(reparsed[0].senderName).toBe('31600000002')
  })
})

// ── groupIntoThreads (conversation threading) ────────────────────────────────

describe('groupIntoThreads', () => {
  const inbound = (id: string, whatsappId: string, ts: string, name: string): WhatsAppThreadMessage => ({
    id,
    direction: 'inbound',
    whatsappId,
    displayName: name,
    text: `in ${id}`,
    timestamp: ts,
    status: 'unreviewed',
  })
  const outbound = (id: string, whatsappId: string, ts: string): WhatsAppThreadMessage => ({
    id,
    direction: 'outbound',
    whatsappId,
    displayName: whatsappId,
    text: `out ${id}`,
    timestamp: ts,
    status: 'sent',
  })

  it('returns an empty array for an empty feed', () => {
    expect(groupIntoThreads([])).toEqual([])
  })

  it('threads a single message', () => {
    const threads = groupIntoThreads([inbound('i1', '31600000001', '2026-01-01T10:00:00Z', 'Atefeh')])
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({ whatsappId: '31600000001', displayName: 'Atefeh', lastInboundIntakeItemId: 'i1' })
  })

  it('interleaves inbound and outbound chronologically and tracks the latest inbound', () => {
    const threads = groupIntoThreads([
      outbound('o1', '31600000001', '2026-01-01T11:00:00Z'),
      inbound('i1', '31600000001', '2026-01-01T10:00:00Z', 'Atefeh'),
      inbound('i2', '31600000001', '2026-01-01T12:00:00Z', 'Atefeh'),
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0].messages.map((m) => m.id)).toEqual(['i1', 'o1', 'i2'])
    expect(threads[0].lastInboundIntakeItemId).toBe('i2')
  })

  it('separates contacts and orders threads by most-recent activity', () => {
    const threads = groupIntoThreads([
      inbound('i1', 'AAA', '2026-01-01T10:00:00Z', 'Alpha'),
      inbound('i2', 'BBB', '2026-01-02T10:00:00Z', 'Beta'),
    ])
    expect(threads.map((t) => t.whatsappId)).toEqual(['BBB', 'AAA'])
  })

  it('falls back to the WhatsApp id when no inbound display name exists', () => {
    const threads = groupIntoThreads([outbound('o1', 'CCC', '2026-01-01T10:00:00Z')])
    expect(threads[0].displayName).toBe('CCC')
    expect(threads[0].lastInboundIntakeItemId).toBeNull()
  })
})

// ── summarizeWebhookEvents ───────────────────────────────────────────────────

describe('summarizeWebhookEvents', () => {
  it('returns zeroed counts and no failure rate for an empty set', () => {
    expect(summarizeWebhookEvents([])).toEqual({
      total: 0,
      accepted: 0,
      duplicate: 0,
      failed: 0,
      lastReceivedAt: null,
      failureRate: 0,
    })
  })

  it('counts by status, computes failure rate, and finds the latest timestamp regardless of order', () => {
    const summary = summarizeWebhookEvents([
      { processing_status: 'accepted', received_at: '2026-01-01T10:00:00Z' },
      { processing_status: 'failed', received_at: '2026-01-03T10:00:00Z' },
      { processing_status: 'duplicate', received_at: '2026-01-02T10:00:00Z' },
      { processing_status: 'accepted', received_at: '2026-01-01T09:00:00Z' },
    ])
    expect(summary).toMatchObject({ total: 4, accepted: 2, duplicate: 1, failed: 1 })
    expect(summary.failureRate).toBeCloseTo(0.25)
    expect(summary.lastReceivedAt).toBe('2026-01-03T10:00:00Z')
  })
})
