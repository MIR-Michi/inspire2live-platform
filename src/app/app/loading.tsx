import { PageSkeleton } from '@/components/ui/page-skeleton'

// Shown instantly in the content area on any /app navigation that doesn't have
// a closer loading.tsx, while the destination page's server data loads.
export default function AppLoading() {
  return <PageSkeleton />
}
