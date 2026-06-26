'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useOrgNewsfeedRun } from '@/components/comms/use-org-newsfeed-run'
import type { OrgNewsItem } from '@/lib/comms-dashboard-data'
import type { OrgNewsfeedRunStatus } from '@/lib/ai/org-feed-config'

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

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OrgNewsfeedCard({
  items,
  isAdmin,
  aiEnabled,
  initialRunStatus,
}: {
  items: OrgNewsItem[]
  isAdmin: boolean
  aiEnabled: boolean
  initialRunStatus: OrgNewsfeedRunStatus | null
}) {
  const { running, starting, busy, elapsed, message, status, start } = useOrgNewsfeedRun(initialRunStatus)

  const topics = useMemo(() => {
    const seen: string[] = []
    for (const item of items) {
      if (item.topic && !seen.includes(item.topic)) seen.push(item.topic)
    }
    return seen
  }, [items])
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const visibleItems = activeTopic ? items.filter((item) => item.topic === activeTopic) : items

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
            onClick={() => start()}
            disabled={busy || !aiEnabled}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-400"
            title={aiEnabled ? 'Run the web-search job in the background' : 'AI features are disabled'}
          >
            {starting ? 'Starting…' : running ? `Generating… ${elapsed}s` : 'Refresh now'}
          </button>
        </div>
      )}

      {/* A run started by anyone is visible to the whole team. */}
      {running && (
        <p className="text-xs text-neutral-500">
          Updating the feed in the background — searching the web and compiling cited items (usually 1–3 minutes). You can leave this page; items appear when it finishes.
        </p>
      )}

      {!busy && message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>
      )}

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={activeTopic === null} onClick={() => setActiveTopic(null)}>All ({items.length})</FilterChip>
          {topics.map((topic) => (
            <FilterChip key={topic} active={activeTopic === topic} onClick={() => setActiveTopic(topic)}>
              {topic} ({items.filter((i) => i.topic === topic).length})
            </FilterChip>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {visibleItems.map((item) => {
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
                {item.topic && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600">{item.topic}</span>}
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'}`}
    >
      {children}
    </button>
  )
}
