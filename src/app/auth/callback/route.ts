import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getPostLoginLandingPath } from '@/lib/comms-access'

/**
 * Verifies an email auth link (invite / magic link / recovery) and routes the
 * user onward.
 *
 * Two entry points share this logic:
 *   - GET  — a direct link click (PKCE `code` or a `token_hash` in the query).
 *   - POST — submitted by the /auth/confirm interstitial. This is the path the
 *     email templates use: link scanners (e.g. Microsoft 365 SafeLinks) pre-open
 *     the GET of /auth/confirm, which does NOT verify, so the single-use token
 *     survives until the human actually clicks "Continue" (a POST here).
 *
 * Redirects use 303 (See Other) so a POST always resolves to a GET on the
 * destination rather than re-POSTing.
 */
async function verifyAndRoute(opts: {
  code: string | null
  tokenHash: string | null
  otpType: EmailOtpType | null
  requestedNext: string
  origin: string
}): Promise<NextResponse> {
  const { code, tokenHash, otpType, requestedNext, origin } = opts
  const next = requestedNext.startsWith('/') ? requestedNext : '/app/dashboard'
  const isResetFlow = next === '/reset-password' || otpType === 'recovery'

  const redirect = (path: string) => NextResponse.redirect(new URL(path, origin), 303)
  const redirectToLogin = (error?: string) => {
    const loginUrl = new URL('/login', origin)
    if (error) loginUrl.searchParams.set('error', error)
    return NextResponse.redirect(loginUrl, 303)
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
    return redirect('/reset-password')
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
    const setupUrl = new URL('/setup-password', origin)
    if (user.email) setupUrl.searchParams.set('email', user.email)
    return NextResponse.redirect(setupUrl, 303)
  }

  if (!profile?.onboarding_completed) {
    return redirect('/onboarding')
  }

  const destination = requestedNext === '/app/dashboard'
    ? getPostLoginLandingPath(profile?.role)
    : next

  return redirect(destination)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  return verifyAndRoute({
    code: url.searchParams.get('code'),
    tokenHash: url.searchParams.get('token_hash'),
    otpType: url.searchParams.get('type') as EmailOtpType | null,
    requestedNext: url.searchParams.get('next') ?? '/app/dashboard',
    origin: url.origin,
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const form = await request.formData()
  const field = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  return verifyAndRoute({
    code: field('code'),
    tokenHash: field('token_hash'),
    otpType: field('type') as EmailOtpType | null,
    requestedNext: field('next') ?? '/app/dashboard',
    origin: url.origin,
  })
}
