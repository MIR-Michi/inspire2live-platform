import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getPostLoginLandingPath } from '@/lib/comms-access'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // Token-hash links (the recommended server-side / cross-device flow) carry a
  // token_hash + type instead of a PKCE code. We support both.
  const tokenHash = url.searchParams.get('token_hash')
  const otpType = url.searchParams.get('type') as EmailOtpType | null
  const requestedNext = url.searchParams.get('next') ?? '/app/dashboard'
  const next = requestedNext.startsWith('/') ? requestedNext : '/app/dashboard'
  const isResetFlow = next === '/reset-password' || otpType === 'recovery'

  const redirectToLogin = (error?: string) => {
    const loginUrl = new URL('/login', url.origin)
    if (error) loginUrl.searchParams.set('error', error)
    return NextResponse.redirect(loginUrl)
  }

  if (!code && !tokenHash) {
    // No verifiable credential in the link — most often an expired/already-used
    // link, or a redirect-URL misconfiguration that dropped the params.
    return redirectToLogin(isResetFlow ? 'reset_link_invalid' : 'auth_callback_failed')
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

  // Verify the link. token_hash works without a PKCE verifier (so it survives the
  // invitee opening the email on a different device); code is the PKCE path.
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ type: otpType ?? 'email', token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code!)

  if (error) {
    return redirectToLogin(isResetFlow ? 'reset_link_invalid' : 'auth_callback_failed')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectToLogin(isResetFlow ? 'reset_link_invalid' : 'auth_callback_failed')
  }

  if (isResetFlow) {
    return NextResponse.redirect(new URL('/reset-password', url.origin))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, role')
    .eq('id', user.id)
    .maybeSingle()

  // Invitation flow: an invitee who has not yet chosen their own password is sent
  // to the password-setup screen first. We detect this via a metadata flag the
  // setup screen sets once a password is chosen — robust even if `next` is
  // dropped by a redirect-URL allowlist. The screen continues to onboarding after.
  const passwordSet = user.user_metadata?.password_set === true
  if (!profile?.onboarding_completed && (!passwordSet || next === '/setup-password')) {
    const setupUrl = new URL('/setup-password', url.origin)
    if (user.email) setupUrl.searchParams.set('email', user.email)
    return NextResponse.redirect(setupUrl)
  }

  if (!profile?.onboarding_completed) {
    return NextResponse.redirect(new URL('/onboarding', url.origin))
  }

  const destination = requestedNext === '/app/dashboard'
    ? getPostLoginLandingPath(profile?.role)
    : next

  return NextResponse.redirect(new URL(destination, url.origin))
}
