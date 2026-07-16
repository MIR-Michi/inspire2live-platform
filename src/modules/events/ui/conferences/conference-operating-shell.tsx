'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { OptionalField } from '@/components/comms/optional-field'
import { ConfettiBurst } from '@/components/ui/confetti-burst'
import {
  CONFERENCE_STAGES,
  CONFERENCE_STAGE_LABELS,
  type ConferenceAssignedContact,
  type ConferenceStage,
  type ConferenceView,
} from '@/lib/comms-conferences'
import { ConferenceGuestLink } from '@/components/comms/conferences/conference-guest-link'
import { ConferenceGuestReports } from '@/components/comms/conferences/conference-guest-reports'
import type { ConferenceGuestReport } from '@/lib/comms-conference-guest-reports'
import type { ConferenceInvite } from '@/lib/comms-conference-invites'
import {
  type ConferenceKeyPerson,
  type ConferencePrep,
  type ConferencePrepFlag,
} from '@/lib/comms-conference-prep'
import {
  ATTENDING_TYPE_LABELS,
  PHASE_LABELS,
  deriveConferencePhase,
  isPresenting,
  phaseStatusLine,
  rollUpTileStatus,
  statusLabel,
  statusTone,
  tileProgress,
  tileRequirementStatuses,
  toAttendingType,
  type AttendingType,
  type ConferencePhase,
  type RequirementContext,
  type RequirementInputs,
  type RequirementStatus,
  type RequirementTile,
  type TileStatus,
} from '@/modules/events/domain/conference-requirements'
import {
  addConferenceToShortlist,
  advanceConferenceStage,
  createConferenceTask,
  deleteConferenceTask,
  saveConferencePrep,
  setConferenceNotes,
  toggleConferencePrepFlag,
  updateConferenceTaskOwner,
  updateConferenceTaskStatus,
  type ConferenceTask,
} from '@/app/app/comms/conferences/actions'

type Profile = { id: string; name: string | null; email: string }
type Option = { id: string; name?: string; label?: string }

const FORMAT_LABELS: Record<string, string> = { in_person: 'In person', virtual: 'Virtual', hybrid: 'Hybrid' }

const STAGE_TONES: Record<ConferenceStage, StatusTone> = {
  intended: 'blue',
  registered: 'violet',
  ongoing: 'amber',
  follow_up: 'green',
  archived: 'neutral',
}

const FIELD_CLS =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400'
const LABEL_CLS = 'block space-y-1.5'
const LABEL_TEXT_CLS = 'text-xs font-semibold uppercase tracking-wide text-neutral-500'

/** Form-action wrapper: server actions return a result, but <form action> wants void. */
async function savePrepAction(formData: FormData) {
  await saveConferencePrep(formData)
}

function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (value: string, withYear = true) => {
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) return ''
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(ms))
  }
  if (!start) return 'Dates to be confirmed'
  const startFmt = fmt(start, !end || end === start)
  if (!startFmt) return 'Dates to be confirmed'
  if (!end || end === start) return startFmt
  const endFmt = fmt(end)
  return endFmt ? `${startFmt} – ${endFmt}` : startFmt
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
]

