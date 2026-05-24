import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { applyCanonicalCommsFallback } from '@/lib/user-workspace'

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

  return children
}
