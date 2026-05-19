import { StatusBadge } from '@/components/ui/status-badge'

export function FounderBadge({ label = 'Founder signal' }: { label?: string }) {
  return <StatusBadge label={`★ ${label}`} tone="amber" />
}
