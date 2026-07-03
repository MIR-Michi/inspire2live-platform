// Pure aggregation helpers for the WhatsApp webhook health view.
//
// Gives operators an at-a-glance read on webhook ingestion: how many events
// were accepted vs. duplicate vs. failed, and how recently the most recent one
// arrived (a silent webhook is a strong signal something is misconfigured on
// the Meta side). Kept DB-free so the aggregation is trivially testable.

export type WebhookProcessingStatus = 'accepted' | 'duplicate' | 'failed'

export type WebhookEventSummaryRow = {
  processing_status: string
  received_at: string
}

export type WebhookHealthSummary = {
  total: number
  accepted: number
  duplicate: number
  failed: number
  lastReceivedAt: string | null
  /** Share of events that failed, 0–1. 0 when there are no events. */
  failureRate: number
}

function toTime(timestamp: string): number {
  const time = new Date(timestamp).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Summarise a window of webhook events. `rows` can be in any order; the most
 * recent `received_at` is computed independently of input ordering.
 */
export function summarizeWebhookEvents(rows: WebhookEventSummaryRow[]): WebhookHealthSummary {
  let accepted = 0
  let duplicate = 0
  let failed = 0
  let lastReceivedAt: string | null = null

  for (const row of rows) {
    if (row.processing_status === 'accepted') accepted += 1
    else if (row.processing_status === 'duplicate') duplicate += 1
    else if (row.processing_status === 'failed') failed += 1

    if (row.received_at && (lastReceivedAt === null || toTime(row.received_at) > toTime(lastReceivedAt))) {
      lastReceivedAt = row.received_at
    }
  }

  const total = rows.length

  return {
    total,
    accepted,
    duplicate,
    failed,
    lastReceivedAt,
    failureRate: total === 0 ? 0 : failed / total,
  }
}
