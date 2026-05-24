import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPostLoginLandingPath } from '@/lib/comms-access'
import { applyCanonicalCommsFallback } from '@/lib/user-workspace'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const requestedNext = url.searchParams.get('next') ?? '/app/dashboard'
  const next = requestedNext.startsWith('/') ? requestedNext : '/app/dashboard'
  const isResetFlow = next === '/reset-password'

  if (!code) {
    const loginUrl = new URL('/login', url.origin)
    if (isResetFlow) {
      loginUrl.searchParams.set('error', 'reset_link_invalid')
    }
    return NextResponse.redirect(loginUrl)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL('/login', url.origin)
    loginUrl.searchParams.set('error', isResetFlow ? 'reset_link_invalid' : 'auth_callback_failed')
    return NextResponse.redirect(loginUrl)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', url.origin)
    if (isResetFlow) {
      loginUrl.searchParams.set('error', 'reset_link_invalid')
    }
    return NextResponse.redirect(loginUrl)
  }

  if (isResetFlow) {
    return NextResponse.redirect(new URL('/reset-password', url.origin))
  }

  const { data: profileWithUserType, error: profileWithUserTypeError } = await supabase
    .from('profiles')
    .select('onboarding_completed, role, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()
  let profile = profileWithUserType

  if (profileWithUserTypeError) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('onboarding_completed, role, comms_team')
      .eq('id', user.id)
      .maybeSingle()
    profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
  }

  profile = applyCanonicalCommsFallback(profile, user.email)

  if (!profile?.onboarding_completed) {
    return NextResponse.redirect(new URL('/onboarding', url.origin))
  }

  const destination = requestedNext === '/app/dashboard'
    ? getPostLoginLandingPath(profile?.role, profile?.comms_team, profile?.user_type)
    : next

  return NextResponse.redirect(new URL(destination, url.origin))
}
