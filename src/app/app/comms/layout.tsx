import { redirect } from 'next/navigation'
import { InitiativeTabs } from '@/components/initiatives/initiative-tabs'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'

const tabs = [
  { label: 'Intake', href: '/app/comms/intake' },
  { label: 'Calendar', href: '/app/comms/calendar' },
  { label: 'Events', href: '/app/comms/events' },
  { label: 'Campus Log', href: '/app/comms/campus-log' },
  { label: 'Media', href: '/app/comms/media' },
]

export default async function CommsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed, comms_team')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  if (!canAccessCommsWorkspace(profile?.role, profile?.comms_team)) {
    redirect('/app/dashboard')
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Communications Workspace
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-neutral-900">Communications</h1>
            <p className="max-w-3xl text-sm text-neutral-600">
              The Sprint 01 shell gives the communications team a dedicated workspace with five
              destinations: intake, calendar, events, campus log, and media.
            </p>
          </div>
        </div>

        <InitiativeTabs tabs={tabs} />
      </section>

      {children}
    </div>
  )
}
