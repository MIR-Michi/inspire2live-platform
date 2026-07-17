import { createClient } from '@/lib/supabase/server'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { loadConferencesData } from '@/lib/comms-conferences'
import { ConferencesShell } from '@/components/comms/conferences/conferences-shell'

// This page depends on the current Supabase session.
// Keep it request-time rendered so Vercel/Next never try to pre-render it.
export const dynamic = 'force-dynamic'

// Detail enrichment runs as a server action invoked from this route; give it
// room beyond the default so a single web-search enrichment can finish.
export const maxDuration = 120

export default async function ConferencesPage() {
  const supabase = await createClient()
  const data = await loadConferencesData(supabase)

  return <ConferencesShell data={data} aiEnabled={isAiEnabled()} />
}
