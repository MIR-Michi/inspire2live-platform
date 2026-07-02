import { redirect } from 'next/navigation'

// Retired in the Sprint 15 cleanup. The generic Events *list* page is gone;
// the events domain and the `[id]` detail view (used by Podcast/Conferences)
// stay. Anyone landing here is sent to the dashboard.
export default function RetiredCommsEventsPage() {
  redirect('/app/dashboard')
}
