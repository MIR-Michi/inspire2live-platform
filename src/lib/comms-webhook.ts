import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyIntakeItem, parseSourceUrl, toClassifierRules } from '@/lib/comms-classifier'
import type { Database } from '@/types/database'

type AdminClient = SupabaseClient<Database>
type ClassifierRuleRow = Database['public']['Tables']['intake_classifier_rules']['Row']
type WebhookPayloadJson = Database['public']['Tables']['whatsapp_webhook_events']['Insert']['payload']

type WhatsAppInboundMessage = {
  providerMessageId: string
  senderWhatsappId: string
  senderName: string
  rawContent: string
  attachedMediaRef: string | null
  sourceUrl: string | null
  payload: Record<string, unknown>
}

type WebhookProcessingResult = {
  accepted: number
  duplicates: number
  failures: number
  intakeItemIds: string[]
}

type WebhookEventRow = Pick<
  Database['public']['Tables']['whatsapp_webhook_events']['Row'],
  'id' | 'intake_item_id' | 'processing_status'
>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function extractRawContent(message: Record<string, unknown>) {
  const type = asText(message.type)
  const text = asRecord(message.text)
  const image = asRecord(message.image)
  const document = asRecord(message.document)
  const video = asRecord(message.video)

  if (type === 'text') return asText(text?.body)
  if (type === 'image') return asText(image?.caption) || 'Inbound WhatsApp image'
  if (type === 'document') return asText(document?.caption) || asText(document?.filename) || 'Inbound WhatsApp document'
  if (type === 'video') return asText(video?.caption) || 'Inbound WhatsApp video'
  return `Inbound WhatsApp ${type || 'message'}`
}

function extractAttachedMediaRef(message: Record<string, unknown>) {
  const type = asText(message.type)
  if (!['image', 'video', 'document'].includes(type)) return null
  const node = asRecord(message[type])
  const mediaId = asText(node?.id)
  const filename = asText(node?.filename)
  return filename || mediaId || null
}

export function parseWhatsAppWebhookPayload(payload: unknown): WhatsAppInboundMessage[] {
  const root = asRecord(payload)
  if (!root) return []

  const inbound: WhatsAppInboundMessage[] = []

  for (const entry of asArray(root.entry)) {
    const entryRecord = asRecord(entry)
    if (!entryRecord) continue

    for (const change of asArray(entryRecord.changes)) {
      const changeRecord = asRecord(change)
      const value = asRecord(changeRecord?.value)
      if (!value) continue

      const contacts = new Map<string, string>()
      for (const contact of asArray(value.contacts)) {
        const contactRecord = asRecord(contact)
        if (!contactRecord) continue
        const waId = asText(contactRecord.wa_id)
        const profile = asRecord(contactRecord.profile)
        const name = asText(profile?.name)
        if (waId && name) contacts.set(waId, name)
      }

      for (const message of asArray(value.messages)) {
        const record = asRecord(message)
        if (!record) continue

        const senderWhatsappId = asText(record.from)
        const rawContent = extractRawContent(record)
        const sourceUrl = parseSourceUrl(rawContent)

        inbound.push({
          providerMessageId: asText(record.id),
          senderWhatsappId,
          senderName: contacts.get(senderWhatsappId) || senderWhatsappId || 'WhatsApp contact',
          rawContent,
          attachedMediaRef: extractAttachedMediaRef(record),
          sourceUrl,
          payload: record,
        })
      }
    }
  }

  return inbound
}