function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Material presence flags the requirement model reads, derived from the prep row. */
function prepToInputs(prep: ConferencePrep): RequirementInputs {
  return {
    hasAbstract: Boolean(prep.abstract),
    hasDeck: Boolean(prep.deckUrl),
    delivered: prep.delivered,
    hasPhotos: prep.photoUrls.length > 0,
    hasTakeaways: Boolean(prep.takeaways),
    reportDone:
      prep.outputReport || prep.outputLinkedin || prep.outputWebsite || prep.outputWhatsapp || prep.outputNewsletter,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ConferenceOperatingShell({
  conference,
  stage,
  notes,
  prep,
  profiles,
  podcastEvents,
  campusSessions,
  assignedContacts = [],
  initialTasks = [],
  guestReports = [],
  invites = [],
}: {
  conference: ConferenceView
  stage: ConferenceStage | null
  notes: string | null
  prep: ConferencePrep
  profiles: Profile[]
  podcastEvents: Option[]
  campusSessions: Option[]
  assignedContacts?: ConferenceAssignedContact[]
  initialTasks?: ConferenceTask[]
  guestReports?: ConferenceGuestReport[]
  invites?: ConferenceInvite[]
}) {
  const [realStage, setRealStage] = useState<ConferenceStage | null>(stage)
  const [attending, setAttending] = useState<AttendingType>(toAttendingType({ hasPresentation: prep.hasPresentation }))

  const phase = useMemo(
    () => deriveConferencePhase(conference.startDate, conference.endDate, realStage),
    [conference.startDate, conference.endDate, realStage]
  )
  const inputs = useMemo(() => prepToInputs(prep), [prep])
  const ctx: RequirementContext = { phase, attendingType: attending }

  const tracked = realStage !== null
  const location = conference.location

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <Link href="/app/comms/conferences" className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800">
        ← Conferences
      </Link>

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={conference.regionLabel} tone="neutral" />
            {conference.mainFocus && <StatusBadge label={conference.mainFocus} tone="blue" />}
            {realStage && <StatusBadge label={CONFERENCE_STAGE_LABELS[realStage]} tone={STAGE_TONES[realStage]} />}
          </div>
          {assignedContacts.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {assignedContacts.slice(0, 5).map((c, i) => (
                <span
                  key={c.id}
                  title={c.fullName}
                  className={['flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold', AVATAR_COLORS[i % AVATAR_COLORS.length]].join(' ')}
                >
                  {nameInitials(c.fullName)}
                </span>
              ))}
              {assignedContacts.length > 5 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-[10px] font-bold text-neutral-500">
                  +{assignedContacts.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-neutral-900">{conference.name}</h1>
        <p className="text-sm text-neutral-500">
          {formatDateRange(conference.startDate, conference.endDate)}
          {location && <> · {location}</>}
          {conference.organizer && <> · {conference.organizer}</>}
        </p>
        {conference.websiteUrl && (
          <a href={conference.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-orange-700 hover:underline">
            Official website ↗
          </a>
        )}
      </div>

      {!tracked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/60 px-4 py-3">
          <p className="text-sm text-neutral-700">This conference isn’t in the pipeline yet. Add it to start preparing.</p>
          <AddToPipelineButton conferenceId={conference.id} onAdded={() => setRealStage('intended')} />
        </div>
      )}

      {/* Phase header — where we are in time, not a tab bar */}
      <PhaseHeader
        phase={phase}
        startDate={conference.startDate}
        endDate={conference.endDate}
        realStage={realStage}
        onStageChange={setRealStage}
        conferenceId={conference.id}
      />

      {/* Tiles */}
      <AttendanceTile
        conference={conference}
        notes={notes}
        attending={attending}
        onAttendingChange={setAttending}
        tracked={tracked}
      />

      {isPresenting(attending) && (
        <RequirementTile tile="presentation" title="Presentation" ctx={ctx} inputs={inputs} conferenceId={conference.id}>
          <PresentationFields conference={conference} prep={prep} />
        </RequirementTile>
      )}

      <PeopleTile conference={conference} prep={prep} />

      <RequirementTile tile="onsite" title="On-site & photos" ctx={ctx} inputs={inputs} conferenceId={conference.id}>
        <OnsiteFields conference={conference} prep={prep} />
      </RequirementTile>

      <RequirementTile tile="amplify" title="Amplify & follow-up" ctx={ctx} inputs={inputs} conferenceId={conference.id}>
        <AmplifyFields conference={conference} prep={prep} podcastEvents={podcastEvents} campusSessions={campusSessions} />
      </RequirementTile>

      <DetailsTile conference={conference} prep={prep} profiles={profiles} />

      <CollapsibleCard
        title="Guest invites"
        tone="orange"
        storageKey={`conf-${conference.id}-invites`}
        defaultCollapsed={invites.length === 0}
      >
        <div className="space-y-4">
          <ConferenceGuestLink
            conferenceId={conference.id}
            conferenceName={conference.name}
            contacts={assignedContacts.map((c) => ({
              contactId: c.id,
              contactName: c.fullName,
              contactEmail: c.email,
              contactPhone: c.whatsappId,
            }))}
          />
          <InviteLog invites={invites} />
        </div>
      </CollapsibleCard>

      {tracked && (
        <CollapsibleCard title="Tasks" storageKey={`conf-${conference.id}-tasks`}>
          <ConferenceTasks conferenceId={conference.id} initialTasks={initialTasks} profiles={profiles} attendees={assignedContacts} />
        </CollapsibleCard>
      )}

      {guestReports.length > 0 && (
        <CollapsibleCard title={`Guest reports (${guestReports.length})`} storageKey={`conf-${conference.id}-guest-reports`} defaultCollapsed>
          <ConferenceGuestReports reports={guestReports} />
        </CollapsibleCard>
      )}
    </div>
  )
}

// ─── Phase header ───────────────────────────────────────────────────────────────

function PhaseHeader({
  phase,
  startDate,
  endDate,
  realStage,
  onStageChange,
  conferenceId,
}: {
  phase: ConferencePhase
  startDate: string | null
  endDate: string | null
  realStage: ConferenceStage | null
  onStageChange: (s: ConferenceStage) => void
  conferenceId: string
}) {
  const [pending, start] = useTransition()
  const phases: ConferencePhase[] = ['before', 'during', 'after']
  const currentIndex = phases.indexOf(phase)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-1">
        {phases.map((p, i) => {
          const active = p === phase
          const done = i < currentIndex
          return (
            <div
              key={p}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold',
                active ? 'bg-neutral-900 text-white' : done ? 'text-emerald-600' : 'text-neutral-400',
              ].join(' ')}
            >
              {done && <span>✓</span>}
              {PHASE_LABELS[p]}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-neutral-500">{phaseStatusLine(phase, startDate, endDate)}</p>
        {realStage !== null && (
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="uppercase tracking-wide">Stage</span>
            <select
              value={realStage}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value as ConferenceStage
                onStageChange(next)
                start(async () => {
                  await advanceConferenceStage(conferenceId, next)
                })
              }}
              className="rounded-md border border-neutral-200 px-1.5 py-1 text-xs font-semibold text-neutral-700 focus:border-orange-400 focus:outline-none"
            >
              {CONFERENCE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {CONFERENCE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}

// ─── Status chrome ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: RequirementStatus | TileStatus }) {
  if (status === 'na' || status === 'empty') return null
  const tone = statusTone(status)
  const color = tone === 'green' ? 'bg-emerald-500' : tone === 'red' ? 'bg-red-500' : 'bg-neutral-300'
  const icon = status === 'provided' ? '✓' : status === 'due' ? '!' : '·'
  return (
    <span
      className={['flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', color].join(' ')}
      role="img"
      aria-label={statusLabel(status)}
      title={statusLabel(status)}
    >
      {icon}
    </span>
  )
}

/** A requirement tile: collapsible card with a rolled-up status dot + item list. */
function RequirementTile({
  tile,
  title,
  ctx,
  inputs,
  conferenceId,
  children,
}: {
  tile: RequirementTile
  title: string
  ctx: RequirementContext
  inputs: RequirementInputs
  conferenceId: string
  children: React.ReactNode
}) {
  const items = tileRequirementStatuses(tile, ctx, inputs)
  const statuses = items.map((i) => i.status)
  const rolled = rollUpTileStatus(statuses)
  const progress = tileProgress(statuses)

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <StatusDot status={rolled} />
          {title}
        </span>
      }
      storageKey={`conf-${conferenceId}-${tile}`}
      defaultCollapsed={rolled !== 'due'}
      actions={
        progress.total > 0 ? (
          <span className="text-[11px] font-semibold tabular-nums text-neutral-400">
            {progress.done}/{progress.total}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <RequirementList items={items} />
        {children}
      </div>
    </CollapsibleCard>
  )
}

function RequirementList({ items }: { items: Array<{ req: { key: string; label: string }; status: RequirementStatus }> }) {
  const visible = items.filter((i) => i.status !== 'na')
  if (visible.length === 0) return null
  return (
    <ul className="space-y-1.5 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
      {visible.map(({ req, status }) => (
        <li key={req.key} className="flex items-center gap-2 text-sm">
          <StatusDot status={status} />
          <span className={status === 'provided' ? 'text-neutral-500 line-through' : status === 'due' ? 'font-medium text-neutral-800' : 'text-neutral-500'}>
            {req.label}
          </span>
          {status === 'due' && <span className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Needed now</span>}
        </li>
      ))}
    </ul>
  )
}

// ─── Shared form pieces ─────────────────────────────────────────────────────────

function SubmitButton({ label = 'Save' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60">
      {pending ? 'Saving…' : label}
    </button>
  )
}

function FlagToggle({ conferenceId, flag, label, checked }: { conferenceId: string; flag: ConferencePrepFlag; label: string; checked: boolean }) {
  const [on, setOn] = useState(checked)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !on
        setOn(next)
        start(async () => {
          await toggleConferencePrepFlag(conferenceId, flag, next)
        })
      }}
      className={['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-neutral-50 disabled:opacity-60', on ? 'text-emerald-700' : 'text-neutral-600'].join(' ')}
    >
      <span className={['flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold', on ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-neutral-300 bg-white text-transparent'].join(' ')}>
        ✓
      </span>
      <span className={on ? 'line-through opacity-60' : ''}>{label}</span>
    </button>
  )
}

function FlagPill({ conferenceId, flag, label, checked }: { conferenceId: string; flag: ConferencePrepFlag; label: string; checked: boolean }) {
  const [on, setOn] = useState(checked)
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !on
        setOn(next)
        start(async () => void (await toggleConferencePrepFlag(conferenceId, flag, next)))
      }}
      className={['rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60', on ? 'border-violet-200 bg-violet-100 text-violet-800' : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'].join(' ')}
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  )
}

function AddToPipelineButton({ conferenceId, onAdded }: { conferenceId: string; onAdded: () => void }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await addConferenceToShortlist(conferenceId)
          if (res.ok) onAdded()
        })
      }
      className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
    >
      + Add to pipeline
    </button>
  )
}

// ─── Attendance tile ────────────────────────────────────────────────────────────

function AttendanceTile({
  conference,
  notes,
  attending,
  onAttendingChange,
  tracked,
}: {
  conference: ConferenceView
  notes: string | null
  attending: AttendingType
  onAttendingChange: (t: AttendingType) => void
  tracked: boolean
}) {
  const [value, setValue] = useState(notes ?? '')
  const [pending, start] = useTransition()
  const [savingType, startType] = useTransition()

  const setType = (next: AttendingType) => {
    onAttendingChange(next)
    // Persist as the has_presentation boolean (attendance section owns it only).
    const fd = new FormData()
    fd.set('conference_id', conference.id)
    fd.set('section', 'attendance')
    fd.set('has_presentation', isPresenting(next) ? 'yes' : 'no')
    startType(async () => {
      await saveConferencePrep(fd)
    })
  }

  return (
    <CollapsibleCard title="Attendance & role" storageKey={`conf-${conference.id}-attendance`}>
      <div className="space-y-5">
        <div>
          <p className={LABEL_TEXT_CLS}>How are we attending?</p>
          <p className="mt-1 text-xs text-neutral-500">This decides what we ask for — presenters get presentation prompts; everyone gets photos during the event.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['attendee', 'presenter', 'organizer'] as AttendingType[]).map((t) => (
              <button
                key={t}
                type="button"
                disabled={savingType}
                onClick={() => setType(t)}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60',
                  attending === t ? 'border-orange-300 bg-orange-100 text-orange-800' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                ].join(' ')}
              >
                {ATTENDING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {conference.summary && <p className="text-sm leading-relaxed text-neutral-700">{conference.summary}</p>}

        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Why attend — rationale & notes</span>
          <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} className={FIELD_CLS} placeholder="Why this conference matters, proposed attendees, budget…" />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || !tracked}
            onClick={() => start(async () => void (await setConferenceNotes(conference.id, value)))}
            className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save notes'}
          </button>
          {!tracked && <p className="text-xs text-neutral-400">Add the conference to the pipeline above to start tracking.</p>}
        </div>
      </div>
    </CollapsibleCard>
  )
}

