import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { summarizeWebhookEvents } from '@/lib/comms-whatsapp-health'
import { WhatsAppHealthShell, type FailedWebhookEvent } from '@/components/comms/whatsapp-health-shell'

// Window of recent webhook events to summarise. Generous enough to give a
// representative failure rate without scanning the whole table.
const EVENT_WINDOW = 500

export default async function CommsWhatsAppHealthPage() {
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

  const { data: events, error } = await supabase
    .from('whatsapp_webhook_events')
    .select('id, processing_status, failure_reason, sender_name, sender_whatsapp_id, received_at')
    .order('received_at', { ascending: false })
    .limit(EVENT_WINDOW)

  if (error) throw new Error(error.message)

  const rows = events ?? []
  const summary = summarizeWebhookEvents(
    rows.map((row) => ({ processing_status: row.processing_status, received_at: row.received_at }))
  )

  const failedEvents: FailedWebhookEvent[] = rows
    .filter((row) => row.processing_status === 'failed')
    .map((row) => ({
      id: row.id,
      senderName: row.sender_name,
      senderWhatsappId: row.sender_whatsapp_id,
      failureReason: row.failure_reason,
      receivedAt: row.received_at,
    }))

  return <WhatsAppHealthShell summary={summary} failedEvents={failedEvents} />
}
