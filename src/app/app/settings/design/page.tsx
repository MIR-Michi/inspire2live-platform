import { createClient } from '@/lib/supabase/server'
import { designSystemPanel, resolvePanel } from '@/kernel/settings'
import { DesignComponentLibraryPanel } from '@/components/settings/design-component-library-panel'

export const metadata = { title: 'Design & Component Library · Platform Settings' }

export default async function DesignSettingsPage() {
  const supabase = await createClient()
  const fields = await resolvePanel(supabase, designSystemPanel)

  return (
    <DesignComponentLibraryPanel
      panelId={designSystemPanel.id}
      title={designSystemPanel.title}
      description={designSystemPanel.description}
      fields={fields}
    />
  )
}
