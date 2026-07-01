'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  sendWhatsAppReply,
  deleteWhatsAppMessage,
  deleteWhatsAppConversation,
  type CommsFormState,
} from '@/app/app/comms/whatsapp/actions'
import { groupIntoThreads, type WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'

export type WhatsAppFeedItem = WhatsAppThreadMessage

const INITIAL_STATE: CommsFormState = { ok: false }

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

function FeedMessage({ item, isAdmin }: { item: WhatsAppFeedItem; isAdmin: boolean }) {
  const isOutbound = item.direction === 'outbound'
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    if (!window.confirm('Delete this message for everyone? This removes it from the inbox and all dashboards and cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteWhatsAppMessage({ id: item.id, direction: item.direction })
      if (!result.ok) {
        setError(result.error ?? 'Could not delete the message.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className={['rounded-xl border px-4 py-3', isOutbound ? 'border-orange-200 bg-orange-50' : 'border-neutral-200 bg-white'].join(' ')}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={isOutbound ? 'OCI reply' : item.displayName} tone={isOutbound ? 'neutral' : 'blue'} />
        <StatusBadge label={item.status.replace(/_/g, ' ')} tone={statusTone(item.direction, item.status)} />
        <span className="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
        {isAdmin && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="ml-auto shrink-0 text-xs font-semibold text-neutral-400 transition hover:text-red-600 disabled:opacity-50"
            aria-label="Delete message for everyone"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
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
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}

function DeleteConversationButton({ whatsappId }: { whatsappId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    if (!window.confirm('Delete this entire conversation for everyone? This removes every message with this contact from the inbox and all dashboards and cannot be undone.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteWhatsAppConversation(whatsappId)
      if (!result.ok) {
        setError(result.error ?? 'Could not delete the conversation.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete conversation'}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}

export function WhatsAppInboxShell({ feed, isAdmin = false }: { feed: WhatsAppFeedItem[]; isAdmin?: boolean }) {
  const conversations = useMemo(() => groupIntoThreads(feed), [feed])

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

  if (conversations.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          No WhatsApp messages yet. Incoming messages will appear here once the webhook receives them.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="space-y-4">
        {conversations.map((conversation) => (
          <article key={conversation.whatsappId} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">{conversation.displayName}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">{conversation.whatsappId}</span>
                {isAdmin && <DeleteConversationButton whatsappId={conversation.whatsappId} />}
              </div>
            </header>

            <div className="space-y-2">
              {conversation.messages.map((item) => (
                <FeedMessage key={`${item.direction}-${item.id}`} item={item} isAdmin={isAdmin} />
              ))}
            </div>

            <ReplyForm whatsappId={conversation.whatsappId} inReplyToIntakeItemId={conversation.lastInboundIntakeItemId} />
          </article>
        ))}
      </div>
    </div>
  )
}
