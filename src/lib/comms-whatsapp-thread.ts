// Pure conversation-threading helpers for the WhatsApp inbox.
//
// Inbound messages (from intake_items) and outbound replies (from
// whatsapp_outbound_messages) are two separate tables linked only by the
// WhatsApp ID of the other party. These helpers stitch them back into a single
// chronological thread per contact so the UI can show a real conversation.
// Kept free of React/DB so the grouping logic can be unit-tested directly.

export type WhatsAppDirection = 'inbound' | 'outbound'

export type WhatsAppThreadMessage = {
  id: string
  direction: WhatsAppDirection
  whatsappId: string
  displayName: string
  text: string
  timestamp: string
  status: string
  errorDetail?: string | null
  /** Receipt times for outbound messages (null for inbound). */
  deliveredAt?: string | null
  readAt?: string | null
}

export type WhatsAppThread = {
  whatsappId: string
  displayName: string
  latestTimestamp: string
  messages: WhatsAppThreadMessage[]
  /** Intake item id of the most recent inbound message, for "reply" targeting. */
  lastInboundIntakeItemId: string | null
}

function toTime(timestamp: string): number {
  const time = new Date(timestamp).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Group a flat feed of inbound + outbound messages into per-contact threads,
 * each sorted oldest-first, with threads ordered most-recently-active first.
 * Returns an empty array for an empty feed.
 */
export function groupIntoThreads(feed: WhatsAppThreadMessage[]): WhatsAppThread[] {
  const byWhatsappId = new Map<string, WhatsAppThreadMessage[]>()

  for (const item of feed) {
    const existing = byWhatsappId.get(item.whatsappId)
    if (existing) existing.push(item)
    else byWhatsappId.set(item.whatsappId, [item])
  }

  const threads: WhatsAppThread[] = []
  for (const [whatsappId, items] of byWhatsappId) {
    const chronological = [...items].sort((a, b) => toTime(a.timestamp) - toTime(b.timestamp))
    const latestInbound = [...chronological].reverse().find((item) => item.direction === 'inbound')
    const firstInboundName = chronological.find((item) => item.direction === 'inbound')?.displayName

    threads.push({
      whatsappId,
      displayName: firstInboundName || whatsappId,
      latestTimestamp: chronological[chronological.length - 1].timestamp,
      messages: chronological,
      lastInboundIntakeItemId: latestInbound?.id ?? null,
    })
  }

  return threads.sort((a, b) => toTime(b.latestTimestamp) - toTime(a.latestTimestamp))
}
