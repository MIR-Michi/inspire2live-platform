import { PageSkeleton } from '@/components/ui/page-skeleton'

// Comms pages (dashboard, planner, CRM, campus, …) are data-heavy; show a card
// skeleton as soon as the user enters the comms space.
export default function CommsLoading() {
  return <PageSkeleton cards={4} />
}
