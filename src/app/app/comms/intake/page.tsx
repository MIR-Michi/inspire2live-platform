import { createClient } from '@/lib/supabase/server'
import { IntakeQueueShell } from '@/components/comms/intake-queue-shell'
import { matchesIntakeFilter, type IntakeFilter } from '@/lib/comms-workflow'
import type { Database } from '@/types/database'

const VALID_FILTERS = new Set<IntakeFilter>([
  'all',
  'events',
  'articles',
  'members',
  'initiative_updates',
  'media_requests',
  'peter_messages',
  'dismissed',
])

type IntakeReason = {
  ruleId: string
  label: string
  evidence: string
  effect: 'type' | 'confidence' | 'founder_signal'
}

type IntakeQueueItem = {
  id: string
  capture_method: string
  sender_name: string
  sender_whatsapp_id: string | null
  raw_content: string
  source_url: string | null
  attached_media_ref?: string | null
  content_type: string
  classification_confidence: string | null
  classifier_status: string
  classifier_version: string | null
  classifier_reasoning: IntakeReason[]
  classifier_rule_ids: string[]
  status: string
  captured_at: string
  is_peter_kapitein: boolean
  dismissed_reason: string | null
}

function isMissingSchemaField(message: string | null | undefined) {
  if (!message) return false
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  )
}

function normalizeIntakeItems(
  rows: Array<
    Partial<IntakeQueueItem> &
      Pick<
        Database['public']['Tables']['intake_items']['Row'],
        | 'id'
        | 'capture_method'
        | 'sender_name'
        | 'sender_whatsapp_id'
        | 'raw_content'
        | 'source_url'
        | 'content_type'
        | 'status'
        | 'captured_at'
        | 'is_peter_kapitein'
      >
  >
): IntakeQueueItem[] {
  return rows.map((item) => ({
    id: item.id,
    capture_method: item.capture_method,
    sender_name: item.sender_name,
    sender_whatsapp_id: item.sender_whatsapp_id ?? null,
    raw_content: item.raw_content,
    source_url: item.source_url ?? null,
    attached_media_ref: item.attached_media_ref ?? null,
    content_type: item.content_type,
    classification_confidence: item.classification_confidence ?? null,
    classifier_status: item.classifier_status ?? (item.capture_method === 'manual' ? 'manual' : 'legacy'),
    classifier_version: item.classifier_version ?? null,
    classifier_reasoning: item.classifier_reasoning ?? [],
    classifier_rule_ids: item.classifier_rule_ids ?? [],
    status: item.status,
    captured_at: item.captured_at,
    is_peter_kapitein: item.is_peter_kapitein ?? false,
    dismissed_reason: item.dismissed_reason ?? null,
  }))
}

export default async function CommsIntakePage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const params = (await searchParams) ?? {}
  const requestedFilter = (params.filter ?? 'all') as IntakeFilter
  const filter = VALID_FILTERS.has(requestedFilter) ? requestedFilter : 'all'

  const supabase = await createClient()
  const [intakeResult, initiativesResult, recoveryResult] = await Promise.all([
    supabase
      .from('intake_items')
      .select(
        'id, capture_method, sender_name, sender_whatsapp_id, raw_content, source_url, attached_media_ref, content_type, classification_confidence, classifier_status, classifier_version, classifier_reasoning, classifier_rule_ids, status, captured_at, is_peter_kapitein, dismissed_reason'
      )
      .order('captured_at', { ascending: false })
      .limit(200),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase
      .from('media_recovery_requests')
      .select('id, title, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  let intakeRows = intakeResult.data as IntakeQueueItem[] | null
  if (intakeResult.error && isMissingSchemaField(intakeResult.error.message)) {
    const fallbackResult = await supabase
      .from('intake_items')
      .select(
        'id, capture_method, sender_name, sender_whatsapp_id, raw_content, source_url, attached_media_ref, content_type, classification_confidence, status, captured_at, is_peter_kapitein, dismissed_reason'
      )
      .order('captured_at', { ascending: false })
      .limit(200)

    if (fallbackResult.error) throw new Error(fallbackResult.error.message)
    intakeRows = normalizeIntakeItems(fallbackResult.data ?? [])
  } else if (intakeResult.error) {
    throw new Error(intakeResult.error.message)
  }

  const recoveryRequests =
    recoveryResult.error && isMissingSchemaField(recoveryResult.error.message) ? [] : (recoveryResult.data ?? [])

  const items = normalizeIntakeItems(intakeRows ?? []).filter((item) => matchesIntakeFilter(item, filter))

  const unreviewedCount = normalizeIntakeItems(intakeRows ?? []).filter((item) => item.status === 'unreviewed').length

  return (
    <IntakeQueueShell
      items={items}
      filter={filter}
      unreviewedCount={unreviewedCount}
      initiatives={(initiativesResult.data ?? []).map((initiative) => ({
        id: initiative.id,
        label: initiative.title,
      }))}
      recoveryRequests={recoveryRequests.map((request) => ({
        id: request.id,
        label: request.title,
      }))}
    />
  )
}
