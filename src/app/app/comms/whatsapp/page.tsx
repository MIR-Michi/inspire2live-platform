import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { deriveDefaultWindow } from '@/lib/ai/whatsapp-feed-categorization'
import { loadWhatsAppFeed } from '@/lib/comms-whatsapp-feed'
import { loadCampusSessionDates } from '@/modules/ai-features/domain/whatsapp-feed-store'
import {
  WhatsAppWorkspaceShell,
  type CampusOption,
  type DigestItem,
  type DigestSummary,
} from '@/modules/intake/ui/whatsapp-workspace-shell'

export const metadata = { title: 'WhatsApp · Comms' }

function fallbackWindow(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - 35 * 24 * 60 * 60 * 1000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export default async function CommsWhatsAppPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) redirect('/app/comms')

  const aiEnabled = isAiEnabled()
  const canDelete = profile?.role === 'PlatformAdmin'

  // Default window from the two most recent campus meetings; fall back to ~5 weeks.
  const sessionDates = await loadCampusSessionDates(supabase)
  const derived = deriveDefaultWindow(sessionDates)
  const defaultWindow = derived ?? fallbackWindow()

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
  }

  // Right column: the media-rich feed. Scope to the digest window when there is
  // one, otherwise show the recent feed so the page isn't empty.
  const feed = summaryRow
    ? await loadWhatsAppFeed(supabase, { startIso: summaryRow.window_start, endIso: summaryRow.window_end })
    : await loadWhatsAppFeed(supabase, { limit: 200 })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">WhatsApp</h1>
        <p className="text-sm text-neutral-500">
          AI summary and categorization of the community feed on the left; the raw feed (with images and video) on the right. Every item
          is traceable back to its source message.
        </p>
      </div>
      <WhatsAppWorkspaceShell
        aiEnabled={aiEnabled}
        canDelete={canDelete}
        defaultWindow={defaultWindow}
        campusSessions={campusOptions}
        summary={summary}
        items={items}
        feed={feed}
      />
    </div>
  )
}
