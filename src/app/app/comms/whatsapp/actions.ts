'use server'

import { revalidatePath } from 'next/cache'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { sendWhatsAppMessage } from '@/lib/whatsapp-send'

export interface CommsFormState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

type OperatorProfile = {
  id: string
  name: string | null
  email: string | null
  role: string | null
}

type MessageRef = { direction: 'inbound' | 'outbound'; id: string }

function asText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseMessageRef(value: FormDataEntryValue): MessageRef | null {
  if (typeof value !== 'string') return null
  const [direction, id] = value.split(':')
  if ((direction !== 'inbound' && direction !== 'outbound') || !id) return null
  return { direction, id }
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

  return { user, profile: profile as OperatorProfile }
}

async function requirePlatformAdmin() {
  const context = await requireCommsOperator()
  if (!isPlatformAdmin(context.profile.role)) {
    throw new Error('Only PlatformAdmin users can delete WhatsApp messages.')
  }
  return context
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

export async function deleteWhatsAppMessages(
  _prevState: CommsFormState = INITIAL_STATE,
  formData: FormData
): Promise<CommsFormState> {
  try {
    const { user } = await requirePlatformAdmin()
    const refs = formData.getAll('message_ref')
      .map(parseMessageRef)
      .filter((ref): ref is MessageRef => ref !== null)

    const inboundIds = Array.from(new Set(refs.filter((ref) => ref.direction === 'inbound').map((ref) => ref.id)))
    const outboundIds = Array.from(new Set(refs.filter((ref) => ref.direction === 'outbound').map((ref) => ref.id)))
    const total = inboundIds.length + outboundIds.length

    if (total === 0) return { ok: false, error: 'Select at least one WhatsApp message to delete.' }

    const admin = createAdminClient()
    const deletedAt = new Date().toISOString()
    const payload = { whatsapp_deleted_at: deletedAt, whatsapp_deleted_by: user.id }

    if (inboundIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from('intake_items')
        .update(payload)
        .in('id', inboundIds)
        .not('sender_whatsapp_id', 'is', null)
      if (error) throw new Error(error.message)
    }

    if (outboundIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from('whatsapp_outbound_messages')
        .update(payload)
        .in('id', outboundIds)
      if (error) throw new Error(error.message)
    }

    revalidatePath('/app/comms/whatsapp')
    return { ok: true, message: `Deleted ${total} WhatsApp message${total === 1 ? '' : 's'}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete WhatsApp messages.' }
  }
}
