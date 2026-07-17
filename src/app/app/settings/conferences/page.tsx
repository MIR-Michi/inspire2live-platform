import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePanel } from '@/kernel/settings'
import { findSettingsPanel } from '@/modules/settings-registry'
import { SettingsPanelForm } from '@/components/settings/settings-panel-form'

export const metadata = { title: 'Conference discovery · Platform Settings' }

/**
 * First-class settings destination for the events component's conference
 * discovery configuration. The controls remain manifest-driven: this route only
 * gives the panel a stable, discoverable home in the Platform Settings IA.
 */
export default async function ConferenceSettingsPage() {
  const panel = findSettingsPanel('component:events')
  if (!panel) notFound()

  const supabase = await createClient()
  const fields = await resolvePanel(supabase, panel)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Automation</p>
          <h1 className="text-2xl font-bold text-neutral-900">Conference discovery</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Configure how often Inspire2Live searches for conferences, how far ahead it looks, and how broad each discovery run may be.
          </p>
        </div>
        <Link href="/app/comms/conferences" className="text-sm font-semibold text-orange-700 hover:underline">
          Open conferences →
        </Link>
      </div>

      <SettingsPanelForm
        panelId={panel.id}
        title="Discovery rules"
        description="These values are read by the scheduled conference-discovery job. Changes apply to the next run without a redeploy."
        fields={fields}
      />
    </div>
  )
}
