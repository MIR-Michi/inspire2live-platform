'use client'

/**
 * App-segment error boundary. Catches unhandled exceptions anywhere under /app
 * (server-component throws surface here as a client error in production) and
 * shows a recoverable UI instead of the bare white "Application error" screen.
 *
 * The most common cause in practice is a stale JS chunk: after a redeploy, a
 * tab opened on the previous build tries to load a chunk hash that no longer
 * exists ("ChunkLoadError" / "Failed to fetch dynamically imported module").
 * For that case we force a one-time hard reload to pull the fresh assets.
 */

import { useEffect } from 'react'

function isChunkLoadError(error: Error): boolean {
  const text = `${error.name} ${error.message}`.toLowerCase()
  return (
    text.includes('chunkloaderror') ||
    text.includes('loading chunk') ||
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('importing a module script failed')
  )
}

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] caught error:', error)

    // A stale-chunk error means the running tab is from an old deploy. Reload
    // once (guarded by sessionStorage) to fetch the current assets.
    if (isChunkLoadError(error)) {
      const KEY = 'app-chunk-reload'
      if (typeof window !== 'undefined' && !sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
      }
    }
  }, [error])

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <p className="text-3xl">⚠️</p>
        <h1 className="mt-2 text-lg font-semibold text-neutral-900">Something went wrong on this page</h1>
        <p className="mt-1 text-sm text-neutral-500">
          This is usually temporary — often a new version was just deployed. Reloading fixes it in most cases.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-neutral-400">Ref: {error.digest}</p>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
