'use client'

/**
 * podcast-planning/ui/candidate-stage-controls.tsx — moving a card.
 *
 * The gate is evaluated twice on purpose: here, so a move that will be refused
 * is disabled with its reason visible *before* the click; and again in the
 * server action, because a rule that only exists in a component is not a rule.
 *
 * Both exits ask for what makes them useful — a "not now" needs a wake date or
 * the card never returns, and a close needs a reason, because the reasons are
 * what the whole scoring model eventually learns from.
 */

import { useState, useTransition } from 'react'
import { CLOSED_REASON_META } from '@/modules/podcast-planning/domain/types'
import type {
  CandidateStage,
  ClosedReason,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import { BOARD_STAGES, STAGE_META, canAdvance } from '@/modules/podcast-planning/domain/stages'
import { moveCandidate, overrideRanking, setAnchor } from '@/modules/podcast-planning/domain/actions'

const CLOSED_REASONS = Object.keys(CLOSED_REASON_META) as ClosedReason[]

export function CandidateStageControls({
  candidate,
  question,
  openAskCount,
  config,
}: {
  candidate: QuestionCandidate
  question: PodcastQuestion
  openAskCount: number
  config: PlanningConfig
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [wakeDate, setWakeDate] = useState('')
  const [closedReason, setClosedReason] = useState<ClosedReason>('declined')
  const [closedNote, setClosedNote] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [pending, startTransition] = useTransition()

  const targets = BOARD_STAGES.filter((s) => s !== candidate.stage)

  function move(target: CandidateStage, extra: Parameters<typeof moveCandidate>[2] = {}) {
    startTransition(async () => {
      const result = await moveCandidate(candidate.id, target, extra)
      setMessage(result.ok ? `Moved to ${STAGE_META[target].label}.` : result.error)
    })
  }

  return (
    <div className="space-y-3">
      {message && (
        <p role="status" className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {targets.map((target) => {
          const verdict = canAdvance(candidate, target, {
            question,
            openAskCount,
            config,
          })
          return (
            <button
              key={target}
              type="button"
              disabled={pending || !verdict.allowed}
              title={verdict.allowed ? undefined : verdict.reason}
              onClick={() => move(target)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {STAGE_META[target].label}
            </button>
          )
        })}
      </div>

      {/* Why a move is unavailable, spelled out rather than hidden in a tooltip. */}
      <ul className="space-y-1 text-xs text-amber-900">
        {targets
          .map((target) => ({ target, verdict: canAdvance(candidate, target, { question, openAskCount, config }) }))
          .filter((entry) => !entry.verdict.allowed)
          .slice(0, 2)
          .map(({ target, verdict }) => (
            <li key={target}>
              <span className="font-semibold">{STAGE_META[target].label}:</span>{' '}
              {'reason' in verdict ? verdict.reason : ''}
            </li>
          ))}
      </ul>

      <div className="grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-700">Not now</p>
          <p className="text-xs text-neutral-500">
            Interested but travelling, on deadline, or waiting on a publication. The most common good
            outcome of a first ask — never a loss.
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={wakeDate}
              onChange={(e) => setWakeDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={pending || !wakeDate}
              onClick={() => move('not_now', { wakeDate })}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              Sleep
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-700">Close</p>
          <p className="text-xs text-neutral-500">
            The reason is the point: after twenty of them the routes that actually work become
            visible.
          </p>
          <div className="flex gap-2">
            <select
              value={closedReason}
              onChange={(e) => setClosedReason(e.target.value as ClosedReason)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
            >
              {CLOSED_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {CLOSED_REASON_META[reason]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => move('closed', { closedReason, closedNote: closedNote || null })}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              Close
            </button>
          </div>
          <input
            value={closedNote}
            onChange={(e) => setClosedNote(e.target.value)}
            placeholder="Anything worth remembering (optional)"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        {!candidate.isAnchor && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-neutral-700">Make this the anchor</p>
            <p className="text-xs text-neutral-500">
              The name whose acceptance makes every other invitation on this question easier.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setAnchor(candidate.id)
                  setMessage(result.ok ? 'Anchor set for this question.' : result.error)
                })
              }
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              Set as anchor
            </button>
          </div>
        )}

        {!candidate.overrideAt && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-neutral-700">Push to the top anyway</p>
            <p className="text-xs text-neutral-500">
              The score never overrules a person. Say why, and the decision is recorded rather than
              hidden.
            </p>
            <div className="flex gap-2">
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why this one, regardless of its number"
                className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={pending || !overrideReason.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const result = await overrideRanking(candidate.id, overrideReason)
                    setMessage(result.ok ? 'Override recorded.' : result.error)
                  })
                }
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
              >
                Override
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
