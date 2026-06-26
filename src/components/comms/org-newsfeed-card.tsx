'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { refreshOrgNewsfeed, type NewsfeedActionState } from '@/app/app/comms/dashboard/newsfeed-actions'
import type { OrgNewsItem } from '@/lib/comms-dashboard-data'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  medical: { label: 'Medical', color: 'bg-blue-100 text-blue-700' },
  research: { label: 'Research', color: 'bg-indigo-100 text-indigo-700' },
  policy: { label: 'Policy', color: 'bg-teal-100 text-teal-700' },
  advocacy: { label: 'Advocacy', color: 'bg-orange-100 text-orange-700' },
  funding: { label: 'Funding', color: 'bg-amber-100 text-amber-700' },
  event: { label: 'Event', color: 'bg-purple-100 text-purple-700' },
  mention: { label: 'Mention', color: 'bg-pink-100 text-pink-700' },
  other: { label: 'News', color: 'bg-neutral-100 text-neutral-700' },
}

const INITIAL_STATE: NewsfeedActionState = { ok: false }

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OrgNewsfeedCard({
  items,
  isAdmin,
  aiEnabled,
}: {
  items: OrgNewsItem[]
  isAdmin: boolean
  aiEnabled: boolean
}) {
  const [state, setState] = useState<NewsfeedActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const onRefresh = () => {
    startTransition(async () => setState(await refreshOrgNewsfeed(INITIAL_STATE)))
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/app/admin/org-feed"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Configure feed
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending || !aiEnabled}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-400"
            title={aiEnabled ? 'Run the web-search job now' : 'AI features are disabled'}
          >
            {pending ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      )}

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other
          return (
            <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {item.sourceUrl ? (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-semibold leading-snug text-neutral-900 hover:text-orange-700 hover:underline">
                    {item.headline}
                  </a>
                ) : (
                  <p className="flex-1 text-sm font-semibold leading-snug text-neutral-900">{item.headline}</p>
                )}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
              </div>
              {item.summary && <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">{item.summary}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                {item.mentionOf && <span className="rounded-full bg-pink-50 px-2 py-0.5 font-medium text-pink-700">Mentions {item.mentionOf}</span>}
                {item.sourceName && <span>{item.sourceName}</span>}
                {item.region && (<><span>·</span><span>{item.region}</span></>)}
                {item.publishedAt && (<><span>·</span><span>{formatDate(item.publishedAt)}</span></>)}
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center">
            <p className="text-sm text-neutral-400">No newsfeed items yet.</p>
            {isAdmin ? (
              <p className="mt-1 text-xs text-neutral-400">
                <Link href="/app/admin/org-feed" className="font-medium text-orange-600 hover:underline">Configure the feed</Link> and run it to populate org-wide news with citations.
              </p>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">An admin can configure the organization news feed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
