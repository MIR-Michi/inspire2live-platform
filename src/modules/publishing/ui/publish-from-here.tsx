/**
 * publishing/ui/publish-from-here.tsx — the entry point mounted where the
 * material lives (concept §5.4). A link that deep-links into the Publishing
 * space with the source pre-selected — it skips step one, it is not a second
 * implementation of the flow.
 */

import Link from 'next/link'

export function PublishFromHere({
  sourceType,
  sourceId,
  compact = false,
}: {
  sourceType: string
  sourceId: string
  /** Icon-sized variant for dense surfaces (e.g. the campus month workspace). */
  compact?: boolean
}) {
  const href = `/app/comms/publishing?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`
  const glyph = (
    <svg
      className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )

  if (compact) {
    return (
      <Link
        href={href}
        title="Publish"
        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:border-orange-300 hover:text-orange-700"
      >
        {glyph}
        Publish
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
    >
      {glyph}
      Publish
    </Link>
  )
}
