import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { signInboundMediaUrl } from '@/lib/whatsapp-media'
import { WhatsAppInboxShell, type WhatsAppFeedItem } from '@/components/comms/whatsapp-inbox-shell'

function isMissingColumn(error: { message?: string } | null | undefined, column: string): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes(column) && (
    message.includes('could not find') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column')
  )
}

function isMissingSoftDeleteColumn(error: { message?: string } | null | undefined): boolean {
  return isMissingColumn(error, 'whatsapp_deleted_at')
}

const INBOUND_MEDIA_COLUMNS = 'media_type, media_mime_type, media_storage_path, media_filename, media_status'

export default async function CommsWhatsAppPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    redirect('/app/comms')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // `media` and `softDelete` degrade independently: an inbound query may run on
  // a DB where the media columns (00114) or the soft-delete columns (00113)
  // aren't applied yet.
  const loadInbound = (withSoftDeleteFilter: boolean, withMedia: boolean) => {
    const columns = withMedia
      ? `id, sender_name, sender_whatsapp_id, raw_content, status, captured_at, ${INBOUND_MEDIA_COLUMNS}`
      : 'id, sender_name, sender_whatsapp_id, raw_content, status, captured_at'
    let query = db.from('intake_items').select(columns).not('sender_whatsapp_id', 'is', null)
    if (withSoftDeleteFilter) query = query.is('whatsapp_deleted_at', null)
    return query.order('captured_at', { ascending: false }).limit(100)
  }

  const loadOutbound = (withSoftDeleteFilter: boolean) => {
    let query = db
      .from('whatsapp_outbound_messages')
      .select('id, recipient_whatsapp_id, body, delivery_status, error_detail, sent_at, delivered_at, read_at')
    if (withSoftDeleteFilter) query = query.is('whatsapp_deleted_at', null)
    return query.order('sent_at', { ascending: false }).limit(100)
  }

  let softDelete = true
  let withMedia = true
  let [inboundResult, outboundResult] = await Promise.all([loadInbound(softDelete, withMedia), loadOutbound(softDelete)])

  // Drop media columns if they aren't there yet, then retry.
  if (isMissingColumn(inboundResult.error, 'media_')) {
    withMedia = false
    inboundResult = await loadInbound(softDelete, withMedia)
  }
  // Drop the soft-delete filter if those columns aren't there yet, then retry.
  if (isMissingSoftDeleteColumn(inboundResult.error) || isMissingSoftDeleteColumn(outboundResult.error)) {
    softDelete = false
    ;[inboundResult, outboundResult] = await Promise.all([loadInbound(softDelete, withMedia), loadOutbound(softDelete)])
  }

  if (inboundResult.error) throw new Error(inboundResult.error.message)
  if (outboundResult.error) throw new Error(outboundResult.error.message)

  // Stored media lives in a private bucket; mint short-lived signed URLs with a
  // service-role client. Guard for environments without the service key.
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

  const inbound: WhatsAppFeedItem[] = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inboundRows.map(async (item: any): Promise<WhatsAppFeedItem> => {
      const mediaType = (item.media_type ?? null) as 'image' | 'video' | 'document' | 'audio' | null
      let media: WhatsAppFeedItem['media'] = null
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
        id: item.id,
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

  const outbound: WhatsAppFeedItem[] = (outboundResult.data ?? []).map((item: {
    id: string
    recipient_whatsapp_id: string
    body: string
    delivery_status: string
    error_detail: string | null
    sent_at: string
    delivered_at: string | null
    read_at: string | null
  }) => ({
    id: item.id,
    direction: 'outbound',
    whatsappId: item.recipient_whatsapp_id,
    displayName: item.recipient_whatsapp_id,
    text: item.body,
    timestamp: item.sent_at,
    status: item.delivery_status,
    errorDetail: item.error_detail,
    deliveredAt: item.delivered_at,
    readAt: item.read_at,
  }))

  const feed = [...inbound, ...outbound].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return <WhatsAppInboxShell feed={feed} canDeleteMessages={profile.role === 'PlatformAdmin'} />
}
