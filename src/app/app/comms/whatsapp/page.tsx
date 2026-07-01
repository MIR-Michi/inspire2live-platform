import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { normalizeRole } from '@/lib/platform-roles'
import { WhatsAppInboxShell, type WhatsAppFeedItem } from '@/components/comms/whatsapp-inbox-shell'

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

  const isAdmin = normalizeRole(profile.role) === 'PlatformAdmin'

  const [inboundResult, outboundResult] = await Promise.all([
    supabase
      .from('intake_items')
      .select('id, sender_name, sender_whatsapp_id, raw_content, status, captured_at')
      .not('sender_whatsapp_id', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(100),
    supabase
      .from('whatsapp_outbound_messages')
      .select('id, recipient_whatsapp_id, body, delivery_status, error_detail, sent_at, delivered_at, read_at')
      .order('sent_at', { ascending: false })
      .limit(100),
  ])

  if (inboundResult.error) throw new Error(inboundResult.error.message)
  if (outboundResult.error) throw new Error(outboundResult.error.message)

  const inbound: WhatsAppFeedItem[] = (inboundResult.data ?? [])
    .filter((item) => item.sender_whatsapp_id)
    .map((item) => ({
      id: item.id,
      direction: 'inbound',
      whatsappId: item.sender_whatsapp_id as string,
      displayName: item.sender_name,
      text: item.raw_content,
      timestamp: item.captured_at,
      status: item.status,
    }))

  const outbound: WhatsAppFeedItem[] = (outboundResult.data ?? []).map((item) => ({
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

  return <WhatsAppInboxShell feed={feed} isAdmin={isAdmin} />
}
