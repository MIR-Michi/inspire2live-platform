'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { deleteWhatsAppMessages, sendWhatsAppReply, type CommsFormState } from '@/app/app/comms/whatsapp/actions'
import { groupIntoThreads, type WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'

export type WhatsAppFeedItem = WhatsAppThreadMessage

const INITIAL_STATE: CommsFormState = { ok: false }

function messageRef(item: WhatsAppFeedItem) {
  return `${item.direction}:${item.id}`
}

function formatTimestamp(input: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input))
}

function statusTone(direction: WhatsAppFeedItem['direction'], status: string): 'neutral' | 'green' | 'amber' | 'red' | 'blue' {
  if (direction === 'outbound') {
    if (status === 'failed') return 'red'
    if (status === 'read') return 'green'
    if (status === 'delivered') return 'blue'
    return 'neutral'
  }
  if (status === 'unreviewed') return 'amber'
  if (status === 'dismissed') return 'neutral'
  return 'blue'
}

function ReplyForm({ whatsappId, inReplyToIntakeItemId }: { whatsappId: string; inReplyToIntakeItemId: string | null }) {
  const [state, formAction, pending] = useActionState(sendWhatsAppReply, INITIAL_STATE)

  return (
    <form action={formAction} className="space-y-2 border-t border-neutral-100 pt-3">
      <input type="hidden" name="recipient_whatsapp_id" value={whatsappId} />
      {inReplyToIntakeItemId && <input type="hidden" name="in_reply_to_intake_item_id" value={inReplyToIntakeItemId} />}
      <textarea
        name="body"
        rows={2}
        placeholder={`Reply to ${whatsappId}…`}
        required
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none focus:ring-2 focus:ring-orange-300"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
        {(state.error || state.message) && (
          <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  )
}

function FeedMessage({
  item,
  canDeleteMessages,
  selected,
  onToggleSelected,
}: {
  item: WhatsAppFeedItem
  canDeleteMessages: boolean
  selected: boolean
  onToggleSelected: (ref: string, selected: boolean) => void
}) {
  const isOutbound = item.direction === 'outbound'
  const ref = messageRef(item)
  const [, deleteAction, deleting] = useActionState(deleteWhatsAppMessages, INITIAL_STATE)

  return (
    <div className={['rounded-xl border px-4 py-3', isOutbound ? 'border-orange-200 bg-orange-50' : 'border-neutral-200 bg-white'].join(' ')}>
      <div className="flex flex-wrap items-center gap-2">
        {canDeleteMessages && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggleSelected(ref, event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-orange-600"
            aria-label={`Select WhatsApp message from ${item.displayName}`}
          />
        )}
        <StatusBadge label={isOutbound ? 'OCI reply' : item.displayName} tone={isOutbound ? 'neutral' : 'blue'} />
        <StatusBadge label={item.status.replace(/_/g, ' ')} tone={statusTone(item.direction, item.status)} />
        <span className="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
        {canDeleteMessages && (
          <form action={deleteAction} className="ml-auto">
            <input type="hidden" name="message_ref" value={ref} />
            <button
              type="submit"
              disabled={deleting}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </form>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{item.text}</p>
      {isOutbound && (item.readAt || item.deliveredAt) && (
        <p className="mt-1 text-xs text-neutral-500">
          {item.readAt
            ? `Read ${formatTimestamp(item.readAt)}`
            : `Delivered ${formatTimestamp(item.deliveredAt as string)}`}
        </p>
      )}
      {item.errorDetail && <p className="mt-1 text-xs text-red-700">Delivery error: {item.errorDetail}</p>}
    </div>
  )
}

export function WhatsAppInboxShell({
  feed,
  canDeleteMessages = false,
}: {
  feed: WhatsAppFeedItem[]
  canDeleteMessages?: boolean
}) {
  const conversations = useMemo(() => groupIntoThreads(feed), [feed])
  const [selectedRefs, setSelectedRefs] = useState<string[]>([])
  const [deleteState, deleteAction, deleting] = useActionState(deleteWhatsAppMessages, INITIAL_STATE)

  const selectedSet = useMemo(() => new Set(selectedRefs), [selectedRefs])
  const toggleSelected = (ref: string, next: boolean) => {
    setSelectedRefs((prev) => {
      const current = new Set(prev)
      if (next) current.add(ref)
      else current.delete(ref)
      return [...current]
    })
  }
  const clearSelection = () => setSelectedRefs([])

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">WhatsApp inbox</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Incoming WhatsApp messages and OCI replies, grouped by conversation. Replies are sent live via the WhatsApp Cloud API.
        </p>
      </div>
      <Link
        href="/app/comms/whatsapp/health"
        className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
      >
        Webhook health →
      </Link>
    </header>
  )

  const adminToolbar = canDeleteMessages ? (
    <form action={deleteAction} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-red-900">Admin message cleanup</p>
        <p className="text-xs text-red-700">
          {selectedRefs.length} selected. Deleted messages are hidden from the WhatsApp inbox but retained for audit history.
        </p>
        {(deleteState.error || deleteState.message) && (
          <p className={`mt-1 text-xs ${deleteState.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {deleteState.ok ? deleteState.message : deleteState.error}
          </p>
        )}
      </div>
      {selectedRefs.map((ref) => <input key={ref} type="hidden" name="message_ref" value={ref} />)}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearSelection}
          disabled={selectedRefs.length === 0 || deleting}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={selectedRefs.length === 0 || deleting}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : `Delete selected${selectedRefs.length > 0 ? ` (${selectedRefs.length})` : ''}`}
        </button>
      </div>
    </form>
  ) : null

  if (conversations.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        {adminToolbar}
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          No WhatsApp messages yet. Incoming messages will appear here once the webhook receives them.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}
      {adminToolbar}

      <div className="space-y-4">
        {conversations.map((conversation) => (
          <article key={conversation.whatsappId} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">{conversation.displayName}</h2>
              <span className="text-xs text-neutral-500">{conversation.whatsappId}</span>
            </header>

            <div className="space-y-2">
              {conversation.messages.map((item) => {
                const ref = messageRef(item)
                return (
                  <FeedMessage
                    key={`${item.direction}-${item.id}`}
                    item={item}
                    canDeleteMessages={canDeleteMessages}
                    selected={selectedSet.has(ref)}
                    onToggleSelected={toggleSelected}
                  />
                )
              })}
            </div>

            <ReplyForm whatsappId={conversation.whatsappId} inReplyToIntakeItemId={conversation.lastInboundIntakeItemId} />
          </article>
        ))}
      </div>
    </div>
  )
}
