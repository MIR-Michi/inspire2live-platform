import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPostLoginLandingPath } from '@/lib/comms-access'

/**
 * Root entry point.
 *
 * The platform is invitation-only and has no public marketing surface, so the
 * first screen is the login screen. Users who already have a session are sent
 * straight to their dashboard instead.
 */
export default async function Home() {
  // Without Supabase credentials (e.g. CI without secrets) there is no way to
  // resolve a session — fall back to the login screen.
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
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  // Invited users who have not finished onboarding continue that flow first.
  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding')
  }

  redirect(getPostLoginLandingPath(profile?.role))
}
