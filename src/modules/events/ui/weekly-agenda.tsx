'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatMeetingLabel, type AgendaMeetingGroup } from '@/lib/comms-agenda'
import { AgendaAddForm } from '@/components/comms/agenda-add-form'
import { AgendaItemList } from '@/components/comms/agenda-item-list'
import { MeetingTranscriptPanel } from '@/components/comms/meeting-transcript-panel'
import type { TaskOwnerOption } from '@/components/comms/task-details-button'
import type { MeetingTranscriptView } from '@/lib/comms-meeting-transcripts'

type TranscriptOwnerOption = { id: string; label: string }

/**
 * Weekly meeting agenda.
 *
 * The upcoming/current meeting stays fully expanded (and accepts new items).
 * It becomes "previous" the day after the meeting, when a fresh upcoming
 * meeting is generated (see groupAgendaByMeeting). Previous meetings render as a
 * collapsed, date-only accordion — click one to expand it. When more than
 * `previousLimit` exist, a "Show all" link leads to the full meetings screen.
 */
export function WeeklyAgenda({
  groups,
  previousLimit,
  showAllHref,
  ownerOptions = [],
  transcriptsByDate,
  transcriptOwners = [],
  aiEnabled = false,
}: {
  groups: AgendaMeetingGroup[]
  previousLimit?: number
  showAllHref?: string
  ownerOptions?: TaskOwnerOption[]
  /** When provided, each meeting shows its transcript + AI summary flow. */
  transcriptsByDate?: Record<string, MeetingTranscriptView | undefined>
  transcriptOwners?: TranscriptOwnerOption[]
  aiEnabled?: boolean
}) {
  const current = groups.find((g) => g.isUpcoming) ?? null
  const previous = groups.filter((g) => !g.isUpcoming)
  const shown = typeof previousLimit === 'number' ? previous.slice(0, previousLimit) : previous
  const hasMore = typeof previousLimit === 'number' && previous.length > previousLimit
  const transcriptsEnabled = Boolean(transcriptsByDate)

  return (
    <div className="space-y-5">
      {current && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">
              Meeting — {formatMeetingLabel(current.meetingDate)}
              <span className="ml-2 rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                Upcoming
              </span>
            </h3>
            <AgendaAddForm meetingDate={current.meetingDate} />
          </div>
          {current.items.length > 0 ? (
            <AgendaItemList items={current.items} ownerOptions={ownerOptions} />
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
              No agenda items yet. Add the first one for this meeting.
            </p>
          )}
          {transcriptsEnabled && (
            <div className="mt-3">
              <MeetingTranscriptPanel
                context={{ kind: 'weekly', meetingDate: current.meetingDate }}
                transcript={transcriptsByDate?.[current.meetingDate] ?? null}
                owners={transcriptOwners}
                aiEnabled={aiEnabled}
              />
            </div>
          )}
        </div>
      )}

      {previous.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Previous meetings</h4>
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {shown.map((group) => (
              <PreviousMeetingRow
                key={group.meetingDate}
                group={group}
                ownerOptions={ownerOptions}
                transcriptsEnabled={transcriptsEnabled}
                transcript={transcriptsByDate?.[group.meetingDate] ?? null}
                transcriptOwners={transcriptOwners}
                aiEnabled={aiEnabled}
              />
            ))}
          </div>
          {hasMore && showAllHref && (
            <Link href={showAllHref} className="inline-flex px-1 pt-1 text-sm font-medium text-orange-600 hover:underline">
              Show all {previous.length} meetings →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function PreviousMeetingRow({
  group,
  ownerOptions,
  transcriptsEnabled = false,
  transcript = null,
  transcriptOwners = [],
  aiEnabled = false,
}: {
  group: AgendaMeetingGroup
  ownerOptions: TaskOwnerOption[]
  transcriptsEnabled?: boolean
  transcript?: MeetingTranscriptView | null
  transcriptOwners?: TranscriptOwnerOption[]
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const count = group.items.length
  const hasTranscript = Boolean(transcript)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span className="text-sm font-medium text-neutral-800">{formatMeetingLabel(group.meetingDate)}</span>
        <span className="flex items-center gap-2 text-xs text-neutral-400">
          {transcriptsEnabled && hasTranscript && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700" title="Has a transcript">📄</span>
          )}
          {count} item{count === 1 ? '' : 's'}
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-neutral-50/50 px-4 pb-4 pt-1">
          {count > 0 ? (
            <AgendaItemList items={group.items} ownerOptions={ownerOptions} />
          ) : (
            <p className="py-3 text-center text-xs text-neutral-400">No items recorded for this meeting.</p>
          )}
          {transcriptsEnabled && (
            <MeetingTranscriptPanel
              context={{ kind: 'weekly', meetingDate: group.meetingDate }}
              transcript={transcript}
              owners={transcriptOwners}
              aiEnabled={aiEnabled}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}
