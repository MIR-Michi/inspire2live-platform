'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  UNIFIED_STATUS_ORDER,
  UNIFIED_STATUS_META,
  type UnifiedStatus,
} from '@/lib/comms-status'
import type { FeedEntry, TeamMemberOption } from '@/lib/comms-dashboard-data'
import { RoleBadge } from '@/components/comms/role-badge'

function formatDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function StatusBadge({ status }: { status: UnifiedStatus }) {
  const meta = UNIFIED_STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
    >
      <span aria-hidden>{meta.marker}</span>
      {meta.label}
    </span>
  )
}

export function TeamFeed({ feed, owners }: { feed: FeedEntry[]; owners: TeamMemberOption[] }) {
  const [statuses, setStatuses] = useState<Set<UnifiedStatus>>(new Set())
  const [ownerId, setOwnerId] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const toggleStatus = (status: UnifiedStatus) => {
    setStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const [now] = useState(() => Date.now())
  const filtered = useMemo(() => {
    const fromTime = from ? new Date(from).getTime() : null
    const toTime = to ? new Date(to).getTime() + 86_400_000 - 1 : null
    return feed.filter((entry) => {
      if (statuses.size > 0 && !statuses.has(entry.status)) return false
      if (ownerId !== 'all' && entry.ownerId !== ownerId) return false
      if (fromTime !== null || toTime !== null) {
        if (!entry.date) return false
        const t = new Date(entry.date).getTime()
        if (fromTime !== null && t < fromTime) return false
        if (toTime !== null && t > toTime) return false
      }
      return true
    })
  }, [feed, statuses, ownerId, from, to])

  const hasFilters = statuses.size > 0 || ownerId !== 'all' || from || to

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Update feed</h2>
        <span className="text-xs text-neutral-500">
          {filtered.length} of {feed.length} items
        </span>
      </div>

      {/* Filters */}
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
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                  active ? meta.badgeClass : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100',
                ].join(' ')}
              >
                <span aria-hidden>{meta.marker}</span>
                {meta.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            Owner
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none"
            >
              <option value="all">Everyone</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-xs focus:border-orange-400 focus:outline-none"
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setStatuses(new Set())
                setOwnerId('all')
                setFrom('')
                setTo('')
              }}
              className="text-xs font-semibold text-orange-700 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Feed list */}
      <div className="space-y-2">
        {filtered.map((entry) => {
          const overdue =
            entry.date != null &&
            entry.status !== 'completed' &&
            entry.status !== 'skipped' &&
            new Date(entry.date).getTime() < now
          return (
            <Link
              key={entry.id}
              href={entry.href}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 transition hover:bg-neutral-50"
            >
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {entry.kindLabel}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                {entry.title}
              </span>
              {entry.ownerLabel && (
                <span className="flex items-center gap-1 text-xs text-neutral-500">
                  {entry.ownerLabel}
                  <RoleBadge role={entry.ownerRole} />
                </span>
              )}
              <StatusBadge status={entry.status} />
              <span
                className={`shrink-0 text-xs ${overdue ? 'font-bold text-red-600' : 'text-neutral-500'}`}
              >
                {overdue ? '⚠ ' : ''}
                {formatDate(entry.date)}
              </span>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500">
            {hasFilters ? 'No items match the current filters.' : 'No team activity yet.'}
          </p>
        )}
      </div>
    </section>
  )
}
