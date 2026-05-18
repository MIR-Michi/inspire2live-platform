'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition, type FormEvent } from 'react'
import { ActionModal } from '@/components/ui/action-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  dismissIntakeItem,
  editIntakeClassification,
  routeIntakeItem,
  sendDailyDigestNow,
  type CommsFormState,
} from '@/app/app/comms/intake/actions'
import {
  CONTENT_TYPE_META,
  INTAKE_FILTERS,
  ROUTE_DESTINATION_META,
  getIntakeTypeMeta,
  getRoutingOptions,
  getSuggestedDestination,
  type IntakeContentType,
  type IntakeFilter,
  type RouteDestination,
} from '@/lib/comms-workflow'

type IntakeItem = {
  id: string
  sender_name: string
  raw_content: string
  source_url: string | null
  attached_media_ref?: string | null
  content_type: string
  classification_confidence: string | null
  status: string
  captured_at: string
  is_peter_kapitein: boolean
  dismissed_reason: string | null
}

const INITIAL_STATE: CommsFormState = { ok: false }

function formatTimestamp(input: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input))
}

function RouteModal({ item }: { item: IntakeItem }) {
  const [open, setOpen] = useState(false)
  const [destination, setDestination] = useState<RouteDestination | ''>(
    (getSuggestedDestination(item.content_type as IntakeContentType) ?? '') as RouteDestination | ''
  )
  const [state, setState] = useState<CommsFormState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const options = getRoutingOptions(item.content_type as IntakeContentType)
  const defaultDestination = useMemo(
    () => getSuggestedDestination(item.content_type as IntakeContentType),
    [item.content_type]
  )

  if (item.status === 'dismissed') return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await routeIntakeItem(INITIAL_STATE, formData)
      setState(result)
      if (result.ok) setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700"
      >
        Route
      </button>

      <ActionModal title="Route intake item" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="intake_item_id" value={item.id} />

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <p className="font-semibold">{item.sender_name}</p>
            <p className="mt-1 text-orange-800">{item.raw_content}</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Destination</span>
            <select
              name="destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value as RouteDestination)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {ROUTE_DESTINATION_META[option].label}
                </option>
              ))}
            </select>
            {defaultDestination && (
              <p className="text-xs text-neutral-500">
                Suggested by taxonomy: {ROUTE_DESTINATION_META[defaultDestination].label}
              </p>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Title override (optional)</span>
            <input
              name="route_title"
              placeholder="Refine the destination title if needed"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          {destination === 'calendar' && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Calendar channels</legend>
              <div className="grid grid-cols-2 gap-2 text-sm text-neutral-700">
                {['linkedin', 'newsletter', 'wordpress', 'podcast', 'youtube'].map((channel) => (
                  <label key={channel} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
                    <input type="checkbox" name="channels" value={channel} defaultChecked={channel === 'newsletter'} />
                    <span className="capitalize">{channel}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {state.error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-orange-300"
            >
              {pending ? 'Routing…' : 'Confirm route'}
            </button>
          </div>
        </form>
      </ActionModal>
    </>
  )
}

function ClassificationModal({ item }: { item: IntakeItem }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CommsFormState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await editIntakeClassification(INITIAL_STATE, formData)
      setState(result)
      if (result.ok) setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
      >
        Edit classification
      </button>

      <ActionModal title="Edit classification" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="intake_item_id" value={item.id} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Content type</span>
            <select
              name="content_type"
              defaultValue={item.content_type}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              {Object.entries(CONTENT_TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            Manual corrections are logged so the later classifier can learn from real coordinator decisions.
          </p>

          {state.error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-neutral-400"
            >
              {pending ? 'Saving…' : 'Save correction'}
            </button>
          </div>
        </form>
      </ActionModal>
    </>
  )
}

function DismissModal({ item }: { item: IntakeItem }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CommsFormState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await dismissIntakeItem(INITIAL_STATE, formData)
      setState(result)
      if (result.ok) setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
      >
        Dismiss
      </button>

      <ActionModal title="Dismiss intake item" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="intake_item_id" value={item.id} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Reason</span>
            <textarea
              name="dismissed_reason"
              rows={3}
              defaultValue={item.dismissed_reason ?? 'Social/noise for the comms queue'}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Dismissed items stay available in the hidden 90-day archive view so nothing is lost.
          </p>

          {state.error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-red-300"
            >
              {pending ? 'Archiving…' : 'Dismiss item'}
            </button>
          </div>
        </form>
      </ActionModal>
    </>
  )
}

function DigestButton() {
  const [state, formAction, pending] = useActionState(sendDailyDigestNow, INITIAL_STATE)

  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:bg-neutral-100"
      >
        {pending ? 'Sending digest…' : 'Daily digest'}
      </button>
      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
    </form>
  )
}

function IntakeItemCard({ item }: { item: IntakeItem }) {
  const meta = getIntakeTypeMeta(item.content_type)
  const suggested = getSuggestedDestination(item.content_type as IntakeContentType)

  return (
    <article className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={meta.label} tone={meta.tone} />
            {item.is_peter_kapitein && <StatusBadge label="Peter signal" tone="amber" />}
            {item.classification_confidence && (
              <StatusBadge label={`Confidence: ${item.classification_confidence}`} tone="neutral" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{item.sender_name}</h3>
            <p className="text-sm text-neutral-500">{formatTimestamp(item.captured_at)}</p>
          </div>
        </div>

        {suggested ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700">
              Suggested destination
            </p>
            <p className="mt-1 text-sm font-semibold text-orange-900">
              {ROUTE_DESTINATION_META[suggested].label}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Suggested destination: Archive
          </div>
        )}
      </header>

      <details className="group rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Message summary
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700 line-clamp-3 group-open:line-clamp-none">
          {item.raw_content}
        </p>
        <p className="mt-2 text-xs text-neutral-400">Open to expand the full capture.</p>
      </details>

      <div className="flex flex-wrap gap-2 text-xs">
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700"
          >
            Source URL
          </a>
        )}
        {item.attached_media_ref && (
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-700">
            Media: {item.attached_media_ref}
          </span>
        )}
        {item.status === 'dismissed' && item.dismissed_reason && (
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-700">
            {item.dismissed_reason}
          </span>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2">
        {item.status !== 'dismissed' && <RouteModal item={item} />}
        {item.status !== 'dismissed' && <ClassificationModal item={item} />}
        <DismissModal item={item} />
      </footer>
    </article>
  )
}

export function IntakeQueueShell({
  items,
  filter,
  unreviewedCount,
}: {
  items: IntakeItem[]
  filter: IntakeFilter
  unreviewedCount: number
}) {
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Daily triage
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">Intake queue</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              {unreviewedCount} unreviewed
            </span>
          </div>
          <p className="text-sm text-neutral-600">
            {new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date())}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DigestButton />
          <Link
            href="/app/comms/intake/new"
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            + New intake item
          </Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {INTAKE_FILTERS.map((item) => {
          const isActive = item.key === filter
          return (
            <Link
              key={item.key}
              href={`/app/comms/intake?filter=${item.key}`}
              className={[
                'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-neutral-900">No intake items in this view.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Capture the next WhatsApp signal or switch filters to inspect the 90-day archive.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <IntakeItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
