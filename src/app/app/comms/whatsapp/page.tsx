import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { WhatsAppInboxShell, type WhatsAppFeedItem } from '@/components/comms/whatsapp-inbox-shell'

function isMissingSoftDeleteColumn(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('whatsapp_deleted_at') && (
    message.includes('could not find') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column')
  )
}

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

  const loadInbound = (withSoftDeleteFilter: boolean) => {
    let query = db
      .from('intake_items')
      .select('id, sender_name, sender_whatsapp_id, raw_content, status, captured_at')
      .not('sender_whatsapp_id', 'is', null)
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

  let [inboundResult, outboundResult] = await Promise.all([loadInbound(true), loadOutbound(true)])

  if (isMissingSoftDeleteColumn(inboundResult.error) || isMissingSoftDeleteColumn(outboundResult.error)) {
    ;[inboundResult, outboundResult] = await Promise.all([loadInbound(false), loadOutbound(false)])
  }

  if (inboundResult.error) throw new Error(inboundResult.error.message)
  if (outboundResult.error) throw new Error(outboundResult.error.message)

  const inbound: WhatsAppFeedItem[] = (inboundResult.data ?? [])
    .filter((item: { sender_whatsapp_id: string | null }) => item.sender_whatsapp_id)
    .map((item: {
      id: string
      sender_name: string
      sender_whatsapp_id: string
      raw_content: string
      status: string
      captured_at: string
    }) => ({
      id: item.id,
      direction: 'inbound',
      whatsappId: item.sender_whatsapp_id,
      displayName: item.sender_name,
      text: item.raw_content,
      timestamp: item.captured_at,
      status: item.status,
    }))

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
