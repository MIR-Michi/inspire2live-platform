'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { OptionalField } from '@/components/comms/optional-field'
import {
  CONFERENCE_STAGES,
  CONFERENCE_STAGE_LABELS,
  type ConferenceAssignedContact,
  type ConferenceStage,
  type ConferenceView,
} from '@/lib/comms-conferences'
import {
  STAGE_CHECKLISTS,
  showsPresentationBlocks,
  stagePrepProgress,
  type ConferenceKeyPerson,
  type ConferencePrep,
  type ConferencePrepFlag,
} from '@/lib/comms-conference-prep'
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
}) {
  const [realStage, setRealStage] = useState<ConferenceStage | null>(stage)
  const [activeStage, setActiveStage] = useState<ConferenceStage>(stage ?? 'intended')

  const handleAdvanced = (to: ConferenceStage) => {
    setRealStage(to)
    setActiveStage(to)
  }

  const location = conference.location
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
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

      {realStage === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/60 px-4 py-3">
          <p className="text-sm text-neutral-700">This conference isn’t in the pipeline yet. Add it to start preparing.</p>
          <AddToPipelineButton conferenceId={conference.id} onAdded={() => handleAdvanced('intended')} />
        </div>
      )}

      {/* Stage stepper — the pipeline itself */}
      <StageRail realStage={realStage} activeStage={activeStage} prep={prep} onSelect={setActiveStage} />

      {/* Active stage section + lean sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {activeStage === 'intended' && (
            <IntendedPanel conference={conference} notes={notes} tracked={realStage !== null} onAdvanced={handleAdvanced} />
          )}
          {activeStage === 'registered' && (
            <RegisteredPanel conference={conference} prep={prep} profiles={profiles} onAdvanced={handleAdvanced} />
          )}
          {activeStage === 'ongoing' && <OngoingPanel conference={conference} prep={prep} onAdvanced={handleAdvanced} />}
          {activeStage === 'follow_up' && (
            <FollowUpPanel conference={conference} prep={prep} podcastEvents={podcastEvents} campusSessions={campusSessions} onAdvanced={handleAdvanced} />
          )}
          {activeStage === 'archived' && <ArchivedPanel conference={conference} prep={prep} profiles={profiles} />}

          {realStage !== null && (
            <div className="mt-6">
              <ConferenceTasks
                conferenceId={conference.id}
                initialTasks={initialTasks}
                profiles={profiles}
                attendees={assignedContacts}
              />
            </div>
          )}
        </div>

        <Sidebar conference={conference} prep={prep} profiles={profiles} />
      </div>
    </div>
  )
}

// ─── Stage rail ───────────────────────────────────────────────────────────────

function StageRail({
  realStage,
  activeStage,
  prep,
  onSelect,
}: {
  realStage: ConferenceStage | null
  activeStage: ConferenceStage
  prep: ConferencePrep
  onSelect: (stage: ConferenceStage) => void
}) {
  const realIndex = realStage ? CONFERENCE_STAGES.indexOf(realStage) : -1
  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1">
      {CONFERENCE_STAGES.map((stage, i) => {
        const isViewing = stage === activeStage
        const isDone = realIndex >= 0 && i < realIndex
        const isCurrent = stage === realStage
        const progress = stagePrepProgress(prep, stage)
        const allDone = progress.total > 0 && progress.done === progress.total
        return (
          <button
            key={stage}
            type="button"
            onClick={() => onSelect(stage)}
            className={[
              'relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition',
              isViewing ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
            ].join(' ')}
          >
            {(isDone || allDone) && !isViewing && <span className="text-emerald-500">✓</span>}
            {isCurrent && <span className={isViewing ? 'text-white' : 'text-orange-500'}>●</span>}
            {CONFERENCE_STAGE_LABELS[stage]}
            {progress.total > 0 && !allDone && (
              <span className={['rounded-full px-1.5 text-[11px] font-bold tabular-nums', isViewing ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'].join(' ')}>
                {progress.done}/{progress.total}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ─── Shared form/control pieces ────────────────────────────────────────────────

function SubmitButton({ label = 'Save' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60">
      {pending ? 'Saving…' : label}
    </button>
  )
}

function FlagToggle({
  conferenceId,
  flag,
  label,
  checked,
}: {
  conferenceId: string
  flag: ConferencePrepFlag
  label: string
  checked: boolean
}) {
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

function Checklist({ conferenceId, prep, stage }: { conferenceId: string; prep: ConferencePrep; stage: ConferenceStage }) {
  const items = STAGE_CHECKLISTS[stage]
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Checklist</p>
      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {items.map((item) => (
          <FlagToggle key={`${item.field}-${Boolean(prep[item.field])}`} conferenceId={conferenceId} flag={item.field} label={item.label} checked={Boolean(prep[item.field])} />
        ))}
      </div>
    </div>
  )
}

function AdvanceButton({ conferenceId, to, onAdvanced }: { conferenceId: string; to: ConferenceStage; onAdvanced: (s: ConferenceStage) => void }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await advanceConferenceStage(conferenceId, to)
          if (res.ok) onAdvanced(to)
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-60"
    >
      Move to {CONFERENCE_STAGE_LABELS[to]} →
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

function StageActions({ to, onAdvanced, conferenceId }: { to: ConferenceStage | null; onAdvanced: (s: ConferenceStage) => void; conferenceId: string }) {
  if (!to) return null
  return (
    <div className="flex justify-end pt-1">
      <AdvanceButton conferenceId={conferenceId} to={to} onAdvanced={onAdvanced} />
    </div>
  )
}

// ─── Intended ──────────────────────────────────────────────────────────────────

function IntendedPanel({
  conference,
  notes,
  tracked,
  onAdvanced,
}: {
  conference: ConferenceView
  notes: string | null
  tracked: boolean
  onAdvanced: (s: ConferenceStage) => void
}) {
  const [value, setValue] = useState(notes ?? '')
  const [pending, start] = useTransition()

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <p className={LABEL_TEXT_CLS}>Why attend</p>
        <p className="mt-1 text-sm text-neutral-500">Capture the rationale, who should go, and rough cost/logistics before registering.</p>
      </div>
      {conference.summary && <p className="text-sm leading-relaxed text-neutral-700">{conference.summary}</p>}
      <label className={LABEL_CLS}>
        <span className={LABEL_TEXT_CLS}>Rationale & notes</span>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} className={FIELD_CLS} placeholder="Why this conference matters, proposed attendees, budget…" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={pending || !tracked}
          onClick={() => start(async () => void (await setConferenceNotes(conference.id, value)))}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <StageActions to={tracked ? 'registered' : null} onAdvanced={onAdvanced} conferenceId={conference.id} />
      </div>
      {!tracked && <p className="text-xs text-neutral-400">Add the conference to the pipeline above to start tracking.</p>}
    </div>
  )
}

// ─── Registered ─────────────────────────────────────────────────────────────────

function RegisteredPanel({
  conference,
  prep,
  profiles,
  onAdvanced,
}: {
  conference: ConferenceView
  prep: ConferencePrep
  profiles: Profile[]
  onAdvanced: (s: ConferenceStage) => void
}) {
  const [presentation, setPresentation] = useState<'yes' | 'no' | ''>(prep.hasPresentation === true ? 'yes' : prep.hasPresentation === false ? 'no' : '')
  const showBlocks = presentation !== 'no'

  return (
    <div className="space-y-6">
      <Checklist conferenceId={conference.id} prep={prep} stage="registered" />

      <form action={savePrepAction} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="conference_id" value={conference.id} />
        <input type="hidden" name="section" value="registered" />

        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Is there a presentation?</span>
          <select name="has_presentation" value={presentation} onChange={(e) => setPresentation(e.target.value as 'yes' | 'no' | '')} className={FIELD_CLS}>
            <option value="">To be decided</option>
            <option value="yes">Yes — I2L is presenting</option>
            <option value="no">No — attending only</option>
          </select>
        </label>

        {showBlocks && (
          <div className="space-y-4 border-l-2 border-orange-100 pl-4">
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
                    <input type="url" name="deck_url" defaultValue="" className={FIELD_CLS} placeholder="SharePoint / Drive URL — upload coming soon" />
                  </label>
                </OptionalField>
              </>
            )}
          </div>
        )}
        {!showBlocks && (
          <>
            <input type="hidden" name="presentation_title" value="" />
            <input type="hidden" name="abstract" value="" />
            <input type="hidden" name="deck_url" value="" />
          </>
        )}

        <hr className="border-neutral-100" />

        {/* Comms involvement */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Comms owner</span>
            <select name="comms_owner_id" defaultValue={prep.commsOwnerId ?? ''} className={FIELD_CLS}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Contributor</span>
            <select name="comms_contributor_id" defaultValue={prep.commsContributorId ?? ''} className={FIELD_CLS}>
              <option value="">None</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Key people */}
        <KeyPeopleEditor initial={prep.keyPeople} />

        {/* Supporting assets */}
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

        <div className="flex items-center justify-between gap-3">
          <SubmitButton />
          <StageActions to="ongoing" onAdvanced={onAdvanced} conferenceId={conference.id} />
        </div>
      </form>
    </div>
  )
}

