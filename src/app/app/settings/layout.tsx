import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'
import { SettingsShell } from '@/components/layouts/settings-shell'

/**
 * The Platform Settings space (ADR-0010). Gated to PlatformAdmin (defence in
 * depth on top of the middleware `settings → admin` alias) and wrapped in the
 * shared settings shell so the new `/app/settings/*` panels sit in the same
 * section sub-nav as the migrated `/app/admin/*` pages.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/app/dashboard')

  return <SettingsShell>{children}</SettingsShell>
}
