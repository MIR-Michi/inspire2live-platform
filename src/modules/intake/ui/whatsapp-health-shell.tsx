'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { replayWhatsAppWebhookEvent, type CommsFormState } from '@/app/app/comms/whatsapp/health/actions'
import type { WebhookHealthSummary } from '@/lib/comms-whatsapp-health'

export type FailedWebhookEvent = {
  id: string
  senderName: string | null
  senderWhatsappId: string | null
  failureReason: string | null
  receivedAt: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

function formatTimestamp(input: string | null) {
  if (!input) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(input))
}

function formatRelative(input: string | null) {
  if (!input) return 'never'
  const diffMs = Date.now() - new Date(input).getTime()
  if (!Number.isFinite(diffMs)) return 'unknown'
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function SummaryStat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'red' }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={['mt-1 text-3xl font-bold', tone === 'red' ? 'text-red-600' : 'text-neutral-900'].join(' ')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

function ReplayButton({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(replayWhatsAppWebhookEvent, INITIAL_STATE)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? 'Replaying…' : 'Replay'}
      </button>
      {(state.error || state.message) && (
        <span className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  )
}

export function WhatsAppHealthShell({
  summary,
  failedEvents,
}: {
  summary: WebhookHealthSummary
  failedEvents: FailedWebhookEvent[]
}) {
  const failureRatePct = Math.round(summary.failureRate * 100)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">WhatsApp webhook health</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ingestion summary and failed events for the WhatsApp Cloud API webhook (last {summary.total} events).
          </p>
        </div>
        <Link
          href="/app/comms/whatsapp"
          className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          ← Back to inbox
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Accepted" value={summary.accepted} sub="processed into intake" />
        <SummaryStat label="Duplicates" value={summary.duplicate} sub="already seen" />
        <SummaryStat
          label="Failed"
          value={summary.failed}
          sub={`${failureRatePct}% failure rate`}
          tone={summary.failed > 0 ? 'red' : undefined}
        />
        <SummaryStat label="Last received" value={formatRelative(summary.lastReceivedAt)} sub={formatTimestamp(summary.lastReceivedAt)} />
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-base font-semibold text-neutral-900">Failed events</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Events whose processing errored. Replay re-runs the stored payload without waiting for Meta to redeliver.
          </p>
        </header>

        {failedEvents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">No failed webhook events. 🎉</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {failedEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label="failed" tone="red" />
                    <span className="text-sm font-semibold text-neutral-900">{event.senderName || event.senderWhatsappId || 'Unknown sender'}</span>
                    {event.senderWhatsappId && <span className="text-xs text-neutral-500">{event.senderWhatsappId}</span>}
                    <span className="text-xs text-neutral-400">{formatTimestamp(event.receivedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-red-700">{event.failureReason || 'No failure reason recorded.'}</p>
                </div>
                <ReplayButton eventId={event.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
