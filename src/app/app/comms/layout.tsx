import { redirect } from 'next/navigation'
import { InitiativeTabs } from '@/components/initiatives/initiative-tabs'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { NewItemModal } from '@/components/comms/new-item-modal'
import { applyCanonicalCommsFallback } from '@/lib/user-workspace'

const tabs = [
  { label: 'Planner', href: '/app/comms/planner' },
  { label: 'Campus', href: '/app/comms/campus' },
  { label: 'Events', href: '/app/comms/events' },
  { label: 'Library', href: '/app/comms/library' },
  { label: 'Intake', href: '/app/comms/intake' },
]

export default async function CommsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileWithUserType, error: profileWithUserTypeError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()
  let profile = profileWithUserType

  if (profileWithUserTypeError) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed, comms_team')
      .eq('id', user.id)
      .maybeSingle()
    profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
  }

  profile = applyCanonicalCommsFallback(profile, user.email)

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  if (!canAccessCommsWorkspace(profile?.role, profile?.comms_team, profile?.user_type)) {
    redirect('/app/dashboard')
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
            Communications Workspace
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-neutral-900">Communications</h1>
              <p className="max-w-3xl text-sm text-neutral-600">
                The communications workspace now keeps planning, campus signals, events, and library
                material in focused routes while preserving the existing intake and provider-safe flows.
              </p>
            </div>
            <NewItemModal />
          </div>
        </div>

        <InitiativeTabs tabs={tabs} />
      </section>

      {children}
    </div>
  )
}
