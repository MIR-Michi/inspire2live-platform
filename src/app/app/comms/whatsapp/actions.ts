'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { normalizeRole } from '@/lib/platform-roles'
import { sendWhatsAppMessage } from '@/lib/whatsapp-send'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

async function requireCommsOperator() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { user, profile }
}

async function requireWhatsAppAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (normalizeRole(profile?.role) !== 'PlatformAdmin') {
    throw new Error('Only a PlatformAdmin can delete WhatsApp messages')
  }

  return { user }
}

/**
 * Hard-delete inbound WhatsApp intake items platform-wide. Uses the service
 * role so the rows disappear for every user and everywhere they surface
 * (inbox, intake queue, dashboards). Clears the one non-cascading reference
 * (content_calendar.source_intake_id) and the raw webhook payloads first; all
 * other children cascade.
 */
async function purgeInboundIntakeItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return

  // Null the only FK to intake_items that does NOT cascade, or the delete
  // would be blocked.
  const nulled = await admin.from('content_calendar').update({ source_intake_id: null }).in('source_intake_id', ids)
  if (nulled.error) throw new Error(nulled.error.message)

  // Remove the raw inbound webhook payloads (they hold the message content and
  // only set-null their link, so they must be deleted explicitly).
  const webhook = await admin.from('whatsapp_webhook_events').delete().in('intake_item_id', ids)
  if (webhook.error) throw new Error(webhook.error.message)

  const removed = await admin.from('intake_items').delete().in('id', ids)
  if (removed.error) throw new Error(removed.error.message)
}

function revalidateWhatsAppSurfaces() {
  // The inbox plus every place a WhatsApp message can surface.
  revalidatePath('/app/comms/whatsapp')
  revalidatePath('/app/comms/dashboard')
  revalidatePath('/app/comms')
  revalidatePath('/app/comms/intake')
}

/**
 * Deletes a single WhatsApp message (inbound intake item or outbound reply)
 * for everyone, everywhere. PlatformAdmin only.
 */
export async function deleteWhatsAppMessage(
  input: { id: string; direction: 'inbound' | 'outbound' }
): Promise<CommsFormState> {
  try {
    await requireWhatsAppAdmin()
    const admin = createAdminClient()

    if (input.direction === 'outbound') {
      const { error } = await admin.from('whatsapp_outbound_messages').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
    } else {
      await purgeInboundIntakeItems(admin, [input.id])
    }

    revalidateWhatsAppSurfaces()
    return { ok: true, message: 'Message deleted.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the message.' }
  }
}

/**
 * Deletes an entire WhatsApp conversation (every inbound and outbound message
 * with one contact) for everyone, everywhere. PlatformAdmin only.
 */
export async function deleteWhatsAppConversation(whatsappId: string): Promise<CommsFormState> {
  try {
    await requireWhatsAppAdmin()
    if (!whatsappId) return { ok: false, error: 'Missing conversation.' }
    const admin = createAdminClient()

    const outbound = await admin.from('whatsapp_outbound_messages').delete().eq('recipient_whatsapp_id', whatsappId)
    if (outbound.error) throw new Error(outbound.error.message)

    const inbound = await admin.from('intake_items').select('id').eq('sender_whatsapp_id', whatsappId)
    if (inbound.error) throw new Error(inbound.error.message)
    await purgeInboundIntakeItems(admin, (inbound.data ?? []).map((row: { id: string }) => row.id))

    revalidateWhatsAppSurfaces()
    return { ok: true, message: 'Conversation deleted.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the conversation.' }
  }
}

export async function sendWhatsAppReply(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { user } = await requireCommsOperator()
    const recipientWhatsappId = asText(formData.get('recipient_whatsapp_id'))
    const body = asText(formData.get('body'))
    const inReplyToIntakeItemId = asText(formData.get('in_reply_to_intake_item_id')) || null

    if (!recipientWhatsappId || !body) {
      return { ok: false, error: 'A recipient and message are required.' }
    }

    const result = await sendWhatsAppMessage(recipientWhatsappId, body)
    const admin = createAdminClient()

    const { error: insertError } = await admin.from('whatsapp_outbound_messages').insert({
      recipient_whatsapp_id: recipientWhatsappId,
      body,
      sent_by: user.id,
      in_reply_to_intake_item_id: inReplyToIntakeItemId,
      graph_message_id: result.ok ? result.messageId : null,
      delivery_status: result.ok ? 'sent' : 'failed',
      error_detail: result.ok ? null : result.error,
    })

    if (insertError) throw new Error(insertError.message)

    revalidatePath('/app/comms/whatsapp')

    if (!result.ok) {
      return { ok: false, error: `Message could not be delivered: ${result.error}` }
    }

    return { ok: true, message: 'Reply sent.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send the WhatsApp reply.' }
  }
}
