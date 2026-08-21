'use client'

/**
 * podcast-planning/ui/question-editor.tsx — writing and rewriting a question.
 *
 * Concept §2: a question is not opened until four things are written down.
 * Since the 2026-08 UX pass the form teaches by example (the placeholders show
 * what a good answer looks like) rather than by explanation — the readiness
 * chips on the Questions screen show what is still missing, so the form does
 * not have to argue for its own fields.
 *
 * One component for both jobs. `updateQuestion`, `retireQuestion` and
 * `verifyAskDestination` shipped in Phase A implemented, exported, declared in
 * the manifest — and called by nothing, so a typo in a question was permanent
 * and topic tags could not be set at all. Tags are the sharpest of those: they
 * replace the question's own words in the guest search, which is the difference
 * between searching for `cancer car-t brazil` and searching for `cancer make`.
 */

import { useState, useTransition } from 'react'
import { ASK_META, FORMAT_META } from '@/modules/podcast-planning/domain/types'
import type {
  AskType,
  EpisodeFormat,
  PodcastQuestion,
  QuestionStatus,
} from '@/modules/podcast-planning/domain/types'
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from '@/modules/podcast-planning/domain/actions'

const FORMATS = Object.keys(FORMAT_META) as EpisodeFormat[]
const ASKS = Object.keys(ASK_META) as AskType[]

const FIELD = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm'
const LABEL = 'text-sm font-semibold text-neutral-800'

/** A tag list is typed as prose and stored as an array. */
function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
}

function Number0To({ value, onChange, max, label, hint }: {
  value: number
  onChange: (n: number) => void
  max: number
  label: string
  hint: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className={FIELD}
      />
      <span className="text-[11px] text-neutral-400">{hint} 0–{max}.</span>
    </label>
  )
}

