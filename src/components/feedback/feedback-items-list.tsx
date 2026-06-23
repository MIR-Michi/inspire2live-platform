'use client'

import { useState, useMemo } from 'react'
import { shortUrl, FEEDBACK_TYPE_META, FEEDBACK_STATUS_META, type FeedbackItem } from '@/lib/feedback'
import { FeedbackStatusSelect } from './feedback-status-select'
import { FeedbackDeleteButton } from './feedback-delete-button'

interface Props {
  items: FeedbackItem[]
  statusFilter: string
}

export function FeedbackItemsList({ items, statusFilter }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const byPage = useMemo(() => {
    const map = new Map<string, { shortPath: string; fullUrl: string; items: FeedbackItem[] }>()
    for (const item of items) {
      const key = shortUrl(item.page_url)
      if (!map.has(key)) map.set(key, { shortPath: key, fullUrl: item.page_url, items: [] })
      map.get(key)!.items.push(item)
    }
    return Array.from(map.values())
  }, [items])

  const allSelected = selected.size === items.length && items.length > 0

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportHref =
    selected.size > 0
      ? `/app/admin/feedback/export?ids=${Array.from(selected).join(',')}`
      : statusFilter !== 'all'
      ? `/app/admin/feedback/export?status=${statusFilter}`
      : '/app/admin/feedback/export'

  const exportLabel =
    selected.size > 0
      ? `Export selected (${selected.size})`
      : statusFilter !== 'all'
      ? `Export ${statusFilter} (${items.length})`
      : `Export all (${items.length})`

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="rounded border-neutral-300"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        <a
          href={exportHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v7.69l2.72-2.72a.75.75 0 011.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 011.06-1.06l2.72 2.72V3.75A.75.75 0 0110 3zm-6.75 13.5a.75.75 0 000 1.5h13.5a.75.75 0 000-1.5H3.25z"
              clipRule="evenodd"
            />
          </svg>
          {exportLabel}
        </a>
      </div>

      {/* Items grouped by page */}
      <div className="space-y-6">
        {byPage.map(({ shortPath, fullUrl, items: pageItems }) => (
          <section
            key={shortPath}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
          >
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
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-semibold text-neutral-700 hover:text-orange-600 hover:underline"
              >
                {shortPath}
              </a>
              <span className="ml-auto text-xs text-neutral-400">
                {pageItems.length} item{pageItems.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="divide-y divide-neutral-100">
              {pageItems.map((item) => (
                <FeedbackRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggleItem(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function FeedbackRow({
  item,
  selected,
  onToggle,
}: {
  item: FeedbackItem
  selected: boolean
  onToggle: () => void
}) {
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
    <div className={`px-4 py-4 transition-colors ${selected ? 'bg-orange-50/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-0.5 rounded border-neutral-300 accent-orange-600"
          />
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
        <FeedbackStatusSelect item={item} />
      </div>

      <p className="mt-2 text-sm text-neutral-800">{item.message}</p>

      {(item.element_path || item.element_text) && (
        <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          <span className="font-medium text-neutral-600">On element: </span>
          {item.element_text && (
            <span className="font-medium text-neutral-700">&#34;{item.element_text}&#34;</span>
          )}
          {item.element_path && (
            <span className={`font-mono text-neutral-400${item.element_text ? ' ml-1' : ''}`}>
              ({item.element_path})
            </span>
          )}
        </div>
      )}

      {item.admin_note && (
        <div className="mt-2 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
          <span className="font-semibold">Note: </span>
          {item.admin_note}
        </div>
      )}

      <div className="mt-3">
        <FeedbackDeleteButton itemId={item.id} />
      </div>
    </div>
  )
}
