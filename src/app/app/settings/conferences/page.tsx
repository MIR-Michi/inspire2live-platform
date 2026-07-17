import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConferenceRunStatus, type ConferenceRunStatus } from '@/lib/ai/conference-run'
import { resolvePanel } from '@/kernel/settings'
import { findSettingsPanel } from '@/modules/settings-registry'
import { SettingsPanelForm } from '@/components/settings/settings-panel-form'
import { ConferenceDiscoveryControl } from '@/modules/events/ui/conferences/conference-discovery-control'

export const metadata = { title: 'Conference discovery · Platform Settings' }
export const dynamic = 'force-dynamic'

/**
 * First-class settings destination for the events component's conference
 * discovery configuration. The controls remain manifest-driven: this route only
 * gives the panel a stable, discoverable home in the Platform Settings IA.
 */
export default async function ConferenceSettingsPage() {
  const panel = findSettingsPanel('component:events')
  if (!panel) notFound()

  const supabase = await createClient()
  const [fields, initialStatus] = await Promise.all([
    resolvePanel(supabase, panel),
    getConferenceRunStatus(createAdminClient()).catch((error): ConferenceRunStatus | null => {
      console.error('[conference settings] discovery status load failed', error)
      return null
    }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Automation</p>
        <Link href="/app/comms/conferences" className="text-sm font-semibold text-orange-700 hover:underline">
          Open conferences →
        </Link>
      </div>

      <SettingsPanelForm
        panelId={panel.id}
        title="Conference discovery"
        description="Configure how often Inspire2Live searches for conferences, how far ahead it looks, and how broad each discovery run may be. Changes apply to the next run without a redeploy."
        fields={fields}
      />

      <ConferenceDiscoveryControl initialStatus={initialStatus} />
    </div>
  )
}
