import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { componentManifests } from '@/modules/registry'
import { componentPanel, resolvePanel } from '@/kernel/settings'
import { SettingsPanelForm } from '@/components/settings/settings-panel-form'

/**
 * Per-component config — the reference COMPONENT settings panel (ADR-0010 §5).
 * Rendered entirely from the component manifest's typed `config` fields: adding a
 * `ConfigField` to a manifest surfaces a control here with no page changes.
 */
export default async function ComponentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const manifest = componentManifests.find((m) => m.id === id)
  const panel = manifest ? componentPanel(manifest) : null

  if (!manifest || !panel) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-neutral-900">Component settings</h1>
        <p className="text-sm text-neutral-500">
          {manifest
            ? `“${manifest.title}” does not expose any configurable settings.`
            : `No component with id “${id}”.`}
        </p>
        <Link href="/app/settings/capabilities" className="text-sm text-orange-600 hover:underline">
          ← Back to Modules
        </Link>
      </div>
    )
  }

  const supabase = await createClient()
  const fields = await resolvePanel(supabase, panel)

  return (
    <div className="space-y-4">
      <Link href="/app/settings/capabilities" className="text-sm text-neutral-500 hover:text-neutral-700">
        ← Modules
      </Link>
      <SettingsPanelForm
        panelId={panel.id}
        title={panel.title}
        description={panel.description}
        fields={fields}
      />
    </div>
  )
}
