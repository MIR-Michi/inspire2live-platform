import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessAppPath } from '@/lib/role-access'
import { canAccessCommsWorkspace, getPostLoginLandingPath } from '@/lib/comms-access'

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
    status: string | null
  } | null = null

  if (user) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed, role, status')
        .eq('id', user.id)
        .maybeSingle()
      profile = data
    } catch {
      // Treat profile lookup failure as no profile; downstream guards handle it.
    }
  }

  // Deactivated accounts are locked out of the entire app. Keep them on the
  // login page (where a notice is shown) regardless of onboarding state.
  if (user && profile?.status === 'inactive' && !isAuthPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = '?status=inactive'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthPage && profile?.status !== 'inactive') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = getPostLoginLandingPath(profile?.role)
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
        ? canAccessCommsWorkspace(profile.role)
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
