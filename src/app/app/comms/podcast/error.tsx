'use client'

/**
 * Error boundary for the podcast page (AGENTS.md §6: an `error.tsx` next to every
 * DB-querying page). The planner reads two components' tables plus the settings
 * store, so a failure here must not take the whole Comms workspace down.
 */
export default function PodcastError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <h1 className="text-lg font-semibold">The podcast workspace could not be loaded</h1>
      <p className="mt-1 text-sm">
        Nothing was changed — no card was moved and no invitation was sent.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
      >
        Try again
      </button>
    </div>
  )
}
