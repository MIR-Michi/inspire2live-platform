'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import type { WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'
import {
  runWhatsAppDigest,
  saveWhatsAppDigest,
  discardWhatsAppDigest,
  confirmBirthday,
  confirmEvent,
  confirmNewMember,
  dismissWhatsAppItem,
  type DigestActionState,
} from '@/app/app/comms/whatsapp/digest/actions'
import { WhatsAppFeedList } from './whatsapp-feed-list'

export type DigestItem = {
  id: string
  category: string
  title: string
  person: string | null
  date: string | null
  detail: string | null
  sourceMessageIds: string[]
  proposalStatus: string
  linkedType: string | null
}

export type DigestSummary = {
  id: string
  windowStart: string
  windowEnd: string
  monthly: boolean
  tldr: string
  monthlySummary: string | null
  status: string
  messageCount: number
  model: string | null
}

export type CampusOption = { id: string; label: string }

const INITIAL: DigestActionState = { ok: false }

const CATEGORY_META: Record<string, { label: string; badge: string }> = {
  birthday: { label: 'Birthday', badge: 'bg-pink-100 text-pink-700' },
  new_member: { label: 'New member', badge: 'bg-emerald-100 text-emerald-700' },
  event: { label: 'Event', badge: 'bg-amber-100 text-amber-700' },
  question: { label: 'Question / request', badge: 'bg-sky-100 text-sky-700' },
  news: { label: 'News / info', badge: 'bg-indigo-100 text-indigo-700' },
  i2l_initiative: { label: 'I2L initiative', badge: 'bg-orange-100 text-orange-700' },
  other: { label: 'Other', badge: 'bg-neutral-100 text-neutral-600' },
}

const CONFIRM_ACTION: Record<string, typeof confirmBirthday> = {
  birthday: confirmBirthday,
  new_member: confirmNewMember,
  event: confirmEvent,
}

function formatDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(d)
}

