'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import {
  buildWebhookEnvelopeFromStoredMessage,
  processWhatsAppWebhookPayload,
} from '@/lib/comms-webhook'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }
}

/**
 * Re-run processing for a single failed webhook event using its stored payload,
 * without waiting for Meta to redeliver. On success the event's
 * processing_status flips to 'accepted' and the intake item is (re)created.
 */
export async function replayWhatsAppWebhookEvent(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    await requireCommsOperator()

    const eventId = typeof formData.get('event_id') === 'string' ? (formData.get('event_id') as string).trim() : ''
    if (!eventId) return { ok: false, error: 'A webhook event id is required.' }

    const admin = createAdminClient()

    const { data: event, error: loadError } = await admin
      .from('whatsapp_webhook_events')
      .select('id, payload, sender_whatsapp_id, sender_name, processing_status')
      .eq('id', eventId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!event) return { ok: false, error: 'That webhook event no longer exists.' }

    const envelope = buildWebhookEnvelopeFromStoredMessage({
      payload: event.payload,
      senderWhatsappId: event.sender_whatsapp_id,
      senderName: event.sender_name,
    })

    const result = await processWhatsAppWebhookPayload(admin, envelope)
    revalidatePath('/app/comms/whatsapp/health')

    if (result.failures > 0) {
      return { ok: false, error: 'Replay failed again — see the updated failure reason.' }
    }
    if (result.accepted === 0 && result.duplicates === 0) {
      return { ok: false, error: 'Stored payload contained no replayable message.' }
    }

    return { ok: true, message: result.duplicates > 0 ? 'Already processed — marked resolved.' : 'Replayed successfully.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not replay the webhook event.' }
  }
}
