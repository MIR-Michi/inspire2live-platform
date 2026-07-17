'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  UNIFIED_STATUS_ORDER,
  UNIFIED_STATUS_META,
  type UnifiedStatus,
} from '@/lib/comms-status'
import { isTaskFinished } from '@/lib/tasks/status'
import type { FeedEntry, TeamMemberOption } from '@/lib/comms-dashboard-data'
import { RoleBadge } from '@/components/comms/role-badge'
import { CollapsibleCard, type CollapsibleCardProps } from '@/components/ui/collapsible-card'

type DragProps = Pick<
  CollapsibleCardProps,
  'draggable' | 'isDragging' | 'onDragStart' | 'onDragOver' | 'onDrop' | 'onDragEnd' | 'defaultCollapsed'
>

function formatDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function StatusBadge({ status }: { status: UnifiedStatus }) {
  const meta = UNIFIED_STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}>
      <span aria-hidden>{meta.marker}</span>
      {meta.label}
    </span>
  )
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel
}

/** Filterable feed body for embedding in the adaptive dashboard tile. */
export function TeamFeedContent({ feed, owners }: { feed: FeedEntry[]; owners: TeamMemberOption[] }) {
  const [statuses, setStatuses] = useState<Set<UnifiedStatus>>(new Set())
  const [ownerId, setOwnerId] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [showFinished, setShowFinished] = useState(false)
  const [now] = useState(() => Date.now())

  const toggleStatus = (status: UnifiedStatus) => {
    setStatuses((previous) => {
      const next = new Set(previous)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const finishedCount = useMemo(() => feed.filter((entry) => isTaskFinished(entry.status)).length, [feed])
  const filtered = useMemo(() => {
    const fromTime = from ? new Date(from).getTime() : null
    const toTime = to ? new Date(to).getTime() + 86_400_000 - 1 : null
    const hasStatusFilter = statuses.size > 0

    return feed.filter((entry) => {
      if (!showFinished && !hasStatusFilter && isTaskFinished(entry.status)) return false
      if (hasStatusFilter && !statuses.has(entry.status)) return false
      if (ownerId !== 'all' && entry.ownerId !== ownerId) return false
      if (fromTime !== null || toTime !== null) {
        if (!entry.date) return false
        const time = new Date(entry.date).getTime()
        if (fromTime !== null && time < fromTime) return false
        if (toTime !== null && time > toTime) return false
      }
      return true
    })
  }, [feed, statuses, ownerId, from, to, showFinished])

  const hasFilters = statuses.size > 0 || ownerId !== 'all' || Boolean(from) || Boolean(to) || showFinished

  return (
    <div>
      <div className="mb-4 space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {UNIFIED_STATUS_ORDER.map((status) => {
            const active = statuses.has(status)
            const meta = UNIFIED_STATUS_META[status]
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                aria-pressed={active}
                className={[
                  'inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                  active ? meta.badgeClass : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100',
                ].join(' ')}
              >
                <span aria-hidden>{meta.marker}</span>
                {meta.label}
              </button>
            )
          })}
          {finishedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowFinished((current) => !current)}
              aria-pressed={showFinished}
              className={[
                'inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                showFinished ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100',
              ].join(' ')}
            >
              {showFinished ? 'Hide finished' : 'Show finished'}
              <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">{finishedCount}</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-9 items-center gap-1.5 text-xs font-medium text-neutral-600">
            Owner
            <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none">
              <option value="all">Everyone</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
            </select>
          </label>
          <label className="flex min-h-9 items-center gap-1.5 text-xs font-medium text-neutral-600">
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none" />
          </label>
          <label className="flex min-h-9 items-center gap-1.5 text-xs font-medium text-neutral-600">
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none" />
          </label>
          {!showFinished && statuses.size === 0 && finishedCount > 0 && (
            <span className="text-xs text-neutral-500">{finishedCount} finished {plural(finishedCount, 'item')} hidden by default.</span>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setStatuses(new Set()); setOwnerId('all'); setFrom(''); setTo(''); setShowFinished(false) }}
              className="min-h-9 text-xs font-semibold text-orange-700 hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-neutral-500">{filtered.length} of {feed.length} items</span>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((entry) => {
          const overdue = entry.date != null && !isTaskFinished(entry.status) && new Date(entry.date).getTime() < now
          return (
            <Link key={entry.id} href={entry.href} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 transition hover:bg-neutral-50">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{entry.kindLabel}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{entry.title}</span>
              {entry.ownerLabel && (
                <span className="flex items-center gap-1 text-xs text-neutral-500">
                  {entry.ownerLabel}<RoleBadge role={entry.ownerRole} />
                </span>
              )}
              <StatusBadge status={entry.status} />
              <span className={`shrink-0 text-xs ${overdue ? 'font-bold text-red-600' : 'text-neutral-500'}`}>
                {overdue ? '! ' : ''}{formatDate(entry.date)}
              </span>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
            {hasFilters ? 'No items match the current filters.' : 'No active team activity. Show finished to recover completed or skipped items.'}
          </p>
        )}
      </div>
    </div>
  )
}

/** Backward-compatible card wrapper used outside the adaptive dashboard. */
export function TeamFeed({ feed, owners, ...dragProps }: { feed: FeedEntry[]; owners: TeamMemberOption[] } & DragProps) {
  return (
    <CollapsibleCard title="Update feed" storageKey="comms-team-feed" {...dragProps}>
      <TeamFeedContent feed={feed} owners={owners} />
    </CollapsibleCard>
  )
}
