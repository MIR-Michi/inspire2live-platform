import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FEEDBACK_TYPE_META,
  FEEDBACK_STATUS_META,
  shortUrl,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/lib/feedback'
import { FeedbackStatusSelect } from '@/components/feedback/feedback-status-select'
import { FeedbackDeleteButton } from '@/components/feedback/feedback-delete-button'

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page_filter?: string }>
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

  // Counts per status
  const { data: counts } = await db
    .from('feedback_items')
    .select('status')
  const statusCounts = { open: 0, reviewed: 0, resolved: 0, all: 0 }
  for (const row of (counts ?? []) as { status: string }[]) {
    statusCounts.all++
    if (row.status === 'open' || row.status === 'reviewed' || row.status === 'resolved') {
      statusCounts[row.status]++
    }
  }

  // Group items by page URL for display
  const byPage = new Map<string, FeedbackItem[]>()
  for (const item of allItems) {
    const key = shortUrl(item.page_url)
    if (!byPage.has(key)) byPage.set(key, [])
    byPage.get(key)!.push(item)
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
            {s}{' '}
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
        <div className="space-y-6">
          {Array.from(byPage.entries()).map(([page, pageItems]) => (
            <section key={page} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <svg
                  className="h-4 w-4 shrink-0 text-neutral-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm4.03 6.28a.75.75 0 00-1.06-1.06L5 9.44l-.72-.72a.75.75 0 00-1.06 1.06l1.25 1.25a.75.75 0 001.06 0l2.75-2.75zm4.28-.22a.75.75 0 10-1.06 1.06l1.5 1.5a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-2.47 2.47-1.97-1.97z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-mono text-sm font-semibold text-neutral-700">{page}</span>
                <span className="ml-auto text-xs text-neutral-400">
                  {pageItems.length} item{pageItems.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="divide-y divide-neutral-100">
                {pageItems.map((item) => (
                  <FeedbackRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const typeMeta = FEEDBACK_TYPE_META[item.feedback_type]
  const statusMeta = FEEDBACK_STATUS_META[item.status]

  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.created_at))

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeMeta.color}`}>
            {typeMeta.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          <span className="text-xs text-neutral-500">
            {item.user_name ?? 'Unknown'} · {item.user_role ?? '—'} · {date}
          </span>
        </div>

        {/* Status form */}
        <FeedbackStatusSelect item={item} />
      </div>

      {/* Message */}
      <p className="mt-2 text-sm text-neutral-800">{item.message}</p>

      {/* Element context */}
      {(item.element_path || item.element_text) && (
        <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {item.element_path && (
            <p className="font-mono">
              <span className="font-medium text-neutral-600">Path: </span>
              {item.element_path}
            </p>
          )}
          {item.element_text && (
            <p className="mt-0.5">
              <span className="font-medium text-neutral-600">Text: </span>
              {item.element_text}
            </p>
          )}
        </div>
      )}

      {/* Admin note */}
      {item.admin_note && (
        <div className="mt-2 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
          <span className="font-semibold">Note: </span>
          {item.admin_note}
        </div>
      )}

      {/* Delete */}
      <div className="mt-3">
        <FeedbackDeleteButton itemId={item.id} />
      </div>
    </div>
  )
}