export function QuestionEditor({
  owners,
  question,
  totalCards = 0,
}: {
  owners: Array<{ id: string; label: string }>
  /** Absent for a new question; present to edit an existing one. */
  question?: PodcastQuestion
  /** Cards that a delete would take with it. Named in the confirmation. */
  totalCards?: number
}) {
  const editing = question !== undefined

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const [text, setText] = useState(question?.question ?? '')
  const [whyNow, setWhyNow] = useState(question?.whyNow ?? '')
  const [whyNowAt, setWhyNowAt] = useState(question?.whyNowAt ?? '')
  const [tags, setTags] = useState((question?.topicTags ?? []).join(', '))
  const [askType, setAskType] = useState<AskType | ''>(question?.askType ?? '')
  const [askUrl, setAskUrl] = useState(question?.askDestinationUrl ?? '')
  const [format, setFormat] = useState<EpisodeFormat | ''>(question?.format ?? '')
  const [ownerId, setOwnerId] = useState(question?.ownerId ?? '')
  const [status, setStatus] = useState<QuestionStatus>(question?.status ?? 'draft')

  const [showScoring, setShowScoring] = useState(false)
  const [anchorDate, setAnchorDate] = useState(question?.anchorDate ?? '')
  const [patientRelevance, setPatientRelevance] = useState(question?.patientRelevance ?? 'field')
  const [onAgenda, setOnAgenda] = useState(question?.onAdvocacyAgenda ?? false)
  const [questionPull, setQuestionPull] = useState(question?.questionPull ?? 0)
  const [askConversionPrior, setAskConversionPrior] = useState(question?.askConversionPrior ?? 0)
  const [amplification, setAmplification] = useState(question?.amplification ?? 0)

  function close() {
    setOpen(false)
    setError(null)
    setConfirmingDelete(false)
  }

  function submit() {
    startTransition(async () => {
      const input = {
        question: text,
        whyNow: whyNow || null,
        whyNowAt: whyNowAt || null,
        topicTags: parseTags(tags),
        askType: (askType || null) as AskType | null,
        askDestinationUrl: askUrl || null,
        format: (format || null) as EpisodeFormat | null,
        anchorDate: anchorDate || null,
        patientRelevance,
        onAdvocacyAgenda: onAgenda,
        questionPull,
        askConversionPrior,
        amplification,
        ownerId: ownerId || null,
        status,
      }

      const result = question
        ? await updateQuestion(question.id, input)
        : await createQuestion(input)
      if (!result.ok) {
        setError(result.error)
        return
      }

      close()
      if (!question) {
        setText('')
        setWhyNow('')
        setWhyNowAt('')
        setTags('')
        setAskType('')
        setAskUrl('')
        setFormat('')
      }
    })
  }

  function remove() {
    startTransition(async () => {
      if (!question) return
      const result = await deleteQuestion(question.id, { confirmCards: true })
      if (!result.ok) {
        setError(result.error)
        setConfirmingDelete(false)
        return
      }
      close()
    })
  }

  if (!open) {
    return editing ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        Edit
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        + New question
      </button>
    )
  }

  return (
    <section className="w-full space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <label className="block space-y-1">
        <span className={LABEL}>The question</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="One sentence somebody could disagree with — “Why is a proven diagnostic still unreimbursed three years after parliament heard the case?”"
          className={FIELD}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block space-y-1">
          <span className={LABEL}>Why now</span>
          <input
            value={whyNow}
            onChange={(e) => setWhyNow(e.target.value)}
            placeholder="A ruling, an approval, a congress, a consultation deadline, a public row"
            className={FIELD}
          />
        </label>
        <label className="block space-y-1">
          <span className={LABEL}>When it happened</span>
          <input
            type="date"
            value={whyNowAt}
            onChange={(e) => setWhyNowAt(e.target.value)}
            className={FIELD}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className={LABEL}>Topics</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="car-t, access, brazil"
          className={FIELD}
        />
        <span className="text-xs text-neutral-500">
          Comma separated. These are what “Suggest guests” searches for, and they replace the
          question’s own wording — so name the subject, not the argument.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={LABEL}>Listener action</span>
          <select
            value={askType}
            onChange={(e) => setAskType(e.target.value as AskType | '')}
            className={FIELD}
          >
            <option value="">What should a listener do…</option>
            {ASKS.map((a) => (
              <option key={a} value={a}>
                {ASK_META[a].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className={LABEL}>Where it points</span>
          <input
            value={askUrl}
            onChange={(e) => setAskUrl(e.target.value)}
            placeholder={askType ? ASK_META[askType].pointsAt : 'https://…'}
            className={FIELD}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className={LABEL}>Format</span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as EpisodeFormat | '')}
          className={FIELD}
        >
          <option value="">Choose a format…</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_META[f].label} — {FORMAT_META[f].bestFor}
            </option>
          ))}
        </select>
        {format && FORMAT_META[format].guestSeats > 1 && (
          <span className="text-xs text-amber-800">Needs {FORMAT_META[format].guestSeats} guests booked.</span>
        )}
      </label>

      {/* Folded away by default: these move the score, but none of them is part
          of the readiness gate, and putting six numbers in front of somebody
          writing their first question is how the first question never gets
          written. */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
        <button
          type="button"
          onClick={() => setShowScoring((s) => !s)}
          className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
        >
          {showScoring ? '− ' : '+ '}What this is worth
        </button>

        {showScoring && (
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Fixed date it hangs on</span>
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className={FIELD}
                />
                <span className="text-[11px] text-neutral-400">
                  A congress, a deadline, a vote. Worth six points while it is still ahead.
                </span>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Who it matters to</span>
                <select
                  value={patientRelevance}
                  onChange={(e) => setPatientRelevance(e.target.value as 'patients' | 'both' | 'field')}
                  className={FIELD}
                >
                  <option value="patients">Patients</option>
                  <option value="both">Patients and the field</option>
                  <option value="field">The field</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Number0To
                label="Pull of the question"
                hint="How comparable content performed."
                max={7}
                value={questionPull}
                onChange={setQuestionPull}
              />
              <Number0To
                label="How the ask converts"
                hint="Measured on past episodes."
                max={5}
                value={askConversionPrior}
                onChange={setAskConversionPrior}
              />
              <Number0To
                label="Who else will push it"
                hint="Hubs, partners, contributors."
                max={5}
                value={amplification}
                onChange={setAmplification}
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={onAgenda}
                onChange={(e) => setOnAgenda(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              On the advocacy agenda
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Owner</span>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuestionStatus)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              {editing && <option value="retired">Retired</option>}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {editing &&
            (confirmingDelete ? (
              <span className="flex items-center gap-2 text-xs text-red-800">
                {totalCards > 0
                  ? `Delete this and its ${totalCards} card${totalCards === 1 ? '' : 's'}?`
                  : 'Delete this question?'}
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mr-auto text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
              >
                Delete
              </button>
            ))}
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !text.trim()}
            className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {editing ? 'Save changes' : 'Save question'}
          </button>
        </div>
      </div>
    </section>
  )
}
