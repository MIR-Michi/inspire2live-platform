'use client'

import { useActionState, useState } from 'react'
import { StatusBadge } from '@/components/ui/status-badge'
import { deleteWhatsAppMessages, sendWhatsAppReply, type CommsFormState } from '@/app/app/comms/whatsapp/actions'
import type { WhatsAppThreadMessage } from '@/lib/comms-whatsapp-thread'
import { MediaAttachment } from './whatsapp-media-attachment'

const INITIAL_STATE: CommsFormState = { ok: false }

function formatTimestamp(input: string) {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? input : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function statusTone(direction: WhatsAppThreadMessage['direction'], status: string): 'neutral' | 'green' | 'amber' | 'red' | 'blue' {
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

function ReplyForm({ whatsappId, inReplyToIntakeItemId, onDone }: { whatsappId: string; inReplyToIntakeItemId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(sendWhatsAppReply, INITIAL_STATE)
  return (
    <form action={formAction} className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
      <input type="hidden" name="recipient_whatsapp_id" value={whatsappId} />
      <input type="hidden" name="in_reply_to_intake_item_id" value={inReplyToIntakeItemId} />
      <textarea
        name="body"
        rows={2}
        required
        placeholder={`Reply to ${whatsappId}…`}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none focus:ring-2 focus:ring-orange-300"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
          <button type="button" onClick={onDone} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
            Cancel
          </button>
        </div>
        {(state.error || state.message) && (
          <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
        )}
      </div>
    </form>
  )
}

function FeedMessage({
  item,
  canDelete,
  highlighted,
  registerRef,
}: {
  item: WhatsAppThreadMessage
  canDelete: boolean
  highlighted: boolean
  registerRef: (id: string, el: HTMLLIElement | null) => void
}) {
  const isOutbound = item.direction === 'outbound'
  const [replyOpen, setReplyOpen] = useState(false)
  const [, deleteAction, deleting] = useActionState(deleteWhatsAppMessages, INITIAL_STATE)

  return (
    <li
      ref={(el) => registerRef(item.id, el)}
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        highlighted
          ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'
          : isOutbound
            ? 'border-orange-100 bg-orange-50/40'
            : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={isOutbound ? 'OCI reply' : item.displayName} tone={isOutbound ? 'neutral' : 'blue'} />
        <StatusBadge label={item.status.replace(/_/g, ' ')} tone={statusTone(item.direction, item.status)} />
        <span className="text-[11px] text-neutral-400">{formatTimestamp(item.timestamp)}</span>
        <div className="ml-auto flex items-center gap-2">
          {!isOutbound && (
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
            >
              {replyOpen ? 'Close' : 'Reply'}
            </button>
          )}
          {canDelete && (
            <form action={deleteAction}>
              <input type="hidden" name="message_ref" value={`${item.direction}:${item.id}`} />
              <button
                type="submit"
                disabled={deleting}
                className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '…' : 'Delete'}
              </button>
            </form>
          )}
        </div>
      </div>
      {item.text && <p className="mt-1 whitespace-pre-wrap text-neutral-800">{item.text}</p>}
      {item.media && <MediaAttachment media={item.media} />}
      {isOutbound && (item.readAt || item.deliveredAt) && (
        <p className="mt-1 text-[11px] text-neutral-500">
          {item.readAt ? `Read ${formatTimestamp(item.readAt)}` : `Delivered ${formatTimestamp(item.deliveredAt as string)}`}
        </p>
      )}
      {item.errorDetail && <p className="mt-1 text-[11px] text-red-700">Delivery error: {item.errorDetail}</p>}
      {replyOpen && !isOutbound && (
        <ReplyForm whatsappId={item.whatsappId} inReplyToIntakeItemId={item.id} onDone={() => setReplyOpen(false)} />
      )}
    </li>
  )
}

/**
 * Flat, chronological, media-rich WhatsApp feed. Each message carries a stable
 * anchor by id so the digest panel can highlight + scroll to an item's source
 * message(s). Preserves inbox reply (inbound) and admin delete.
 */
export function WhatsAppFeedList({
  feed,
  canDelete,
  selectedIds,
  registerRef,
}: {
  feed: WhatsAppThreadMessage[]
  canDelete: boolean
  selectedIds: Set<string>
  registerRef: (id: string, el: HTMLLIElement | null) => void
}) {
  if (feed.length === 0) {
    return <p className="p-4 text-sm text-neutral-500">No WhatsApp messages in this window.</p>
  }
  return (
    <ul className="space-y-2 p-3">
      {feed.map((item) => (
        <FeedMessage
          key={`${item.direction}-${item.id}`}
          item={item}
          canDelete={canDelete}
          highlighted={selectedIds.has(item.id)}
          registerRef={registerRef}
        />
      ))}
    </ul>
  )
}
