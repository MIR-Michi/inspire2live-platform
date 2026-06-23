import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FEEDBACK_STATUS_META,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/lib/feedback'
import { FeedbackItemsList } from '@/components/feedback/feedback-items-list'

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') redirect('/app/dashboard')

  const params = await searchParams
  const statusFilter = (params.status as FeedbackStatus | 'all') ?? 'all'

  const db = createAdminClient()
  let query = db.from('feedback_items').select('*').order('created_at', { ascending: false })
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)

  const { data: items } = await query
  const allItems = (items ?? []) as unknown as FeedbackItem[]

  // Counts per status for the filter tabs
  const { data: counts } = await db.from('feedback_items').select('status')
  const statusCounts = { open: 0, reviewed: 0, resolved: 0, all: 0 }
  for (const row of (counts ?? []) as { status: string }[]) {
    statusCounts.all++
    if (row.status === 'open' || row.status === 'reviewed' || row.status === 'resolved') {
      statusCounts[row.status]++
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Feedback</h1>
          <p className="text-sm text-neutral-500">Contextual feedback submitted by testers</p>
        </div>
        <a
          href="/app/admin/users"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          ← User Management
        </a>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'reviewed', 'resolved'] as const).map((s) => (
          <a
            key={s}
            href={s === 'all' ? '/app/admin/feedback' : `/app/admin/feedback?status=${s}`}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              statusFilter === s
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-50',
            ].join(' ')}
          >
            {s === 'all' ? 'All' : FEEDBACK_STATUS_META[s].label}{' '}
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {statusCounts[s]}
            </span>
          </a>
        ))}
      </div>

      {allItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">No feedback items yet.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Testers can activate test mode and leave contextual feedback on any page.
          </p>
        </div>
      ) : (
        <FeedbackItemsList items={allItems} statusFilter={statusFilter} />
      )}
    </div>
  )
}