function KeyPeopleEditor({ initial }: { initial: ConferenceKeyPerson[] }) {
  const [people, setPeople] = useState<ConferenceKeyPerson[]>(initial)

  const update = (i: number, patch: Partial<ConferenceKeyPerson>) => setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const remove = (i: number) => setPeople((prev) => prev.filter((_, idx) => idx !== i))
  const add = () => setPeople((prev) => [...prev, { name: '', org: '', topic: '', connected: false }])

  const body = (
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

  return (
    <div>
      <p className={`mb-1.5 ${LABEL_TEXT_CLS}`}>Key people to connect with</p>
      {body}
    </div>
  )
}

// ─── Ongoing ────────────────────────────────────────────────────────────────────

function OngoingPanel({ conference, prep, onAdvanced }: { conference: ConferenceView; prep: ConferencePrep; onAdvanced: (s: ConferenceStage) => void }) {
  const showBlocks = showsPresentationBlocks(prep)
  return (
    <div className="space-y-6">
      <Checklist conferenceId={conference.id} prep={prep} stage="ongoing" />

      <form action={savePrepAction} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="conference_id" value={conference.id} />
        <input type="hidden" name="section" value="ongoing" />

        {showBlocks ? (
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Photos (one link per line)</span>
            <textarea name="photo_urls" defaultValue={prep.photoUrls.join('\n')} rows={3} className={FIELD_CLS} placeholder="Links to presentation photos — upload coming soon" />
          </label>
        ) : (
          <input type="hidden" name="photo_urls" value={prep.photoUrls.join('\n')} />
        )}

        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Takeaways & quotes</span>
          <textarea name="takeaways" defaultValue={prep.takeaways ?? ''} rows={4} className={FIELD_CLS} placeholder="Key moments captured on-site — feeds the report and any podcast/campus idea." />
        </label>

        <div className="flex items-center justify-between gap-3">
          <SubmitButton />
          <StageActions to="follow_up" onAdvanced={onAdvanced} conferenceId={conference.id} />
        </div>
      </form>
    </div>
  )
}

// ─── Follow-up ──────────────────────────────────────────────────────────────────

function FollowUpPanel({
  conference,
  prep,
  podcastEvents,
  campusSessions,
  onAdvanced,
}: {
  conference: ConferenceView
  prep: ConferencePrep
  podcastEvents: Option[]
  campusSessions: Option[]
  onAdvanced: (s: ConferenceStage) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Amplify</p>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          <FlagToggle key={`report-${prep.outputReport}`} conferenceId={conference.id} flag="outputReport" label="Report drafted" checked={prep.outputReport} />
          <FlagToggle key={`linkedin-${prep.outputLinkedin}`} conferenceId={conference.id} flag="outputLinkedin" label="LinkedIn post" checked={prep.outputLinkedin} />
          <FlagToggle key={`website-${prep.outputWebsite}`} conferenceId={conference.id} flag="outputWebsite" label="Website mention" checked={prep.outputWebsite} />
          <FlagToggle key={`whatsapp-${prep.outputWhatsapp}`} conferenceId={conference.id} flag="outputWhatsapp" label="WhatsApp share" checked={prep.outputWhatsapp} />
          <FlagToggle key={`newsletter-${prep.outputNewsletter}`} conferenceId={conference.id} flag="outputNewsletter" label="Newsletter mention" checked={prep.outputNewsletter} />
        </div>
      </div>

      {/* Repurpose ideas */}
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <p className={LABEL_TEXT_CLS}>Repurpose</p>
        <div className="flex flex-wrap gap-2">
          <FlagPill key={`podcast-${prep.podcastIdea}`} conferenceId={conference.id} flag="podcastIdea" label="Interesting for a podcast?" checked={prep.podcastIdea} />
          <FlagPill key={`campus-${prep.campusIdea}`} conferenceId={conference.id} flag="campusIdea" label="Present at World Campus?" checked={prep.campusIdea} />
        </div>
      </div>

      <form action={savePrepAction} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="conference_id" value={conference.id} />
        <input type="hidden" name="section" value="follow_up" />

        <label className={LABEL_CLS}>
          <span className={LABEL_TEXT_CLS}>Follow-up notes</span>
          <textarea name="followup_notes" defaultValue={prep.followupNotes ?? ''} rows={4} className={FIELD_CLS} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Link podcast episode</span>
            <select name="podcast_event_id" defaultValue={prep.podcastEventId ?? ''} className={FIELD_CLS}>
              <option value="">Not linked</option>
              {podcastEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            <span className={LABEL_TEXT_CLS}>Link campus session</span>
            <select name="campus_session_id" defaultValue={prep.campusSessionId ?? ''} className={FIELD_CLS}>
              <option value="">Not linked</option>
              {campusSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <SubmitButton />
          <StageActions to="archived" onAdvanced={onAdvanced} conferenceId={conference.id} />
        </div>
      </form>
    </div>
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

// ─── Archived (read-only recap) ─────────────────────────────────────────────────

function ArchivedPanel({ conference, prep, profiles }: { conference: ConferenceView; prep: ConferencePrep; profiles: Profile[] }) {
  const ownerName = prep.commsOwnerId ? profiles.find((p) => p.id === prep.commsOwnerId)?.name ?? null : null
  const outputs = [
    prep.outputReport && 'Report',
    prep.outputLinkedin && 'LinkedIn',
    prep.outputWebsite && 'Website',
    prep.outputWhatsapp && 'WhatsApp',
    prep.outputNewsletter && 'Newsletter',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 text-sm">
      <p className={LABEL_TEXT_CLS}>Recap</p>
      {prep.hasPresentation === false ? (
        <p className="text-neutral-700">Attended without presenting.</p>
      ) : prep.presentationTitle || prep.abstract ? (
        <div className="space-y-1">
          {prep.presentationTitle && <p className="font-semibold text-neutral-900">{prep.presentationTitle}</p>}
          {prep.abstract && <p className="leading-relaxed text-neutral-600">{prep.abstract}</p>}
        </div>
      ) : (
        <p className="text-neutral-400">No presentation details recorded.</p>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <Recap label="Comms owner" value={ownerName ?? '—'} />
        <Recap label="Photos" value={prep.photoUrls.length ? `${prep.photoUrls.length} linked` : '—'} />
        <Recap label="People connected" value={`${prep.keyPeople.filter((p) => p.connected).length}/${prep.keyPeople.length}`} />
        <Recap label="Amplified via" value={outputs.length ? outputs.join(', ') : '—'} />
      </dl>

      {prep.followupNotes && <p className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-neutral-700">{prep.followupNotes}</p>}
      <p className="text-xs text-neutral-400">{conference.name} is archived. Re-open an earlier stage from the rail to edit.</p>
    </div>
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

// ─── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ conference, prep, profiles }: { conference: ConferenceView; prep: ConferencePrep; profiles: Profile[] }) {
  const ownerName = prep.commsOwnerId ? profiles.find((p) => p.id === prep.commsOwnerId)?.name ?? profiles.find((p) => p.id === prep.commsOwnerId)?.email ?? null : null
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Details</h3>
        <dl className="space-y-2">
          <Recap label="Region" value={conference.regionLabel} />
          {conference.mainFocus && <Recap label="Focus" value={conference.mainFocus} />}
          <Recap label="Format" value={FORMAT_LABELS[conference.format] ?? conference.format} />
          {conference.location && <Recap label="Location" value={conference.location} />}
          {ownerName && <Recap label="Comms owner" value={ownerName} />}
        </dl>
      </div>

      {(conference.websiteUrl || prep.deckUrl) && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Links</h3>
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
        </div>
      )}
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
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Tasks</p>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setNewOwner(defaultOwner) }}
            className="text-xs font-semibold text-neutral-400 hover:text-orange-700"
          >
            + Add task
          </button>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => handleToggle(task)}
                className={['flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition', task.status === 'completed' ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-neutral-300 bg-white text-transparent'].join(' ')}
              >
                ✓
              </button>
              <span className={['flex-1 text-sm', task.status === 'completed' ? 'text-neutral-400 line-through' : 'text-neutral-700'].join(' ')}>
                {task.title}
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
              <button
                type="button"
                onClick={() => handleDelete(task.id)}
                disabled={pending}
                className="text-neutral-300 hover:text-red-500 disabled:opacity-40"
                aria-label="Delete task"
              >
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
          <select
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600 focus:border-violet-400 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending || !newTitle.trim()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-neutral-400 hover:text-neutral-700">
            Cancel
          </button>
        </div>
      )}

      {tasks.length === 0 && !adding && (
        <p className="px-1 text-xs text-neutral-400">No tasks yet. Add one above.</p>
      )}
    </div>
  )
}
