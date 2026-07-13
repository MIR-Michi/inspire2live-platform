import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { signInboundMediaUrl } from '@/lib/whatsapp-media'
import type { WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'
import type { Database } from '@/types/database'

type AppSupabaseClient = SupabaseClient<Database>

const INBOUND_MEDIA_COLUMNS = 'media_type, media_mime_type, media_storage_path, media_filename, media_status'

function isMissingColumn(error: { message?: string } | null | undefined, column: string): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    message.includes(column) &&
    (message.includes('could not find') ||
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('column'))
  )
}

export type LoadWhatsAppFeedOptions = {
  /** Inclusive lower bound (ISO). When omitted, the most recent `limit` are returned. */
  startIso?: string
  /** Exclusive upper bound (ISO). */
  endIso?: string
  /** Max messages per direction. Defaults to 200. */
  limit?: number
}

/**
 * Load the WhatsApp feed (inbound intake_items with signed media + outbound
 * replies), optionally bounded to a window. Chronological, oldest-first — reads
 * like a chat and lines up with the digest window. Degrades gracefully on DBs
 * without the media (00114) or soft-delete (00113) columns.
 *
 * This is the media-rich source for the WhatsApp workspace right column; the
 * inbound message ids are `intake_items` ids, so digest source references
 * highlight directly onto these items.
 */
export async function loadWhatsAppFeed(
  supabase: AppSupabaseClient,
  options: LoadWhatsAppFeedOptions = {}
): Promise<WhatsAppThreadMessage[]> {
  const limit = options.limit ?? 200
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyWindow = (query: any, column: string) => {
    let q = query
    if (options.startIso) q = q.gte(column, options.startIso)
    if (options.endIso) q = q.lt(column, options.endIso)
    return q
  }

  const loadInbound = (withSoftDeleteFilter: boolean, withMedia: boolean) => {
    const columns = withMedia
      ? `id, sender_name, sender_whatsapp_id, raw_content, status, captured_at, ${INBOUND_MEDIA_COLUMNS}`
      : 'id, sender_name, sender_whatsapp_id, raw_content, status, captured_at'
    let query = db.from('intake_items').select(columns).not('sender_whatsapp_id', 'is', null)
    query = applyWindow(query, 'captured_at')
    if (withSoftDeleteFilter) query = query.is('whatsapp_deleted_at', null)
    return query.order('captured_at', { ascending: true }).limit(limit)
  }

  const loadOutbound = (withSoftDeleteFilter: boolean) => {
    let query = db
      .from('whatsapp_outbound_messages')
      .select('id, recipient_whatsapp_id, body, delivery_status, error_detail, sent_at, delivered_at, read_at')
    query = applyWindow(query, 'sent_at')
    if (withSoftDeleteFilter) query = query.is('whatsapp_deleted_at', null)
    return query.order('sent_at', { ascending: true }).limit(limit)
  }

  let softDelete = true
  let withMedia = true
  let [inboundResult, outboundResult] = await Promise.all([loadInbound(softDelete, withMedia), loadOutbound(softDelete)])

  if (isMissingColumn(inboundResult.error, 'media_')) {
    withMedia = false
    inboundResult = await loadInbound(softDelete, withMedia)
  }
  if (isMissingColumn(inboundResult.error, 'whatsapp_deleted_at') || isMissingColumn(outboundResult.error, 'whatsapp_deleted_at')) {
    softDelete = false
    ;[inboundResult, outboundResult] = await Promise.all([loadInbound(softDelete, withMedia), loadOutbound(softDelete)])
  }

  if (inboundResult.error) throw new Error(inboundResult.error.message)
  if (outboundResult.error) throw new Error(outboundResult.error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inboundRows = (inboundResult.data ?? []).filter((item: any) => item.sender_whatsapp_id)
  const needsSigning = inboundRows.some(
    (item: { media_status?: string; media_storage_path?: string | null }) =>
      item.media_status === 'stored' && item.media_storage_path
  )
  let mediaAdmin: ReturnType<typeof createAdminClient> | null = null
  if (needsSigning) {
    try {
      mediaAdmin = createAdminClient()
    } catch {
      mediaAdmin = null
    }
  }

  const inbound: WhatsAppThreadMessage[] = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inboundRows.map(async (item: any): Promise<WhatsAppThreadMessage> => {
      const mediaType = (item.media_type ?? null) as 'image' | 'video' | 'document' | 'audio' | null
      let media: WhatsAppThreadMessage['media'] = null
      if (mediaType) {
        let url: string | null = null
        if (mediaAdmin && item.media_status === 'stored' && item.media_storage_path) {
          url = await signInboundMediaUrl(mediaAdmin, item.media_storage_path as string)
        }
        media = {
          type: mediaType,
          url,
          mimeType: (item.media_mime_type as string | null) ?? null,
          filename: (item.media_filename as string | null) ?? null,
          status: (item.media_status as string | null) ?? 'none',
        }
      }
      return {
        id: String(item.id),
        direction: 'inbound',
        whatsappId: item.sender_whatsapp_id,
        displayName: item.sender_name,
        text: item.raw_content,
        timestamp: item.captured_at,
        status: item.status,
        media,
      }
    })
  )

  const outbound: WhatsAppThreadMessage[] = (outboundResult.data ?? []).map(
    (item: {
      id: string
      recipient_whatsapp_id: string
      body: string
      delivery_status: string
      error_detail: string | null
      sent_at: string
      delivered_at: string | null
      read_at: string | null
    }) => ({
      id: String(item.id),
      direction: 'outbound',
      whatsappId: item.recipient_whatsapp_id,
      displayName: item.recipient_whatsapp_id,
      text: item.body,
      timestamp: item.sent_at,
      status: item.delivery_status,
      errorDetail: item.error_detail,
      deliveredAt: item.delivered_at,
      readAt: item.read_at,
    })
  )

  return [...inbound, ...outbound].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}
