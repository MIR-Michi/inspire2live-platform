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

/** A delivery receipt ("statuses" change event) for a message this platform sent. */
export type WhatsAppStatusEvent = {
  providerMessageId: string
  status: WhatsAppDeliveryStatus
  recipientWhatsappId: string | null
  timestamp: string | null
  errorDetail: string | null
}

export type WhatsAppDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed'

type StatusProcessingResult = {
  updated: number
  unmatched: number
  ignored: number
}

// Monotonic progression of a successful delivery. A receipt only moves the
// status forward (sent -> delivered -> read); out-of-order or duplicate
// receipts that would move it backwards are ignored. `failed` is terminal and
// always recorded regardless of the current rank.
const DELIVERY_STATUS_RANK: Record<WhatsAppDeliveryStatus, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

const VALID_DELIVERY_STATUSES = new Set<WhatsAppDeliveryStatus>([
  'sent',
  'delivered',
  'read',
  'failed',
])

function isDeliveryStatus(value: string): value is WhatsAppDeliveryStatus {
  return VALID_DELIVERY_STATUSES.has(value as WhatsAppDeliveryStatus)
}

function metaTimestampToIso(value: unknown): string | null {
  // Meta reports status timestamps as Unix epoch seconds, encoded as a string.
  const text = asText(value)
  if (!text) return null
  const seconds = Number(text)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function extractStatusErrorDetail(status: Record<string, unknown>): string | null {
  for (const error of asArray(status.errors)) {
    const errorRecord = asRecord(error)
    if (!errorRecord) continue
    const title = asText(errorRecord.title)
    const message = asText(errorRecord.message)
    const detail = [title, message].filter(Boolean).join(' — ')
    if (detail) return detail
  }
  return null
}

/**
 * Pull delivery receipts out of a webhook payload. These ride in the same
 * `entry[].changes[].value.statuses[]` envelope as inbound messages but are a
 * distinct shape — each references a `graph_message_id` we previously sent.
 */
export function parseWhatsAppStatusEvents(payload: unknown): WhatsAppStatusEvent[] {
  const root = asRecord(payload)
  if (!root) return []

  const events: WhatsAppStatusEvent[] = []

  for (const entry of asArray(root.entry)) {
    const entryRecord = asRecord(entry)
    if (!entryRecord) continue

    for (const change of asArray(entryRecord.changes)) {
      const changeRecord = asRecord(change)
      const value = asRecord(changeRecord?.value)
      if (!value) continue

      for (const status of asArray(value.statuses)) {
        const record = asRecord(status)
        if (!record) continue

        const providerMessageId = asText(record.id)
        const rawStatus = asText(record.status)
        if (!providerMessageId || !isDeliveryStatus(rawStatus)) continue

        events.push({
          providerMessageId,
          status: rawStatus,
          recipientWhatsappId: asText(record.recipient_id) || null,
          timestamp: metaTimestampToIso(record.timestamp),
          errorDetail: rawStatus === 'failed' ? extractStatusErrorDetail(record) : null,
        })
      }
    }
  }

  return events
}

type OutboundStatusRow = Pick<
  Database['public']['Tables']['whatsapp_outbound_messages']['Row'],
  'id' | 'delivery_status' | 'delivered_at' | 'read_at'
>

type OutboundStatusState = {
  delivery_status: string
  delivered_at: string | null
  read_at: string | null
}

type ResolvedStatusUpdate = {
  apply: boolean
  update: Database['public']['Tables']['whatsapp_outbound_messages']['Update']
}

/**
 * Decide how a delivery receipt should mutate an outbound row, given its
 * current state. Pure so the forward-only ranking rules can be tested without a
 * database. Returns `apply: false` when the receipt is stale (would regress or
 * repeat the current status); `failed` always applies.
 */
export function resolveStatusUpdate(
  current: OutboundStatusState,
  event: Pick<WhatsAppStatusEvent, 'status' | 'timestamp' | 'errorDetail'>
): ResolvedStatusUpdate {
  const currentRank = isDeliveryStatus(current.delivery_status)
    ? DELIVERY_STATUS_RANK[current.delivery_status]
    : 0
  const nextRank = DELIVERY_STATUS_RANK[event.status]

  if (event.status !== 'failed' && nextRank <= currentRank) {
    return { apply: false, update: {} }
  }

  const update: Database['public']['Tables']['whatsapp_outbound_messages']['Update'] = {
    delivery_status: event.status,
  }

  if (event.status === 'delivered' && !current.delivered_at) {
    update.delivered_at = event.timestamp
  }
  if (event.status === 'read') {
    // A read receipt implies delivery even if we never saw the 'delivered' event.
    if (!current.delivered_at) update.delivered_at = event.timestamp
    if (!current.read_at) update.read_at = event.timestamp
  }
  if (event.status === 'failed') {
    update.error_detail = event.errorDetail
  }

  return { apply: true, update }
}

/**
 * Apply delivery receipts to the outbound messages they reference, matched by
 * `graph_message_id`. Status only advances forward; receipts for messages this
 * platform didn't send (no matching row) are counted as `unmatched` and
 * skipped without error.
 */
export async function processWhatsAppStatusEvents(
  admin: AdminClient,
  payload: unknown
): Promise<StatusProcessingResult> {
  const events = parseWhatsAppStatusEvents(payload)
  if (events.length === 0) return { updated: 0, unmatched: 0, ignored: 0 }

  let updated = 0
  let unmatched = 0
  let ignored = 0

  for (const event of events) {
    const { data: existing, error: lookupError } = await admin
      .from('whatsapp_outbound_messages')
      .select('id, delivery_status, delivered_at, read_at')
      .eq('graph_message_id', event.providerMessageId)
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)

    const row = existing as OutboundStatusRow | null
    if (!row) {
      unmatched += 1
      continue
    }

    const { apply, update } = resolveStatusUpdate(row, event)
    if (!apply) {
      ignored += 1
      continue
    }

    const { error: updateError } = await admin
      .from('whatsapp_outbound_messages')
      .update(update)
      .eq('id', row.id)

    if (updateError) throw new Error(updateError.message)
    updated += 1
  }

  return { updated, unmatched, ignored }
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

/**
 * Reconstruct a minimal webhook envelope around a single stored message record.
 *
 * `whatsapp_webhook_events.payload` holds the individual inbound message record
 * (not the full Meta envelope), so to re-run it through the standard processor
 * we wrap it back into the `entry[].changes[].value.messages[]` shape the parser
 * expects, re-attaching the sender's name as a contact so classification is
 * identical to the original run.
 */
export function buildWebhookEnvelopeFromStoredMessage(input: {
  payload: unknown
  senderWhatsappId: string | null
  senderName: string | null
}): unknown {
  const record = asRecord(input.payload) ?? {}
  const from = asText(record.from) || input.senderWhatsappId || ''
  const contacts = input.senderName && from ? [{ wa_id: from, profile: { name: input.senderName } }] : []

  return {
    entry: [{ changes: [{ value: { contacts, messages: [record] } }] }],
  }
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
        channel: 'communications' as const,
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
