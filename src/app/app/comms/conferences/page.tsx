import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { loadConferencesData } from '@/lib/comms-conferences'
import { getConferenceRunStatus, type ConferenceRunStatus } from '@/lib/ai/conference-run'
import { isPlatformAdmin } from '@/lib/platform-roles'
import { ConferencesShell } from '@/components/comms/conferences/conferences-shell'

// This page depends on the current Supabase session and shared run status.
// Keep it request-time rendered so Vercel/Next never try to pre-render it.
export const dynamic = 'force-dynamic'

// Detail enrichment runs as a server action invoked from this route; give it
// room beyond the default so a single web-search enrichment can finish.
export const maxDuration = 120

export default async function ConferencesPage() {
  const supabase = await createClient()

  const [data, profileResult] = await Promise.all([
    loadConferencesData(supabase),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      return profile
    }),
  ])

  // org-wide singleton run status, readable by the comms team.
  let status: ConferenceRunStatus | null = null
  try {
    status = await getConferenceRunStatus(createAdminClient())
  } catch (error) {
    console.error('[conferences page] run status load failed', error)
  }

  const canRefreshCache = isPlatformAdmin(profileResult?.role)

  return <ConferencesShell data={data} initialStatus={status} aiEnabled={isAiEnabled()} canRefreshCache={canRefreshCache} />
}
