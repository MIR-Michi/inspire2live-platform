/**
 * Route-level loading skeletons used by `loading.tsx` files.
 *
 * The app shell (top nav + side nav) is rendered by the persistent layout and
 * stays put during navigation; only the page content swaps. These skeletons
 * fill that content area instantly while the destination page's server data
 * loads, so moving between spaces feels immediate instead of blank/janky.
 */

import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>
  )
}

/** Generic content skeleton: header + a stack of cards. Covers most pages. */
export function PageSkeleton({ cards = 3, maxWidth = 'max-w-5xl' }: { cards?: number; maxWidth?: string }) {
  return (
    <div className={`mx-auto ${maxWidth} space-y-6`} role="status" aria-label="Loading page">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** Dashboard-style skeleton: a row of stat tiles + two content columns. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" role="status" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

/** List/table-style skeleton: header + a stack of rows. */
export function ListSkeleton({ rows = 8, maxWidth = 'max-w-5xl' }: { rows?: number; maxWidth?: string }) {
  return (
    <div className={`mx-auto ${maxWidth} space-y-6`} role="status" aria-label="Loading list">
      <PageHeaderSkeleton />
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
