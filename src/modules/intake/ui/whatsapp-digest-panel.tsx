'use client'

import { useActionState, useState } from 'react'
import type { TeamMemberOption } from '@/lib/comms-dashboard-data'
import type { DigestItem, DigestSummary } from '@/lib/whatsapp-digest-types'
import {
  saveWhatsAppDigest,
  discardWhatsAppDigest,
  confirmBirthday,
  confirmEvent,
  confirmNewMember,
  dismissWhatsAppItem,
  createTopicTask,
  type DigestActionState,
} from '@/app/app/comms/whatsapp/digest/actions'

export type { DigestItem, DigestSummary } from '@/lib/whatsapp-digest-types'

const INITIAL: DigestActionState = { ok: false }

export const DIGEST_CATEGORY_META: Record<string, { label: string; badge: string }> = {
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

/** Small submit button that reports its own action state inline. */
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

/** Inline "+ Task" form: assign a comms member + optional deadline for a topic. */
function TopicTaskForm({ itemId, itemTitle, teamMembers }: { itemId: string; itemTitle: string; teamMembers: TeamMemberOption[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createTopicTask, INITIAL)

  if (state.ok && open) {
    // Collapse on success but keep a confirmation line.
    return <p className="mt-2 text-[11px] font-semibold text-emerald-600">✓ {state.message}</p>
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[11px] font-semibold text-orange-600 hover:text-orange-700">
        + Task
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
      <input type="hidden" name="item_id" value={itemId} />
      <input
        name="title"
        required
        defaultValue={itemTitle}
        placeholder="Task"
        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-300"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select name="owner_id" className="rounded-md border border-neutral-300 px-2 py-1 text-xs" defaultValue="none">
          <option value="none">Assign to me</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input type="date" name="due_date" className="rounded-md border border-neutral-300 px-2 py-1 text-xs" aria-label="Deadline (optional)" />
        <button type="submit" disabled={pending} className="rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50">
          {pending ? 'Creating…' : 'Create task'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-[11px] font-medium text-red-600">{state.error}</p>}
    </form>
  )
}

/**
 * Presentational digest content — the AI summary, optional monthly rollup, and
 * categorized topics with their reviewable proposals and a "+ Task" affordance.
 * Shared verbatim by the WhatsApp workspace (left column) and the Campus WhatsApp
 * tab, so both surfaces render the *same* stored digest with no duplicated markup.
 *
 * - `editable` gates the digest save/discard and per-topic proposal confirm
 *   actions (write surfaces). `+ Task` is always available.
 * - `onSelectItem` (optional) makes topics clickable to drive a source-message
 *   highlight in a companion feed; omit it where there is no feed alongside.
 */
export function WhatsAppDigestPanel({
  summary,
  items,
  teamMembers,
  editable = true,
  selectedSourceIds,
  onSelectItem,
}: {
  summary: DigestSummary | null
  items: DigestItem[]
  teamMembers: TeamMemberOption[]
  editable?: boolean
  selectedSourceIds?: Set<string>
  onSelectItem?: (item: DigestItem) => void
}) {
  const activeItems = items.filter((i) => i.proposalStatus !== 'dismissed')

  if (!summary) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
        No categorization for this window yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
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
          {editable && summary.status === 'pending' && (
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
          <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">No categorized topics for this window.</p>
        )}
        {activeItems.map((item) => {
          const meta = DIGEST_CATEGORY_META[item.category] ?? DIGEST_CATEGORY_META.other
          const isSelected = Boolean(selectedSourceIds && item.sourceMessageIds.some((id) => selectedSourceIds.has(id)))
          const canConfirm = editable && item.proposalStatus === 'proposed' && CONFIRM_ACTION[item.category]
          const Heading = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{meta.label}</span>
                <span className="text-sm font-medium text-neutral-900">{item.title}</span>
              </div>
              {(item.person || item.date || item.detail) && (
                <p className="mt-1 text-xs text-neutral-500">{[item.person, item.date, item.detail].filter(Boolean).join(' · ')}</p>
              )}
              {onSelectItem && (
                <p className="mt-1 text-[11px] text-orange-600">
                  {item.sourceMessageIds.length} source message{item.sourceMessageIds.length === 1 ? '' : 's'} — click to locate
                </p>
              )}
            </>
          )
          return (
            <div key={item.id} className={`rounded-xl border bg-white p-3 shadow-sm transition ${isSelected ? 'border-orange-400 ring-1 ring-orange-300' : 'border-neutral-200'}`}>
              {onSelectItem ? (
                <button type="button" onClick={() => onSelectItem(item)} className="w-full text-left">
                  {Heading}
                </button>
              ) : (
                <div>{Heading}</div>
              )}
              {item.proposalStatus === 'confirmed' && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-600">✓ Confirmed{item.linkedType ? ` → ${item.linkedType.replace('_', ' ')}` : ''}</p>
              )}
              {canConfirm && (
                <div className="mt-2 flex items-center gap-2">
                  <ActionButton action={CONFIRM_ACTION[item.category]} hidden={{ item_id: item.id }} label={item.category === 'new_member' ? 'Set up onboarding' : 'Add to calendar'} pendingLabel="…" variant="primary" />
                  <ActionButton action={dismissWhatsAppItem} hidden={{ item_id: item.id }} label="Dismiss" pendingLabel="…" variant="ghost" />
                </div>
              )}
              <TopicTaskForm itemId={item.id} itemTitle={item.title} teamMembers={teamMembers} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
