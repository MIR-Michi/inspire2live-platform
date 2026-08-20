'use client'

/**
 * podcast-planning/ui/find-names-button.tsx — the board's missing front door.
 *
 * Phase A shipped with `addCandidate` implemented, exported and called by
 * nothing: there was no way to put a name on a question at all. This is that
 * entry point, and it is assisted from the start.
 *
 * The wait is real — an API call and a model call, ten to thirty seconds — so
 * the button says what it is doing rather than spinning. A progress line that
 * names the step is the difference between "it is working" and "it has hung",
 * and it is the cheapest possible version of that.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { findNamesForQuestion } from '@/modules/podcast-planning/domain/radar-actions'
import { IconResearch } from '@/modules/podcast-planning/ui/icons'

/**
 * Narration for a wait we cannot measure. The server action is one round trip,
 * so there is no real progress to report — but the steps are honest about what
 * is happening in what order, and each one is true for roughly as long as it is
 * shown.
 */
const STEPS = [
  'Reading recent papers…',
  'Collecting the authors…',
  'Working out who could answer this…',
]

export function FindNamesButton({
  questionId,
  label = 'Suggest guests',
  className,
}: {
  questionId: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // The timer only ever advances the step; it is started and stopped by the
  // transition, and reset by the click that opened it.
  useEffect(() => {
    if (!pending) {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      return
    }
    timer.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [pending])

  const run = () =>
    startTransition(async () => {
      setStep(0)
      setMessage(null)
      setFailed(false)
      const result = await findNamesForQuestion(questionId)
      if (!result.ok) {
        setFailed(true)
        setMessage(result.error)
        return
      }
      setMessage(result.data?.message ?? null)
      // A proposal was written; the screen showing it has to re-read.
      if (result.data?.proposalId) router.refresh()
    })

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-3'}>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
      >
        <IconResearch className="h-4 w-4" />
        {pending ? STEPS[step] : label}
      </button>
      {message && (
        <p
          role="status"
          className={`text-xs ${failed ? 'text-red-700' : 'text-neutral-600'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
