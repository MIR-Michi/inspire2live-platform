import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { loadConferencesData } from '@/lib/comms-conferences'
import { getConferenceRunStatus, type ConferenceRunStatus } from '@/lib/ai/conference-run'
import { ConferencesShell } from '@/components/comms/conferences/conferences-shell'

// Detail enrichment runs as a server action invoked from this route; give it
// room beyond the default so a single web-search enrichment can finish.
export const maxDuration = 120

export default async function ConferencesPage() {
  const supabase = await createClient()

  const data = await loadConferencesData(supabase)

  // org-wide singleton run status, readable by the comms team.
  let status: ConferenceRunStatus | null = null
  try {
    status = await getConferenceRunStatus(createAdminClient())
  } catch (error) {
    console.error('[conferences page] run status load failed', error)
  }

  return <ConferencesShell data={data} initialStatus={status} aiEnabled={isAiEnabled()} />
}
