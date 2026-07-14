import { createClient } from '@/lib/supabase/server'
import { organizationPanel, resolvePanel } from '@/kernel/settings'
import { SettingsPanelForm } from '@/components/settings/settings-panel-form'

export const metadata = { title: 'Organization · Platform Settings' }

/**
 * Organization / Brand — the reference KERNEL settings panel (ADR-0010 §5). It
 * renders entirely from `organizationPanel`'s declared fields via the shared
 * field renderer; there is no bespoke form here. Values resolve default → DB and
 * persist to `platform_settings`.
 */
export default async function OrganizationSettingsPage() {
  const supabase = await createClient()
  const fields = await resolvePanel(supabase, organizationPanel)

  return (
    <SettingsPanelForm
      panelId={organizationPanel.id}
      title={organizationPanel.title}
      description={organizationPanel.description}
      fields={fields}
    />
  )
}
