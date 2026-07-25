'use client'

/**
 * podcast-planning/ui/question-composer.tsx — defining a question.
 *
 * Concept §2: "A question is not opened until four things are written down. This
 * takes about twenty minutes and it determines everything downstream."
 *
 * The form is written to slow that down rather than speed it up: each field
 * carries the reason it exists, and the listener action is asked for *before*
 * any name is on the page, because deciding it first shapes how the episode is
 * framed.
 */

import { useState, useTransition } from 'react'
import { ASK_META, FORMAT_META } from '@/modules/podcast-planning/domain/types'
import type { AskType, EpisodeFormat } from '@/modules/podcast-planning/domain/types'
import { createQuestion } from '@/modules/podcast-planning/domain/actions'

const FORMATS = Object.keys(FORMAT_META) as EpisodeFormat[]
const ASKS = Object.keys(ASK_META) as AskType[]

export function QuestionComposer({ owners }: { owners: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [question, setQuestion] = useState('')
  const [whyNow, setWhyNow] = useState('')
  const [whyNowAt, setWhyNowAt] = useState('')
  const [askType, setAskType] = useState<AskType | ''>('')
  const [askUrl, setAskUrl] = useState('')
  const [format, setFormat] = useState<EpisodeFormat | ''>('')
  const [ownerId, setOwnerId] = useState('')
  const [status, setStatus] = useState<'draft' | 'live'>('draft')

  function submit() {
    startTransition(async () => {
      const result = await createQuestion({
        question,
        whyNow: whyNow || null,
        whyNowAt: whyNowAt || null,
        askType: (askType || null) as AskType | null,
        askDestinationUrl: askUrl || null,
        format: (format || null) as EpisodeFormat | null,
        ownerId: ownerId || null,
        status,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setOpen(false)
      setQuestion('')
      setWhyNow('')
      setWhyNowAt('')
      setAskType('')
      setAskUrl('')
      setFormat('')
    })
  }

  if (!open) {
    return (
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
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-neutral-800">The question</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Why is a proven diagnostic still unreimbursed three years after parliament heard the case?"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-neutral-500">
          One sentence somebody could disagree with. Subject areas do not travel and do not persuade
          anyone to give up an hour; arguable questions do both.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-neutral-800">Why now</span>
          <input
            value={whyNow}
            onChange={(e) => setWhyNow(e.target.value)}
            placeholder="A ruling, an approval, a congress, a consultation deadline, a public row"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-neutral-500">
            Timeliness is the biggest single reason people accept, and the biggest driver of listens.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-neutral-800">When it happened</span>
          <input
            type="date"
            value={whyNowAt}
            onChange={(e) => setWhyNowAt(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-neutral-500">Undated reasons decay immediately.</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-neutral-800">The ask</span>
          <select
            value={askType}
            onChange={(e) => setAskType(e.target.value as AskType | '')}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">Choose what a listener should do…</option>
            {ASKS.map((a) => (
              <option key={a} value={a}>
                {ASK_META[a].label}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Decided now, before any name is researched — follow-up traffic does not happen by
            accident, and this shapes how the episode is framed.
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-neutral-800">Where it points</span>
          <input
            value={askUrl}
            onChange={(e) => setAskUrl(e.target.value)}
            placeholder={askType ? ASK_META[askType].pointsAt : 'https://…'}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-neutral-500">
            You will be asked to confirm the page actually works before it earns any points.
          </span>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-neutral-800">The shape</span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as EpisodeFormat | '')}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="">Choose a format…</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_META[f].label} — {FORMAT_META[f].bestFor}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          {format
            ? `${FORMAT_META[format].shape} ${FORMAT_META[format].guestSeats > 1 ? 'Two guests must be secured before the card can be booked.' : ''}`
            : 'A question that fits no format is either reframed or dropped.'}
        </span>
      </label>

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
              onChange={(e) => setStatus(e.target.value as 'draft' | 'live')}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !question.trim()}
            className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Save question
          </button>
        </div>
      </div>
    </section>
  )
}
