'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import type { TeamMemberOption } from '@/lib/comms-dashboard-data'
import type { WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'
import { runWhatsAppDigest, type DigestActionState } from '@/app/app/comms/whatsapp/digest/actions'
import { WhatsAppFeedList } from './whatsapp-feed-list'
import { WhatsAppDigestPanel, type DigestItem, type DigestSummary } from './whatsapp-digest-panel'

export type { DigestItem, DigestSummary } from './whatsapp-digest-panel'
export type CampusOption = { id: string; label: string }

const INITIAL: DigestActionState = { ok: false }

export function WhatsAppWorkspaceShell({
  aiEnabled,
  canDelete,
  defaultWindow,
  campusSessions,
  teamMembers,
  summary,
  items,
  feed,
}: {
  aiEnabled: boolean
  canDelete: boolean
  defaultWindow: { start: string; end: string }
  campusSessions: CampusOption[]
  teamMembers: TeamMemberOption[]
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
      {summary ? (
        <WhatsAppDigestPanel summary={summary} items={items} teamMembers={teamMembers} selectedSourceIds={selectedIds} onSelectItem={selectItem} />
      ) : (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          No categorization yet. Pick a window and run it to see the summary and categorized topics; the raw feed on the right updates to
          match.
        </p>
      )}
    </section>
  )

  const feedPanel = (
    <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
      <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Raw WhatsApp feed</h2>
            <p className="text-xs text-neutral-500">Click a topic on the left to highlight its source here.</p>
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