export async function processWhatsAppWebhookPayload(
  admin: AdminClient,
  payload: unknown
): Promise<WebhookProcessingResult> {
  const messages = parseWhatsAppWebhookPayload(payload)
  if (messages.length === 0) return { accepted: 0, duplicates: 0, failures: 0, intakeItemIds: [] }

  const { data: ruleRows, error: rulesError } = await admin
    .from('intake_classifier_rules')
    .select(
      'id, rule_name, description, match_field, match_type, pattern, suggested_content_type, suggested_confidence, marks_peter, priority'
    )
    .eq('is_enabled', true)
    .order('priority', { ascending: false })

  if (rulesError) throw new Error(rulesError.message)
  const rules = toClassifierRules((ruleRows ?? []) as ClassifierRuleRow[])

  let accepted = 0
  let duplicates = 0
  let failures = 0
  const intakeItemIds: string[] = []

  for (const message of messages) {
    let intakeItemId: string | null = null

    try {
      const { data: existingEvent, error: existingError } = await admin
        .from('whatsapp_webhook_events')
        .select('id, intake_item_id, processing_status')
        .eq('provider_message_id', message.providerMessageId)
        .maybeSingle()

      if (existingError) throw new Error(existingError.message)

      if ((existingEvent as WebhookEventRow | null)?.processing_status === 'accepted') {
        duplicates += 1
        continue
      }

      const result = classifyIntakeItem(
        {
          senderName: message.senderName,
          rawContent: message.rawContent,
          sourceUrl: message.sourceUrl,
          attachedMediaRef: message.attachedMediaRef,
        },
        rules
      )

      const intakeItemPayload = {
        provider_message_id: message.providerMessageId,
        capture_method: 'webhook',
        sender_name: message.senderName,
        sender_whatsapp_id: message.senderWhatsappId || null,
        raw_content: message.rawContent,
        source_url: message.sourceUrl,
        attached_media_ref: message.attachedMediaRef,
        content_type: result.contentType,
        classification_confidence: result.confidence,
        is_peter_kapitein: result.isPeterKapitein,
        status: 'unreviewed',
        classifier_version: result.classifierVersion,
        classifier_status: 'auto_classified',
        classifier_reasoning: result.reasoning,
        classifier_rule_ids: result.matchedRuleIds,
      }

      const { data: existingIntakeItem, error: existingIntakeError } = await admin
        .from('intake_items')
        .select('id')
        .eq('provider_message_id', message.providerMessageId)
        .maybeSingle()

      if (existingIntakeError) throw new Error(existingIntakeError.message)

      if (existingIntakeItem?.id) {
        intakeItemId = existingIntakeItem.id

        const { error: intakeUpdateError } = await admin
          .from('intake_items')
          .update(intakeItemPayload)
          .eq('id', existingIntakeItem.id)

        if (intakeUpdateError) throw new Error(intakeUpdateError.message)
      } else {
        const { data: intakeItem, error: intakeError } = await admin
          .from('intake_items')
          .insert(intakeItemPayload)
          .select('id')
          .maybeSingle()

        if (intakeError) throw new Error(intakeError.message)
        intakeItemId = intakeItem?.id ?? null
      }

      const { error: eventError } = await admin.from('whatsapp_webhook_events').upsert({
        provider_message_id: message.providerMessageId,
        sender_whatsapp_id: message.senderWhatsappId || null,
        sender_name: message.senderName,
        payload: message.payload as WebhookPayloadJson,
        intake_item_id: intakeItemId,
        processing_status: 'accepted',
        failure_reason: null,
        processed_at: new Date().toISOString(),
      }, { onConflict: 'provider_message_id' })

      if (eventError) throw new Error(eventError.message)

      accepted += 1
      if (intakeItemId) intakeItemIds.push(intakeItemId)
    } catch (error) {
      failures += 1
      await admin.from('whatsapp_webhook_events').upsert(
        {
          provider_message_id: message.providerMessageId,
          sender_whatsapp_id: message.senderWhatsappId || null,
          sender_name: message.senderName,
          payload: message.payload as WebhookPayloadJson,
          intake_item_id: intakeItemId,
          processing_status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown webhook processing error',
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'provider_message_id' }
      )
    }
  }

  return { accepted, duplicates, failures, intakeItemIds }
}
