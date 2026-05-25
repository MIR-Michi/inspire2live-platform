'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition, type FormEvent } from 'react'
import { FounderBadge } from '@/components/comms/founder-badge'
import { ActionModal } from '@/components/ui/action-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  deleteIntakeItem,
  dismissIntakeItem,
  editIntakeClassification,
  markIntakeReviewed,
  replayIntakeClassification,
  routeIntakeItem,
  sendDailyDigestNow,
  type CommsFormState,
} from '@/app/app/comms/intake/actions'
import { buildEventDraftFromIntake, parseCampusMemberDraft } from '@/lib/comms-routing'
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
  capture_method: string
  sender_name: string
  sender_whatsapp_id: string | null
  raw_content: string
  source_url: string | null
  attached_media_ref?: string | null
  content_type: string
  classification_confidence: string | null
  classifier_status: string
  classifier_version: string | null
  classifier_reasoning: Array<{
    ruleId: string
    label: string
    evidence: string
    effect: 'type' | 'confidence' | 'founder_signal'
  }>
  classifier_rule_ids: string[]
  status: string
  captured_at: string
  is_peter_kapitein: boolean
  dismissed_reason: string | null
}

type InitiativeOption = {
  id: string
  label: string
}

type RecoveryOption = {
  id: string
  label: string
}

const INITIAL_STATE: CommsFormState = { ok: false }

function formatTimestamp(input: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input))
}

function RouteModal({
  item,
  initiatives,
  recoveryRequests,
}: {
  item: IntakeItem
  initiatives: InitiativeOption[]
  recoveryRequests: RecoveryOption[]
}) {
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
  const parsedEvent = useMemo(() => buildEventDraftFromIntake(item), [item])
  const parsedMember = useMemo(() => parseCampusMemberDraft(item), [item])

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

          {(destination === 'event' || destination === 'campus_member') && initiatives.length > 0 && (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-neutral-800">Related initiative (optional)</span>
              <select
                name="route_initiative_id"
                defaultValue=""
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">No linked initiative</option>
                {initiatives.map((initiative) => (
                  <option key={initiative.id} value={initiative.id}>
                    {initiative.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {destination === 'media_asset' && item.content_type === 'media_request' && (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-neutral-800">Attach to recovery request</span>
              <select
                name="media_recovery_request_id"
                defaultValue=""
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Create a new media recovery request</option>
                {recoveryRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Choose an open recovery request when this message is an offer or follow-up. Leave blank to open a new request.
              </p>
            </label>
          )}

          {destination === 'event' && (
            <div className="grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-neutral-800">Event name</span>
                <input
                  name="event_name"
                  defaultValue={parsedEvent.name}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Event type</span>
                <select
                  name="event_type"
                  defaultValue={parsedEvent.eventType}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  {['conference', 'workshop', 'congress', 'symposium', 'webinar', 'other'].map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Start date</span>
                <input
                  type="date"
                  name="event_start_date"
                  defaultValue={parsedEvent.startDate}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">End date</span>
                <input
                  type="date"
                  name="event_end_date"
                  defaultValue={parsedEvent.endDate}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Organiser</span>
                <input
                  name="event_organiser"
                  defaultValue={parsedEvent.organiser}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">City</span>
                <input
                  name="event_location_city"
                  defaultValue={parsedEvent.locationCity}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Country</span>
                <input
                  name="event_location_country"
                  defaultValue={parsedEvent.locationCountry}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-900">
                <input
                  type="checkbox"
                  name="event_is_annual_congress"
                  value="true"
                  defaultChecked={parsedEvent.isAnnualCongress}
                />
                Mark as Annual Congress
              </label>
            </div>
          )}

          {destination === 'campus_member' && (
            <div className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:grid-cols-2">
              <input
                type="hidden"
                name="member_welcomed_by_peter"
                value={parsedMember.welcomedByPeter ? 'true' : 'false'}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Member name</span>
                <input
                  name="member_name"
                  defaultValue={parsedMember.name}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Country</span>
                <input
                  name="member_country"
                  defaultValue={parsedMember.country}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Organisation</span>
                <input
                  name="member_organisation"
                  defaultValue={parsedMember.organisation}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Role or context</span>
                <input
                  name="member_role_description"
                  defaultValue={parsedMember.roleDescription}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>

              <p className="text-xs text-emerald-800 md:col-span-2">
                Parsed from the message with simple rules. Adjust anything before saving to the Campus Log.
              </p>
            </div>
          )}

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
  const [replayState, setReplayState] = useState<CommsFormState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const [replayPending, startReplayTransition] = useTransition()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await editIntakeClassification(INITIAL_STATE, formData)
      setState(result)
      if (result.ok) setOpen(false)
    })
  }

  const handleReplay = () => {
    const formData = new FormData()
    formData.set('intake_item_id', item.id)
    startReplayTransition(async () => {
      const result = await replayIntakeClassification(INITIAL_STATE, formData)
      setReplayState(result)
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
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-900">
            <p className="font-semibold">Automation review</p>
            <p className="mt-1">
              Status: <span className="font-medium">{item.classifier_status.replace(/_/g, ' ')}</span>
              {item.classifier_version ? ` · ${item.classifier_version}` : ''}
            </p>
            {item.classifier_reasoning.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.classifier_reasoning.map((reason) => (
                  <li key={`${item.id}-${reason.ruleId}`} className="rounded-lg bg-white/80 px-2 py-1">
                    <span className="font-medium">{reason.label}</span>: {reason.evidence}
                  </li>
                ))}
              </ul>
            )}
          </div>

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
            Manual corrections are logged so the classifier can reuse them as training examples. You can also promote the sender into an exact reusable rule.
          </p>

          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
            <input type="checkbox" name="promote_as_sender_rule" value="true" className="mt-0.5" />
            <span>
              Create a reusable sender rule for <span className="font-semibold">{item.sender_name}</span> when this correction is saved.
            </span>
          </label>

          {(state.error || replayState.error) && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error ?? replayState.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleReplay}
              disabled={replayPending}
              className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-60"
            >
              {replayPending ? 'Replaying…' : 'Replay classifier'}
            </button>
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
              defaultValue={item.dismissed_reason ?? 'Social/miscellaneous for the comms queue'}
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

function ReviewButton({ item }: { item: IntakeItem }) {
  const [pending, startTransition] = useTransition()

  if (item.status !== 'unreviewed') return null

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const formData = new FormData()
          formData.set('intake_item_id', item.id)
          await markIntakeReviewed(INITIAL_STATE, formData)
        })
      }}
      disabled={pending}
      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
    >
      {pending ? 'Reviewing…' : 'Mark reviewed'}
    </button>
  )
}

function DeleteButton({ item }: { item: IntakeItem }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm('Delete this intake item? This removes the message from the intake queue only.')) return
        startTransition(async () => {
          const formData = new FormData()
          formData.set('intake_item_id', item.id)
          await deleteIntakeItem(INITIAL_STATE, formData)
        })
      }}
      disabled={pending}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
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

