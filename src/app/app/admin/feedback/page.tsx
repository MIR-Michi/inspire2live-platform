import { redirect } from 'next/navigation'
import {
  FEEDBACK_STATUS_META,
  FeedbackItemsList,
  loadFeedbackItems,
  loadFeedbackStatusCounts,
  requireFeedbackAdmin,
  type FeedbackStatus,
} from '@/modules/feedback'

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const gate = await requireFeedbackAdmin()
  if (gate.reason === 'unauthenticated') redirect('/login')
  if (gate.reason === 'forbidden') redirect('/app/dashboard')

  const params = await searchParams
  const statusFilter = (params.status as FeedbackStatus | 'all') ?? 'all'

  const allItems = await loadFeedbackItems({ status: statusFilter })
  const statusCounts = await loadFeedbackStatusCounts()

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
