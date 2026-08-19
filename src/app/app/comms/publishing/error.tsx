'use client'

/**
 * Error boundary for the Publishing space (AGENTS.md §6: an `error.tsx` next
 * to every DB-querying page). Drafting and handover are separate writes, so a
 * render failure here never means a half-published post.
 */
export default function PublishingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <h1 className="text-lg font-semibold">The Publishing space could not be loaded</h1>
      <p className="mt-1 text-sm">Nothing was changed — no draft was approved and nothing was handed over.</p>
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
