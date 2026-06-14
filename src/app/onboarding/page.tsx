import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Tables } from '@/types/database'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

type ProfileRow = Tables<'profiles'>

export default async function OnboardingPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/login')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, country, city, organization, timezone, language, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (profile?.onboarding_completed) {
    redirect('/app/dashboard')
  }

  return <OnboardingWizard userId={user.id} initialProfile={profile} />
}
