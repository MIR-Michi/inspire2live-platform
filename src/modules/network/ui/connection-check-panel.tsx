'use client'

/**
 * network/ui/connection-check-panel.tsx — answering the five-second question.
 *
 * Concept §8. Five answers, all equal in weight on screen. "I would rather not
 * ask" sits alongside the others rather than under a "more" link, and nothing in
 * the interface treats it — or a plain "no" — as a failure. Somebody's
 * relationships are theirs to spend.
 */

import { useState, useTransition } from 'react'
import { CHECK_ANSWER_META } from '@/modules/network/domain/types'
import type { ConnectionCheck, ConnectionCheckAnswer } from '@/modules/network/domain/types'
import { answerConnectionCheck } from '@/modules/network/domain/actions'

const ANSWERS = Object.keys(CHECK_ANSWER_META) as ConnectionCheckAnswer[]

export function ConnectionCheckPanel({
  checks,
  personNames,
}: {
  checks: ConnectionCheck[]
  /** personId → display name, resolved by the caller. */
  personNames: Record<string, string>
}) {
  const [open, setOpen] = useState(checks)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function answer(check: ConnectionCheck, value: ConnectionCheckAnswer) {
    startTransition(async () => {
      const result = await answerConnectionCheck(
        check.id,
        value,
        value === 'knows_someone' ? note || null : null,
      )
      if (result.ok) {
        setOpen((prev) => prev.filter((c) => c.id !== check.id))
        setNote('')
      }
    })
  }

  if (open.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
        Nothing to answer. You will only ever be asked whether you know somebody — never for their
        details.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {open.map((check) => (
        <li key={check.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-neutral-700">
            {check.contextNote ? `${check.contextNote} ` : ''}
            Do you know{' '}
            <span className="font-semibold text-neutral-900">
              {personNames[check.personId] ?? 'this person'}
            </span>
            ?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {ANSWERS.map((value) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => answer(check, value)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                {CHECK_ANSWER_META[value].label}
              </button>
            ))}
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-xs text-neutral-500">
              If you know somebody who does, who? (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <p className="mt-2 text-xs text-neutral-500">
            This costs you five seconds and commits you to nothing. Nobody is contacted as a result
            of your answer — if an introduction would help, you will be asked separately, and you can
            say no.
          </p>
        </li>
      ))}
    </ul>
  )
}
