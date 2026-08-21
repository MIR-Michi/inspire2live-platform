'use client'

/**
 * podcast-planning/ui/verify-ask-button.tsx — "I opened it, it works".
 *
 * `verifyAskDestination` is deliberately a human action rather than a fetch:
 * an ask pointing at a page that returns 200 but asks for the wrong thing
 * wastes the whole episode, and only a person can tell the difference. It is
 * worth five points of follow-up score, which is why it has to be pressed
 * rather than inferred.
 *
 * Existed since Phase A with no caller, so every question wore "Unchecked"
 * permanently and those five points were unreachable.
 */

import { useTransition } from 'react'
import { verifyAskDestination } from '@/modules/podcast-planning/domain/actions'

export function VerifyAskButton({ questionId }: { questionId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await verifyAskDestination(questionId)))}
      title="Confirm you opened this link and it does what the ask says"
      className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
    >
      {pending ? 'Checking…' : 'Unchecked — verify'}
    </button>
  )
}
