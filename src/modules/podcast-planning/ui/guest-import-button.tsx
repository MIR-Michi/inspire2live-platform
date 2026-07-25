'use client'

/**
 * podcast-planning/ui/guest-import-button.tsx — moving the old roster across.
 *
 * The Guests tab is gone; its data is not (concept §1). The import is safe to
 * run repeatedly — matching is by name, so a second run creates nothing — which
 * is why it is a button rather than a one-shot script: episodes keep being
 * recorded while the planner is in use.
 */

import { useState, useTransition } from 'react'
import { importPastGuests } from '@/modules/podcast-planning/domain/actions'

export function GuestImportButton() {
  const [result, setResult] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {result && <p className="text-xs text-neutral-600">{result}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await importPastGuests()
            setResult(
              outcome.ok
                ? `${outcome.data?.found ?? 0} past guest${(outcome.data?.found ?? 0) === 1 ? '' : 's'} found, ${outcome.data?.created ?? 0} added. Re-running changes nothing.`
                : outcome.error,
            )
          })
        }
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? 'Importing…' : 'Import past guests'}
      </button>
    </div>
  )
}
