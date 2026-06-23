'use client'

import { useRef, useTransition } from 'react'
import { transitionEventStage } from '@/app/app/comms/events/actions'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'

/**
 * Inline stage editor — changing the dropdown immediately persists the new
 * stage (no separate "Move" button), matching the lightweight inline-edit
 * feel of the pipeline and agenda views.
 */
export function EventStageSelect({ eventId, stage }: { eventId: string; stage: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form ref={formRef} action={transitionEventStage}>
      <input type="hidden" name="event_id" value={eventId} />
      <select
        name="next_stage"
        defaultValue={stage}
        disabled={pending}
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-60"
      >
        {(Object.keys(EVENT_STAGE_META) as EventStage[]).map((s) => (
          <option key={s} value={s}>
            {EVENT_STAGE_META[s].label}
          </option>
        ))}
      </select>
    </form>
  )
}