// ─── Presentation fields ─────────────────────────────────────────────────────────

function PresentationFields({ conference, prep }: { conference: ConferenceView; prep: ConferencePrep }) {
  return (
    <form action={savePrepAction} className="space-y-4">
      <input type="hidden" name="conference_id" value={conference.id} />
      <input type="hidden" name="section" value="presentation" />

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        <FlagToggle conferenceId={conference.id} flag="abstractSubmitted" label="Abstract submitted" checked={prep.abstractSubmitted} />
        <FlagToggle conferenceId={conference.id} flag="deckDrafted" label="Deck drafted" checked={prep.deckDrafted} />
        <FlagToggle conferenceId={conference.id} flag="deckFinal" label="Deck final" checked={prep.deckFinal} />
        <FlagToggle conferenceId={conference.id} flag="delivered" label="Presentation delivered" checked={prep.delivered} />
      </div>

      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Presentation title</span>
        <input name="presentation_title" defaultValue={prep.presentationTitle ?? ''} className={FIELD_CLS} placeholder="Working title" />
      </label>
      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Abstract</span>
        <textarea name="abstract" defaultValue={prep.abstract ?? ''} rows={4} className={FIELD_CLS} placeholder="Abstract submitted to the conference" />
      </label>
      {prep.deckUrl ? (
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Presentation deck (link)</span>
          <input type="url" name="deck_url" defaultValue={prep.deckUrl} className={FIELD_CLS} />
        </label>
      ) : (
        <>
          <input type="hidden" name="deck_url" value="" />
          <OptionalField label="Add deck link" hasValue={false}>
            <label className={LABEL_CLS}>
              <span className={LABEL_TEXT_CLS}>Presentation deck (link)</span>
              <input type="url" name="deck_url" defaultValue="" className={FIELD_CLS} placeholder="SharePoint / Drive URL" />
            </label>
          </OptionalField>
        </>
      )}
      {prep.assetUrls.length > 0 ? (
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Supporting links (one per line)</span>
          <textarea name="asset_urls" defaultValue={prep.assetUrls.join('\n')} rows={2} className={FIELD_CLS} />
        </label>
      ) : (
        <>
          <input type="hidden" name="asset_urls" value="" />
          <OptionalField label="Add supporting links" hasValue={false}>
            <label className={LABEL_CLS}>
              <span className={LABEL_TEXT_CLS}>Supporting links (one per line)</span>
              <textarea name="asset_urls" defaultValue="" rows={2} className={FIELD_CLS} placeholder="Runbook, handout, notes…" />
            </label>
          </OptionalField>
        </>
      )}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}

// ─── People tile ────────────────────────────────────────────────────────────────

function PeopleTile({ conference, prep }: { conference: ConferenceView; prep: ConferencePrep }) {
  const connected = prep.keyPeople.filter((p) => p.connected).length
  return (
    <CollapsibleCard
      title="People to connect with"
      storageKey={`conf-${conference.id}-people`}
      defaultCollapsed={prep.keyPeople.length === 0}
      actions={prep.keyPeople.length > 0 ? <span className="text-[11px] font-semibold tabular-nums text-neutral-400">{connected}/{prep.keyPeople.length} met</span> : undefined}
    >
      <form action={savePrepAction} className="space-y-4">
        <input type="hidden" name="conference_id" value={conference.id} />
        <input type="hidden" name="section" value="people" />
        <KeyPeopleEditor initial={prep.keyPeople} />
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </CollapsibleCard>
  )
}

function KeyPeopleEditor({ initial }: { initial: ConferenceKeyPerson[] }) {
  const [people, setPeople] = useState<ConferenceKeyPerson[]>(initial)
  const update = (i: number, patch: Partial<ConferenceKeyPerson>) => setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const remove = (i: number) => setPeople((prev) => prev.filter((_, idx) => idx !== i))
  const add = () => setPeople((prev) => [...prev, { name: '', org: '', topic: '', connected: false }])

  return (
    <div className="space-y-2">
      <input type="hidden" name="key_people" value={JSON.stringify(people.filter((p) => p.name.trim()))} />
      {people.map((person, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input value={person.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className={FIELD_CLS} />
          <input value={person.org} onChange={(e) => update(i, { org: e.target.value })} placeholder="Organisation" className={FIELD_CLS} />
          <input value={person.topic} onChange={(e) => update(i, { topic: e.target.value })} placeholder="Topic / why" className={FIELD_CLS} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-semibold text-neutral-500">
              <input type="checkbox" checked={person.connected} onChange={(e) => update(i, { connected: e.target.checked })} className="h-4 w-4 rounded accent-emerald-600" />
              Met
            </label>
            <button type="button" onClick={() => remove(i)} aria-label="Remove person" className="text-neutral-400 hover:text-red-600">
              ×
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm font-medium text-neutral-400 transition hover:text-neutral-700">
        + Add person
      </button>
    </div>
  )
}

// ─── On-site fields ─────────────────────────────────────────────────────────────

function OnsiteFields({ conference, prep }: { conference: ConferenceView; prep: ConferencePrep }) {
  return (
    <form action={savePrepAction} className="space-y-4">
      <input type="hidden" name="conference_id" value={conference.id} />
      <input type="hidden" name="section" value="onsite" />
      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Photos (one link per line)</span>
        <textarea name="photo_urls" defaultValue={prep.photoUrls.join('\n')} rows={3} className={FIELD_CLS} placeholder="Links to photos from the event" />
      </label>
      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Takeaways & quotes</span>
        <textarea name="takeaways" defaultValue={prep.takeaways ?? ''} rows={4} className={FIELD_CLS} placeholder="Key moments captured on-site — feeds the report and any podcast/campus idea." />
      </label>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}

// ─── Amplify fields ─────────────────────────────────────────────────────────────

function AmplifyFields({
  conference,
  prep,
  podcastEvents,
  campusSessions,
}: {
  conference: ConferenceView
  prep: ConferencePrep
  podcastEvents: Option[]
  campusSessions: Option[]
}) {
  return (
    <div className="space-y-4">
      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        <FlagToggle conferenceId={conference.id} flag="outputReport" label="Report drafted" checked={prep.outputReport} />
        <FlagToggle conferenceId={conference.id} flag="outputLinkedin" label="LinkedIn post" checked={prep.outputLinkedin} />
        <FlagToggle conferenceId={conference.id} flag="outputWebsite" label="Website mention" checked={prep.outputWebsite} />
        <FlagToggle conferenceId={conference.id} flag="outputWhatsapp" label="WhatsApp share" checked={prep.outputWhatsapp} />
        <FlagToggle conferenceId={conference.id} flag="outputNewsletter" label="Newsletter mention" checked={prep.outputNewsletter} />
      </div>

      <div className="space-y-2">
        <p className={LABEL_TEXT_CLS}>Repurpose</p>
        <div className="flex flex-wrap gap-2">
          <FlagPill conferenceId={conference.id} flag="podcastIdea" label="Interesting for a podcast?" checked={prep.podcastIdea} />
          <FlagPill conferenceId={conference.id} flag="campusIdea" label="Present at World Campus?" checked={prep.campusIdea} />
        </div>
      </div>

      <form action={savePrepAction} className="space-y-4">
        <input type="hidden" name="conference_id" value={conference.id} />
        <input type="hidden" name="section" value="amplify" />
        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Follow-up notes</span>
          <textarea name="followup_notes" defaultValue={prep.followupNotes ?? ''} rows={3} className={FIELD_CLS} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Link podcast episode</span>
            <select name="podcast_event_id" defaultValue={prep.podcastEventId ?? ''} className={FIELD_CLS}>
              <option value="">Not linked</option>
              {podcastEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Link campus session</span>
            <select name="campus_session_id" defaultValue={prep.campusSessionId ?? ''} className={FIELD_CLS}>
              <option value="">Not linked</option>
              {campusSessions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}

// ─── Details tile ───────────────────────────────────────────────────────────────

function DetailsTile({ conference, prep, profiles }: { conference: ConferenceView; prep: ConferencePrep; profiles: Profile[] }) {
  return (
    <CollapsibleCard title="Details & links" storageKey={`conf-${conference.id}-details`} defaultCollapsed>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3">
          <Recap label="Region" value={conference.regionLabel} />
          {conference.mainFocus && <Recap label="Focus" value={conference.mainFocus} />}
          <Recap label="Format" value={FORMAT_LABELS[conference.format] ?? conference.format} />
          {conference.location && <Recap label="Location" value={conference.location} />}
        </dl>

        <form action={savePrepAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="conference_id" value={conference.id} />
          <input type="hidden" name="section" value="comms" />
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Comms owner</span>
            <select name="comms_owner_id" defaultValue={prep.commsOwnerId ?? ''} className={FIELD_CLS}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Contributor</span>
            <select name="comms_contributor_id" defaultValue={prep.commsContributorId ?? ''} className={FIELD_CLS}>
              <option value="">None</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <SubmitButton label="Save owners" />
          </div>
        </form>

        {(conference.websiteUrl || prep.deckUrl) && (
          <div className="space-y-1.5">
            {conference.websiteUrl && (
              <a href={conference.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                Conference website <span className="text-neutral-400">↗</span>
              </a>
            )}
            {prep.deckUrl && (
              <a href={prep.deckUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
                Presentation deck <span className="text-neutral-400">↗</span>
              </a>
            )}
          </div>
        )}
      </div>
    </CollapsibleCard>
  )
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-700">{value}</dd>
    </div>
  )
}

// ─── Invite log ─────────────────────────────────────────────────────────────────

function InviteLog({ invites }: { invites: ConferenceInvite[] }) {
  if (invites.length === 0) {
    return <p className="text-xs text-neutral-400">No invites sent yet.</p>
  }
  const toneFor = (s: ConferenceInvite['status']): StatusTone =>
    s === 'sent' ? 'green' : s === 'failed' ? 'red' : s === 'partial' ? 'amber' : 'neutral'
  const labelFor = (s: ConferenceInvite['status']): string =>
    s === 'sent' ? 'Delivered' : s === 'failed' ? 'Failed' : s === 'partial' ? 'Partial' : 'Sending…'

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Invitations sent</p>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-800">{invite.recipientName ?? invite.recipientEmail ?? invite.recipientPhone ?? 'Guest'}</p>
              <p className="truncate text-xs text-neutral-500">
                {invite.channels.length > 0 ? invite.channels.join(' + ') : 'no channel'}
                {invite.sentAt ? ` · ${new Date(invite.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
              </p>
            </div>
            <StatusBadge label={labelFor(invite.status)} tone={toneFor(invite.status)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Conference tasks ──────────────────────────────────────────────────────────

function ConferenceTasks({
  conferenceId,
  initialTasks,
  profiles,
  attendees,
}: {
  conferenceId: string
  initialTasks: ConferenceTask[]
  profiles: Profile[]
  attendees: ConferenceAssignedContact[]
}) {
  const [tasks, setTasks] = useState<ConferenceTask[]>(initialTasks)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const [fireKey, setFireKey] = useState(0)
  const [pending, start] = useTransition()

  const attendeeProfileIds = new Set(attendees.map((a) => a.id))
  const attendeeProfiles = profiles.filter((p) => attendeeProfileIds.has(p.id))
  const defaultOwner = attendeeProfiles[0]?.id ?? ''

  const handleAdd = () => {
    const title = newTitle.trim()
    if (!title) return
    start(async () => {
      const result = await createConferenceTask({ conferenceId, title, ownerId: newOwner || null })
      if (result.ok && result.task) {
        const ownerProfile = profiles.find((p) => p.id === (newOwner || null))
        setTasks((prev) => [...prev, { ...result.task!, ownerName: ownerProfile?.name ?? null }])
        setNewTitle('')
        setNewOwner(defaultOwner)
        setAdding(false)
      }
    })
  }

  const handleToggle = (task: ConferenceTask) => {
    const next: ConferenceTask['status'] = task.status === 'completed' ? 'not_started' : 'completed'
    if (next === 'completed') {
      setPoppingId(task.id)
      window.setTimeout(() => setPoppingId((id) => (id === task.id ? null : id)), 450)
      if (tasks.every((t) => t.id === task.id || t.status === 'completed')) setFireKey((k) => k + 1)
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    start(async () => { await updateConferenceTaskStatus(task.id, next) })
  }

  const handleOwnerChange = (task: ConferenceTask, ownerId: string) => {
    const ownerProfile = profiles.find((p) => p.id === ownerId)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ownerId: ownerId || null, ownerName: ownerProfile?.name ?? null } : t)))
    start(async () => { await updateConferenceTaskOwner(task.id, ownerId || null, conferenceId) })
  }

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    start(async () => { await deleteConferenceTask(taskId, conferenceId) })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end px-1">
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setNewOwner(defaultOwner) }} className="text-xs font-semibold text-neutral-400 hover:text-orange-700">
            + Add task
          </button>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="relative divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          <ConfettiBurst fireKey={fireKey} />
          {tasks.map((task, index) => (
            <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleToggle(task)}
                className={['flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-transform', task.status === 'completed' ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-neutral-300 bg-white text-transparent', poppingId === task.id ? 'animate-check-pop' : ''].join(' ')}
              >
                ✓
              </button>
              <span className={['flex-1 text-sm transition-colors', task.status === 'completed' ? 'text-neutral-400' : 'text-neutral-700'].join(' ')}>
                <span className="strike-sweep" data-struck={task.status === 'completed'}>{task.title}</span>
              </span>
              <select
                value={task.ownerId ?? ''}
                onChange={(e) => handleOwnerChange(task, e.target.value)}
                disabled={pending}
                className="rounded border border-neutral-200 px-1.5 py-1 text-xs text-neutral-600 focus:border-orange-400 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
                ))}
              </select>
              <button type="button" onClick={() => handleDelete(task.id)} disabled={pending} className="text-neutral-300 hover:text-red-500 disabled:opacity-40" aria-label="Delete task">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2 flex gap-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Task title…"
            autoFocus
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
          />
          <select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600 focus:border-violet-400 focus:outline-none">
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
            ))}
          </select>
          <button type="button" onClick={handleAdd} disabled={pending || !newTitle.trim()} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-neutral-400 hover:text-neutral-700">
            Cancel
          </button>
        </div>
      )}

      {tasks.length === 0 && !adding && <p className="px-1 text-xs text-neutral-400">No tasks yet. Add one above.</p>}
    </div>
  )
}
