import { PageSkeleton } from '@/components/ui/page-skeleton'

export default function CongressLoading() {
  return <PageSkeleton cards={3} maxWidth="max-w-6xl" />
}
