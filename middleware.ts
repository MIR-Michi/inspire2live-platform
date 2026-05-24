import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessAppPath } from '@/lib/role-access'
import { canAccessCommsWorkspace, getPostLoginLandingPath } from '@/lib/comms-access'
import { applyCanonicalCommsFallback } from '@/lib/user-workspace'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isOnboardingPage = pathname.startsWith('/onboarding')
  const isProtected = pathname.startsWith('/app')
  const isCommsRoute = pathname === '/app/comms' || pathname.startsWith('/app/comms/')

  // Without Supabase credentials (e.g. CI without secrets), treat every request
  // as unauthenticated. Protected routes still redirect to /login so smoke tests
  // verifying that contract continue to pass.
  if (!supabaseUrl || !supabaseKey) {
    if (isProtected) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth
    .getUser()
    .catch(() => ({ data: { user: null } }))

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  let profile: {
    onboarding_completed: boolean | null
    role: string | null
    comms_team: boolean | null
    user_type: string | null
  } | null = null

  if (user) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, role, comms_team, user_type')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        const { data: fallbackProfile } = await supabase
          .from('profiles')
          .select('onboarding_completed, role, comms_team')
          .eq('id', user.id)
          .maybeSingle()
        profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
      } else {
        profile = data
      }
      profile = applyCanonicalCommsFallback(profile, user.email)
    } catch {
      // Treat profile lookup failure as no profile; downstream guards handle it.
    }
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = getPostLoginLandingPath(profile?.role, profile?.comms_team, profile?.user_type)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isOnboardingPage && !isAuthPage) {

    if (profile && profile.onboarding_completed === false && isProtected) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/onboarding'
      return NextResponse.redirect(redirectUrl)
    }

    if (profile?.onboarding_completed && isProtected) {
      const allowed = isCommsRoute
        ? canAccessCommsWorkspace(profile.role, profile.comms_team, profile.user_type)
        : canAccessAppPath(profile.role, pathname)
      if (!allowed) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/app/dashboard'
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
