'use client'

import { useState } from 'react'
import { useConferenceRun } from '@/components/comms/use-conference-run'
import type { ConferenceRunStatus } from '@/lib/ai/conference-run'

export function ConferenceDiscoveryControl({ initialStatus }: { initialStatus: ConferenceRunStatus | null }) {
  const run = useConferenceRun(initialStatus)
  const [requested, setRequested] = useState(false)

  const start = () => {
    setRequested(true)
    void run.start()
  }

  const feedback = run.running || run.starting
    ? `Discovery is running… ${run.elapsed}s`
    : run.status === 'error'
      ? run.message ?? 'The discovery run failed.'
      : requested && run.status === 'success'
        ? 'Discovery completed. The conference list has been updated.'
        : null

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-labelledby="manual-discovery-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="manual-discovery-heading" className="text-base font-semibold text-neutral-900">Manual discovery</h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Use this only when an immediate refresh is needed. Normal discovery follows the automatic schedule configured below.
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={run.busy}
          className="inline-flex items-center rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {run.busy ? 'Discovery running…' : 'Run discovery now'}
        </button>
      </div>
      {feedback && (
        <p className={`mt-3 text-sm ${run.status === 'error' ? 'text-red-600' : 'text-neutral-600'}`} role="status">
          {feedback}
        </p>
      )}
    </section>
  )
}