function ActionButton({
  action,
  hidden,
  label,
  pendingLabel,
  variant = 'neutral',
}: {
  action: (prev: DigestActionState, fd: FormData) => Promise<DigestActionState>
  hidden: Record<string, string>
  label: string
  pendingLabel: string
  variant?: 'primary' | 'neutral' | 'ghost'
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  const cls =
    variant === 'primary'
      ? 'bg-orange-600 text-white hover:bg-orange-500'
      : variant === 'ghost'
        ? 'text-neutral-500 hover:text-neutral-800'
        : 'bg-neutral-900 text-white hover:bg-neutral-700'
  return (
    <form action={formAction} className="inline-flex flex-col">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${cls}`}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && <span className="mt-1 text-[11px] font-medium text-red-600">{state.error}</span>}
    </form>
  )
}

export function WhatsAppWorkspaceShell({
  aiEnabled,
  canDelete,
  defaultWindow,
  campusSessions,
  summary,
  items,
  feed,
}: {
  aiEnabled: boolean
  canDelete: boolean
  defaultWindow: { start: string; end: string }
  campusSessions: CampusOption[]
  summary: DigestSummary | null
  items: DigestItem[]
  feed: WhatsAppThreadMessage[]
}) {
  const [runState, runAction, running] = useActionState(runWhatsAppDigest, INITIAL)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const feedRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const registerRef = (id: string, el: HTMLLIElement | null) => {
    if (el) feedRefs.current.set(id, el)
    else feedRefs.current.delete(id)
  }

  const selectItem = (item: DigestItem) => {
    setSelectedIds(new Set(item.sourceMessageIds))
    const first = item.sourceMessageIds.find((id) => feedRefs.current.has(id))
    if (first) feedRefs.current.get(first)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const activeItems = items.filter((i) => i.proposalStatus !== 'dismissed')

  const runControls = (
    <form action={runAction} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold text-neutral-600">From</span>
          <input type="date" name="window_start" required defaultValue={defaultWindow.start} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold text-neutral-600">To</span>
          <input type="date" name="window_end" required defaultValue={defaultWindow.end} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </label>
        {campusSessions.length > 0 && (
          <label className="space-y-1">
            <span className="block text-xs font-semibold text-neutral-600">Campus session (optional)</span>
            <select name="campus_session_id" className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400">
              <option value="">—</option>
              {campusSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
          <input type="checkbox" name="monthly" value="true" className="h-4 w-4 rounded border-neutral-300" />
          Monthly summary
        </label>
        <button type="submit" disabled={running || !aiEnabled} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50">
          {running ? 'Categorizing…' : 'Categorize feed'}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Default window runs from the previous campus meeting to the most recent one. Nothing is created automatically — each proposed
        action is confirmed below.
      </p>
      {!aiEnabled && <p className="mt-2 text-xs font-medium text-amber-600">AI features are disabled for this environment.</p>}
      {runState.error && <p className="mt-2 text-sm font-medium text-red-600">{runState.error}</p>}
      {runState.ok && runState.message && <p className="mt-2 text-sm font-medium text-emerald-600">{runState.message}</p>}
    </form>
  )

  const generatedPanel = (
    <section className="space-y-4">
      {runControls}
      {!summary ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          No categorization yet. Pick a window and run it to see the summary and categorized items; the raw feed on the right updates to
          match.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Summary · {formatDate(summary.windowStart)} → {formatDate(summary.windowEnd)}
                </h2>
                <p className="text-xs text-neutral-500">
                  {summary.messageCount} message{summary.messageCount === 1 ? '' : 's'} · <span className="uppercase tracking-wide">{summary.status}</span>
                  {summary.model ? ` · ${summary.model}` : ''}
                </p>
              </div>
              {summary.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <ActionButton action={saveWhatsAppDigest} hidden={{ summary_id: summary.id }} label="Save digest" pendingLabel="Saving…" variant="primary" />
                  <ActionButton action={discardWhatsAppDigest} hidden={{ summary_id: summary.id }} label="Discard" pendingLabel="…" variant="ghost" />
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-neutral-700">{summary.tldr}</p>
            {summary.monthlySummary && (
              <div className="mt-3 rounded-xl bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Monthly summary</p>
                <p className="mt-1 text-sm text-neutral-700">{summary.monthlySummary}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {activeItems.length === 0 && (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">No categorized items for this window.</p>
            )}
            {activeItems.map((item) => {
              const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other
              const isSelected = item.sourceMessageIds.some((id) => selectedIds.has(id))
              const canConfirm = item.proposalStatus === 'proposed' && CONFIRM_ACTION[item.category]
              return (
                <div key={item.id} className={`rounded-xl border bg-white p-3 shadow-sm transition ${isSelected ? 'border-orange-400 ring-1 ring-orange-300' : 'border-neutral-200'}`}>
                  <button type="button" onClick={() => selectItem(item)} className="w-full text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{meta.label}</span>
                      <span className="text-sm font-medium text-neutral-900">{item.title}</span>
                    </div>
                    {(item.person || item.date || item.detail) && (
                      <p className="mt-1 text-xs text-neutral-500">{[item.person, item.date, item.detail].filter(Boolean).join(' · ')}</p>
                    )}
                    <p className="mt-1 text-[11px] text-orange-600">
                      {item.sourceMessageIds.length} source message{item.sourceMessageIds.length === 1 ? '' : 's'} — click to locate
                    </p>
                  </button>
                  {item.proposalStatus === 'confirmed' && (
                    <p className="mt-2 text-[11px] font-semibold text-emerald-600">✓ Confirmed{item.linkedType ? ` → ${item.linkedType.replace('_', ' ')}` : ''}</p>
                  )}
                  {canConfirm && (
                    <div className="mt-2 flex items-center gap-2">
                      <ActionButton action={CONFIRM_ACTION[item.category]} hidden={{ item_id: item.id }} label={item.category === 'new_member' ? 'Set up onboarding' : 'Add to calendar'} pendingLabel="…" variant="primary" />
                      <ActionButton action={dismissWhatsAppItem} hidden={{ item_id: item.id }} label="Dismiss" pendingLabel="…" variant="ghost" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )

  const feedPanel = (
    <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
      <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Raw WhatsApp feed</h2>
            <p className="text-xs text-neutral-500">Click an item on the left to highlight its source here.</p>
          </div>
          <Link href="/app/comms/whatsapp/health" className="shrink-0 rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
            Health →
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <WhatsAppFeedList feed={feed} canDelete={canDelete} selectedIds={selectedIds} registerRef={registerRef} />
        </div>
      </div>
    </aside>
  )

  return <ResizableSplit storageKey="whatsapp-workspace" defaultRatio={0.6} left={generatedPanel} right={feedPanel} />
}
