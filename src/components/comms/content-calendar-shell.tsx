'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { ActionModal } from '@/components/ui/action-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  promoteIntakeCandidate,
  saveCalendarEntry,
  transitionCalendarStatus,
  type CalendarFormState,
} from '@/app/app/comms/calendar/actions'
import {
  CALENDAR_STATUS_META,
  CHANNEL_META,
  getNextCalendarStatuses,
  groupCalendarEntriesByDay,
  type CalendarStatus,
} from '@/lib/comms-workflow'

type CalendarEntry = {
  id: string
  title: string
  channels: string[]
  status: string
  scheduled_at: string | null
  published_at: string | null
  body_draft: string | null
  author_id: string | null
  source_intake_id: string | null
  source_link?: string | null
  attached_media_refs?: string[] | null
  tags: string[] | null
  created_at: string
}

type AuthorOption = {
  id: string
  name: string
  email: string
}

type IntakeCandidate = {
  id: string
  sender_name: string
  content_type: string
  raw_content: string
  captured_at: string
}

const INITIAL_STATE: CalendarFormState = { ok: false }

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateLabel(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function buildMonthGrid(anchorDate = new Date()) {
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const gridStart = new Date(start)
  const day = gridStart.getDay()
  const offset = day === 0 ? 6 : day - 1
  gridStart.setDate(gridStart.getDate() - offset)

  return Array.from({ length: 35 }, (_, index) => {
    const value = new Date(gridStart)
    value.setDate(gridStart.getDate() + index)
    return value
  })
}

function StatusTransitionForm({
  entryId,
  nextStatus,
}: {
  entryId: string
  nextStatus: CalendarStatus
}) {
  return (
    <form action={transitionCalendarStatus}>
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="next_status" value={nextStatus} />
      <button
        type="submit"
        className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
      >
        Move to {CALENDAR_STATUS_META[nextStatus].label}
      </button>
    </form>
  )
}

function CalendarEditorModal({
  authors,
  entry,
  open,
  onClose,
}: {
  authors: AuthorOption[]
  entry: CalendarEntry | null
  open: boolean
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState(saveCalendarEntry, INITIAL_STATE)

  useEffect(() => {
    if (state.ok) onClose()
  }, [state.ok, onClose])

  return (
    <ActionModal title={entry ? 'Edit content card' : 'Create content card'} open={open} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        {entry && <input type="hidden" name="entry_id" value={entry.id} />}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Title</span>
          <input
            name="title"
            required
            defaultValue={entry?.title ?? ''}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-neutral-800">Channels</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CHANNEL_META).map(([channel, meta]) => {
              const checked = entry?.channels?.includes(channel) ?? channel === 'newsletter'
              return (
                <label key={channel} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${meta.color}`}>
                  <input type="checkbox" name="channels" value={channel} defaultChecked={checked} />
                  {meta.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Status</span>
            <select name="status" defaultValue={entry?.status ?? 'draft'} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              {Object.entries(CALENDAR_STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Scheduled publish date</span>
            <input
              type="datetime-local"
              name="scheduled_at"
              defaultValue={toDateTimeLocal(entry?.scheduled_at ?? null)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Author / assigned editor</span>
          <select
            name="author_id"
            defaultValue={entry?.author_id ?? authors[0]?.id ?? ''}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name} ({author.email})
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Source link</span>
          <input
            type="url"
            name="source_link"
            defaultValue={entry?.source_link ?? ''}
            placeholder="Link back to intake, initiative, or external source"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Draft body</span>
          <textarea
            name="body_draft"
            rows={6}
            defaultValue={entry?.body_draft ?? ''}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Tags</span>
            <input
              name="tags"
              defaultValue={entry?.tags?.join(', ') ?? ''}
              placeholder="initiative, topic, campaign"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Attached media references</span>
            <input
              name="attached_media_refs"
              defaultValue={entry?.attached_media_refs?.join(', ') ?? ''}
              placeholder="media item IDs or URLs, comma separated"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {state.error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-orange-300"
          >
            {pending ? 'Saving…' : entry ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      </form>
    </ActionModal>
  )
}

function CalendarListCard({
  entry,
  authors,
  onEdit,
}: {
  entry: CalendarEntry
  authors: AuthorOption[]
  onEdit: (entry: CalendarEntry) => void
}) {
  const author = authors.find((candidate) => candidate.id === entry.author_id)
  const nextStatuses = getNextCalendarStatuses(entry.status as CalendarStatus)

  return (
    <article className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={CALENDAR_STATUS_META[entry.status as CalendarStatus]?.label ?? entry.status}
              tone={CALENDAR_STATUS_META[entry.status as CalendarStatus]?.tone ?? 'neutral'}
            />
            {entry.channels.map((channel) => (
              <span
                key={`${entry.id}-${channel}`}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CHANNEL_META[channel as keyof typeof CHANNEL_META]?.color ?? 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}
              >
                {CHANNEL_META[channel as keyof typeof CHANNEL_META]?.label ?? channel}
              </span>
            ))}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-neutral-900">{entry.title}</h3>
            <p className="text-sm text-neutral-500">
              {formatDateLabel(entry.scheduled_at)} · {author?.name ?? 'Unassigned'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          Edit card
        </button>
      </div>

      {entry.body_draft && (
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
          {entry.body_draft}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {entry.source_link && (
          <a
            href={entry.source_link}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700"
          >
            Source link
          </a>
        )}
        {entry.attached_media_refs?.map((reference) => (
          <span key={reference} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-700">
            Media: {reference}
          </span>
        ))}
        {entry.tags?.map((tag) => (
          <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
            #{tag}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((nextStatus) => (
          <StatusTransitionForm key={`${entry.id}-${nextStatus}`} entryId={entry.id} nextStatus={nextStatus} />
        ))}
      </div>
    </article>
  )
}

export function ContentCalendarShell({
  entries,
  authors,
  intakeCandidates,
  view,
  statusFilter,
}: {
  entries: CalendarEntry[]
  authors: AuthorOption[]
  intakeCandidates: IntakeCandidate[]
  view: 'month' | 'list'
  statusFilter: 'all' | CalendarStatus
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null)
  const [promotionState, promoteAction] = useActionState(promoteIntakeCandidate, INITIAL_STATE)

  const filteredEntries =
    statusFilter === 'all' ? entries : entries.filter((entry) => entry.status === statusFilter)
  const groupedEntries = useMemo(() => groupCalendarEntriesByDay(filteredEntries), [filteredEntries])
  const monthGrid = useMemo(() => buildMonthGrid(), [])

  const openCreateModal = () => {
    setEditingEntry(null)
    setEditorOpen(true)
  }

  const openEditModal = (entry: CalendarEntry) => {
    setEditingEntry(entry)
    setEditorOpen(true)
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Publication planning
          </p>
          <h2 className="text-2xl font-semibold text-neutral-900">Content calendar</h2>
          <p className="max-w-3xl text-sm text-neutral-600">
            Plan newsletter, social, WordPress, podcast, and YouTube output from one place. Intake
            items can promote directly into draft cards, and publishing stays manual in Sprint 02.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          Create draft
        </button>
      </header>

      <CalendarEditorModal authors={authors} entry={editingEntry} open={editorOpen} onClose={() => setEditorOpen(false)} />

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Promote from intake</h3>
            <p className="text-sm text-neutral-500">
              One-click conversion for the strongest intake signals waiting to become calendar drafts.
            </p>
          </div>
          {promotionState.error && <p className="text-sm text-red-700">{promotionState.error}</p>}
          {promotionState.ok && promotionState.message && <p className="text-sm text-emerald-700">{promotionState.message}</p>}
        </div>

        {intakeCandidates.length === 0 ? (
          <p className="text-sm text-neutral-500">No unrouted article shares or event reports are waiting right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {intakeCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  {candidate.content_type.replace('_', ' ')}
                </p>
                <h4 className="mt-2 text-sm font-semibold text-neutral-900">{candidate.sender_name}</h4>
                <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{candidate.raw_content}</p>
                <form action={promoteAction} className="mt-4">
                  <input type="hidden" name="intake_item_id" value={candidate.id} />
                  <button
                    type="submit"
                    className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Promote to calendar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/comms/calendar?view=month"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === 'month' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700'}`}
          >
            Monthly grid
          </Link>
          <Link
            href="/app/comms/calendar?view=list"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === 'list' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700'}`}
          >
            List view
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/comms/calendar?view=${view}&status=all`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusFilter === 'all' ? 'bg-orange-100 text-orange-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
          >
            All statuses
          </Link>
          {Object.entries(CALENDAR_STATUS_META).map(([value, meta]) => (
            <Link
              key={value}
              href={`/app/comms/calendar?view=${view}&status=${value}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusFilter === value ? 'bg-orange-100 text-orange-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
            >
              {meta.label}
            </Link>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <section className="grid gap-4 md:grid-cols-7">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel) => (
            <div key={dayLabel} className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {dayLabel}
            </div>
          ))}

          {monthGrid.map((date) => {
            const dayKey = date.toISOString().slice(0, 10)
            const dayEntries = groupedEntries[dayKey] ?? []
            const inCurrentMonth = date.getMonth() === new Date().getMonth()

            return (
              <div key={dayKey} className={`min-h-40 rounded-2xl border p-3 ${inCurrentMonth ? 'border-neutral-200 bg-white' : 'border-neutral-100 bg-neutral-50'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold ${inCurrentMonth ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    {date.getDate()}
                  </p>
                  {dayEntries.length > 0 && (
                    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {dayEntries.length}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {dayEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openEditModal(entry)}
                      className="block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition hover:bg-neutral-100"
                    >
                      <div className="flex flex-wrap gap-1">
                        {entry.channels.slice(0, 2).map((channel) => (
                          <span
                            key={`${entry.id}-${channel}`}
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${CHANNEL_META[channel as keyof typeof CHANNEL_META]?.dot ?? 'bg-neutral-400'}`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-semibold text-neutral-800">{entry.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <CalendarListCard key={entry.id} entry={entry} authors={authors} onEdit={openEditModal} />
          ))}
          {filteredEntries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
              <p className="text-base font-semibold text-neutral-900">No calendar entries in this view.</p>
              <p className="mt-2 text-sm text-neutral-500">
                Create a new draft or promote an intake item to start filling the calendar.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
