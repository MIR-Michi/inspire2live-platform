'use client'

export default function ConferenceSettingsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <h1 className="text-lg font-semibold">Conference settings could not be loaded</h1>
      <p className="mt-1 text-sm">The settings store could not be read. No configuration was changed.</p>
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
