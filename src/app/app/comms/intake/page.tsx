import { createClient } from '@/lib/supabase/server'
import { IntakeQueueShell } from '@/components/comms/intake-queue-shell'
import { matchesIntakeFilter, type IntakeFilter } from '@/lib/comms-workflow'

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

export default async function CommsIntakePage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const params = (await searchParams) ?? {}
  const requestedFilter = (params.filter ?? 'all') as IntakeFilter
  const filter = VALID_FILTERS.has(requestedFilter) ? requestedFilter : 'all'

  const supabase = await createClient()
  const [{ data }, { data: initiatives }, { data: recoveryRequests }] = await Promise.all([
    supabase
      .from('intake_items')
      .select(
        'id, sender_name, raw_content, source_url, attached_media_ref, content_type, classification_confidence, status, captured_at, is_peter_kapitein, dismissed_reason'
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

  const items = ((data ?? []) as Array<{
    id: string
    sender_name: string
    raw_content: string
    source_url: string | null
    attached_media_ref?: string | null
    content_type: string
    classification_confidence: string | null
    status: string
    captured_at: string
    is_peter_kapitein: boolean
    dismissed_reason: string | null
  }>).filter((item) => matchesIntakeFilter(item, filter))

  const unreviewedCount = (data ?? []).filter((item) => item.status === 'unreviewed').length

  return (
    <IntakeQueueShell
      items={items}
      filter={filter}
      unreviewedCount={unreviewedCount}
      initiatives={(initiatives ?? []).map((initiative) => ({
        id: initiative.id,
        label: initiative.title,
      }))}
      recoveryRequests={(recoveryRequests ?? []).map((request) => ({
        id: request.id,
        label: request.title,
      }))}
    />
  )
}
