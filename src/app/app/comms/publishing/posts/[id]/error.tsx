'use client'

/**
 * Error boundary for one saved post (AGENTS.md §6: an `error.tsx` next to every
 * DB-querying page). Every edit here is its own write, so a render failure
 * never leaves a post half-saved.
 */
export default function PublishingPostError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <h1 className="text-lg font-semibold">This post could not be loaded</h1>
      <p className="mt-1 text-sm">Nothing was changed — the post is exactly as you left it.</p>
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