function IntakeItemCard({
  item,
  initiatives,
  recoveryRequests,
}: {
  item: IntakeItem
  initiatives: InitiativeOption[]
  recoveryRequests: RecoveryOption[]
}) {
  const meta = getIntakeTypeMeta(item.content_type)
  const suggested = getSuggestedDestination(item.content_type as IntakeContentType)

  return (
    <article className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={meta.label} tone={meta.tone} />
            {item.is_peter_kapitein && <FounderBadge />}
            {item.classification_confidence && (
              <StatusBadge label={`Confidence: ${item.classification_confidence}`} tone="neutral" />
            )}
            <StatusBadge
              label={item.capture_method === 'webhook' ? 'Webhook' : 'Manual'}
              tone={item.capture_method === 'webhook' ? 'blue' : 'neutral'}
            />
            <StatusBadge label={item.classifier_status.replace(/_/g, ' ')} tone="neutral" />
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
        {item.sender_whatsapp_id && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            WhatsApp: {item.sender_whatsapp_id}
          </span>
        )}
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

      {item.classifier_reasoning.length > 0 && (
        <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Classifier reasoning
          </p>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700">
            {item.classifier_reasoning.slice(0, 3).map((reason) => (
              <li key={`${item.id}-${reason.ruleId}`} className="rounded-lg bg-white px-3 py-2">
                <span className="font-medium">{reason.label}</span>: {reason.evidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <ReviewButton item={item} />
        {item.status !== 'dismissed' && (
          <RouteModal item={item} initiatives={initiatives} recoveryRequests={recoveryRequests} />
        )}
        {item.status !== 'dismissed' && <ClassificationModal item={item} />}
        <DismissModal item={item} />
        <DeleteButton item={item} />
      </footer>
    </article>
  )
}

export function IntakeQueueShell({
  items,
  filter,
  unreviewedCount,
  initiatives,
  recoveryRequests,
}: {
  items: IntakeItem[]
  filter: IntakeFilter
  unreviewedCount: number
  initiatives: InitiativeOption[]
  recoveryRequests: RecoveryOption[]
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
            <IntakeItemCard
              key={item.id}
              item={item}
              initiatives={initiatives}
              recoveryRequests={recoveryRequests}
            />
          ))}
        </div>
      )}
    </section>
  )
}
