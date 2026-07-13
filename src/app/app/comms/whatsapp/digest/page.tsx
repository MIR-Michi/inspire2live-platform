import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { deriveDefaultWindow } from '@/lib/ai/whatsapp-feed-categorization'
import { loadCampusSessionDates, loadWhatsAppFeedWindow } from '@/modules/ai-features/domain/whatsapp-feed-store'
import {
  WhatsAppDigestShell,
  type CampusOption,
  type DigestItem,
  type DigestSummary,
} from '@/modules/intake/ui/whatsapp-digest-shell'

export const metadata = { title: 'WhatsApp digest · Comms' }

function isoToDateInput(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function fallbackWindow(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - 35 * 24 * 60 * 60 * 1000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export default async function WhatsAppDigestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) redirect('/app/comms')

  const aiEnabled = isAiEnabled()

  // Default window from the two most recent campus meetings; fall back to ~5 weeks.
  const sessionDates = await loadCampusSessionDates(supabase)
  const derived = deriveDefaultWindow(sessionDates)
  const defaultWindow = derived ?? fallbackWindow()

  const campusSessions: CampusOption[] = sessionDates.map((d) => ({ id: d, label: d }))
  // The campus select posts session ids; re-load id + date for accurate options.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: sessionRows } = await db
    .from('campus_sessions')
    .select('id, session_date, theme')
    .order('session_date', { ascending: false })
    .limit(12)
  const campusOptions: CampusOption[] = ((sessionRows ?? []) as Array<{ id: string; session_date: string; theme: string | null }>).map(
    (s) => ({ id: s.id, label: `${s.session_date}${s.theme ? ` — ${s.theme}` : ''}` })
  )

  // Latest reviewable digest (most recent pending or saved run).
  const { data: summaryRows } = await db
    .from('whatsapp_feed_summaries')
    .select('id, window_start, window_end, monthly, tldr, monthly_summary, message_count, status, model, created_at')
    .in('status', ['pending', 'saved'])
    .order('created_at', { ascending: false })
    .limit(1)

  const summaryRow = (summaryRows ?? [])[0] as
    | {
        id: string
        window_start: string
        window_end: string
        monthly: boolean
        tldr: string
        monthly_summary: string | null
        message_count: number
        status: string
        model: string | null
      }
    | undefined

  let summary: DigestSummary | null = null
  let items: DigestItem[] = []
  let feed: Awaited<ReturnType<typeof loadWhatsAppFeedWindow>> = []

  if (summaryRow) {
    summary = {
      id: summaryRow.id,
      windowStart: summaryRow.window_start,
      windowEnd: summaryRow.window_end,
      monthly: Boolean(summaryRow.monthly),
      tldr: summaryRow.tldr,
      monthlySummary: summaryRow.monthly_summary,
      status: summaryRow.status,
      messageCount: summaryRow.message_count ?? 0,
      model: summaryRow.model,
    }

    const { data: itemRows } = await db
      .from('whatsapp_feed_items')
      .select('id, category, title, person, item_date, detail, source_message_ids, proposal_status, linked_type')
      .eq('summary_id', summaryRow.id)
      .order('created_at', { ascending: true })

    items = ((itemRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      category: String(row.category),
      title: String(row.title ?? ''),
      person: (row.person as string | null) ?? null,
      date: (row.item_date as string | null) ?? null,
      detail: (row.detail as string | null) ?? null,
      sourceMessageIds: Array.isArray(row.source_message_ids) ? (row.source_message_ids as string[]) : [],
      proposalStatus: String(row.proposal_status ?? 'none'),
      linkedType: (row.linked_type as string | null) ?? null,
    }))

    feed = await loadWhatsAppFeedWindow(supabase, {
      startIso: summaryRow.window_start,
      endIso: summaryRow.window_end,
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">WhatsApp digest</h1>
        <p className="text-sm text-neutral-500">
          AI summary and categorization of the community WhatsApp feed for a window, with every item traceable back to its
          source message.
        </p>
      </div>
      <WhatsAppDigestShell
        aiEnabled={aiEnabled}
        defaultWindow={{ start: isoToDateInput(`${defaultWindow.start}T00:00:00Z`) || defaultWindow.start, end: isoToDateInput(`${defaultWindow.end}T00:00:00Z`) || defaultWindow.end }}
        campusSessions={campusOptions.length > 0 ? campusOptions : campusSessions}
        summary={summary}
        items={items}
        feed={feed}
      />
    </div>
  )
}
