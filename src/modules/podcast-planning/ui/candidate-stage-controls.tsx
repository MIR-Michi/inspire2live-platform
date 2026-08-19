'use client'

/**
 * podcast-planning/ui/candidate-stage-controls.tsx — moving a card.
 *
 * Re-cut in the 2026-08 UX pass around one idea: **the user should never have
 * to work out the next move**. The pipeline is linear, so there is exactly one
 * forward move at any time — shown as the single primary button, with the
 * gate's reason as the one line of text when it is blocked. Everything else
 * (back, sleep, close, anchor, override) is quiet and folded.
 *
 * The gate is evaluated twice on purpose: here, so a blocked move shows its
 * reason *before* the click; and again in the server action, because a rule
 * that only exists in a component is not a rule.
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
import {
  IconArrowLeft,
  IconArrowRight,
  IconClose,
  IconSleep,
  IconStar,
  STAGE_ICONS,
} from '@/modules/podcast-planning/ui/icons'

const CLOSED_REASONS = Object.keys(CLOSED_REASON_META) as ClosedReason[]

/** The one forward move the pipeline allows from here. */
function forwardStage(stage: CandidateStage): CandidateStage | null {
  if (stage === 'not_now' || stage === 'closed') return 'research'
  const index = BOARD_STAGES.indexOf(stage)
  if (index === -1 || index === BOARD_STAGES.length - 1) return null
  return BOARD_STAGES[index + 1]
}

function backStage(stage: CandidateStage): CandidateStage | null {
  const index = BOARD_STAGES.indexOf(stage)
  if (index <= 0) return null
  return BOARD_STAGES[index - 1]
}

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
  const [expanded, setExpanded] = useState<'sleep' | 'close' | null>(null)
  const [wakeDate, setWakeDate] = useState('')
  const [closedReason, setClosedReason] = useState<ClosedReason>('declined')
  const [closedNote, setClosedNote] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [pending, startTransition] = useTransition()

  function move(target: CandidateStage, extra: Parameters<typeof moveCandidate>[2] = {}) {
    startTransition(async () => {
      const result = await moveCandidate(candidate.id, target, extra)
      setMessage(result.ok ? `Moved to ${STAGE_META[target].label}.` : result.error)
      if (result.ok) setExpanded(null)
    })
  }

  const next = forwardStage(candidate.stage)
  const verdict = next ? canAdvance(candidate, next, { question, openAskCount, config }) : null
  const back = backStage(candidate.stage)
  const NextIcon = next ? STAGE_ICONS[next] : null

  return (
    <div className="space-y-2.5">
      {message && (
        <p role="status" className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800">
          {message}
        </p>
      )}

      {/* The one forward move. */}
      {next && NextIcon && (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={pending || !verdict?.allowed}
            onClick={() => move(next)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            <NextIcon className="h-4 w-4" />
            {STAGE_META[next].label}
            <IconArrowRight className="h-4 w-4" />
          </button>
          {verdict && !verdict.allowed && (
            <p className="text-xs leading-5 text-amber-900">{verdict.reason}</p>
          )}
        </div>
      )}

      {/* The quiet moves. */}
      <div className="flex flex-wrap gap-1.5">
        {back && (
          <button
            type="button"
            disabled={pending}
            onClick={() => move(back)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            {STAGE_META[back].label}
          </button>
        )}
        {candidate.stage !== 'not_now' && candidate.stage !== 'closed' && (
          <button
            type="button"
            onClick={() => setExpanded(expanded === 'sleep' ? null : 'sleep')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-neutral-50 ${
              expanded === 'sleep' ? 'border-neutral-400 text-neutral-900' : 'border-neutral-200 text-neutral-600'
            }`}
          >
            <IconSleep className="h-3.5 w-3.5" />
            Not now
          </button>
        )}
        {candidate.stage !== 'closed' && (
          <button
            type="button"
            onClick={() => setExpanded(expanded === 'close' ? null : 'close')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-neutral-50 ${
              expanded === 'close' ? 'border-neutral-400 text-neutral-900' : 'border-neutral-200 text-neutral-600'
            }`}
          >
            <IconClose className="h-3.5 w-3.5" />
            Close
          </button>
        )}
        {!candidate.isAnchor && (
          <button
            type="button"
            disabled={pending}
            title="Anchor: the yes that makes every other invitation easier"
            onClick={() =>
              startTransition(async () => {
                const result = await setAnchor(candidate.id)
                setMessage(result.ok ? 'Anchor set.' : result.error)
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            <IconStar className="h-3.5 w-3.5" />
            Anchor
          </button>
        )}
      </div>

      {/* Sleep needs a wake date or the card never returns. */}
      {expanded === 'sleep' && (
        <div className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <input
            type="date"
            value={wakeDate}
            onChange={(e) => setWakeDate(e.target.value)}
            aria-label="Wake date"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={pending || !wakeDate}
            onClick={() => move('not_now', { wakeDate })}
            className="shrink-0 rounded-lg bg-neutral-950 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            Sleep
          </button>
        </div>
      )}

      {/* A close records its reason — that is what the scoring model learns from. */}
      {expanded === 'close' && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
          <div className="flex gap-2">
            <select
              value={closedReason}
              onChange={(e) => setClosedReason(e.target.value as ClosedReason)}
              aria-label="Reason"
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
              className="shrink-0 rounded-lg bg-neutral-950 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              Close
            </button>
          </div>
          <input
            value={closedNote}
            onChange={(e) => setClosedNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {/* The score never overrules a person — but the decision is recorded. */}
      {!candidate.overrideAt && (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-400 hover:text-neutral-600">
            Push to the top anyway…
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Why, regardless of the score"
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
        </details>
      )}
    </div>
  )
}
