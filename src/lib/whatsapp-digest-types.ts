/**
 * Panel-ready shapes for a stored WhatsApp digest. Kept in a plain (non-client,
 * non-server) module so both the client `WhatsAppDigestPanel` and the server-side
 * readers share one definition.
 */

export type DigestSummary = {
  id: string
  windowStart: string
  windowEnd: string
  monthly: boolean
  tldr: string
  monthlySummary: string | null
  status: string
  messageCount: number
  model: string | null
}

export type DigestItem = {
  id: string
  category: string
  title: string
  person: string | null
  date: string | null
  detail: string | null
  sourceMessageIds: string[]
  proposalStatus: string
  linkedType: string | null
}

export type DigestBundle = { summary: DigestSummary; items: DigestItem[] }

/** Map a whatsapp_feed_summaries row to the panel shape. */
export function toDigestSummary(row: Record<string, unknown>): DigestSummary {
  return {
    id: String(row.id),
    windowStart: String(row.window_start),
    windowEnd: String(row.window_end),
    monthly: Boolean(row.monthly),
    tldr: String(row.tldr ?? ''),
    monthlySummary: (row.monthly_summary as string | null) ?? null,
    status: String(row.status ?? 'pending'),
    messageCount: typeof row.message_count === 'number' ? row.message_count : Number(row.message_count ?? 0),
    model: (row.model as string | null) ?? null,
  }
}

/** Map a whatsapp_feed_items row to the panel shape. */
export function toDigestItem(row: Record<string, unknown>): DigestItem {
  return {
    id: String(row.id),
    category: String(row.category),
    title: String(row.title ?? ''),
    person: (row.person as string | null) ?? null,
    date: (row.item_date as string | null) ?? null,
    detail: (row.detail as string | null) ?? null,
    sourceMessageIds: Array.isArray(row.source_message_ids) ? (row.source_message_ids as string[]) : [],
    proposalStatus: String(row.proposal_status ?? 'none'),
    linkedType: (row.linked_type as string | null) ?? null,
  }
}
