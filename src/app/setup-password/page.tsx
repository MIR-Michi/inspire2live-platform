'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Password setup screen for invited users.
 *
 * Reached from the invitation confirmation link (the /auth/callback route verifies
 * the link, establishes the invitee's session, and forwards here with ?email=).
 * The invitee has an active session but no password, so we collect one — entered
 * twice, with a show/hide toggle and a "remember me" preference — before handing
 * off to the role-based onboarding flow.
 *
 * If a *different* account is already signed in (e.g. the inviter's), we don't
 * silently take it over: we surface the mismatch and let the person choose to
 * sign out and open the invitation, or keep their existing account.
 */
export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </div>
      }
    >
      <SetupPasswordContent />
    </Suspense>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/brand/inspire2live-logo.png"
            alt="Inspire2Live"
            width={409}
            height={262}
            priority
            className="h-9 w-auto"
          />
          <span className="text-base font-semibold text-neutral-900">Set your password</span>
        </div>
        {children}
      </div>
    </main>
  )
}

function SetupPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitedEmail = searchParams.get('email')?.trim().toLowerCase() || null

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      setSessionEmail(user?.email?.toLowerCase() ?? null)
      setCheckingSession(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login?notice=reopen-invite')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      setStatus({ type: 'error', msg: 'Password must be at least 8 characters.' })
      return
    }

    if (password !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match.' })
      return
    }

    setLoading(true)
    setStatus(null)

    const supabase = createClient()
    // The password_set flag lets the auth callback tell "needs to choose a
    // password" apart from "already set up" on future magic-link sign-ins.
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })

    if (error) {
      setStatus({
        type: 'error',
        msg: 'Could not set your password. Your invitation link may have expired. Please ask for a new invitation.',
      })
      setLoading(false)
      return
    }

    try {
      localStorage.setItem('i2l:keepSignedIn', rememberMe ? 'true' : 'false')
    } catch {
      // localStorage may be unavailable (private mode) — preference is optional.
    }

    setStatus({ type: 'success', msg: 'Password set. Taking you to onboarding…' })
    setLoading(false)

    setTimeout(() => {
      router.replace('/onboarding')
    }, 700)
  }

  const inputType = showPassword ? 'text' : 'password'

  // Identity states ----------------------------------------------------------
  const noSession = !checkingSession && !sessionEmail
  const mismatchedAccount =
    !checkingSession && !!sessionEmail && !!invitedEmail && sessionEmail !== invitedEmail

  if (checkingSession) {
    return (
      <Shell>
        <p className="text-sm text-neutral-500">Checking your invitation…</p>
      </Shell>
    )
  }

  if (noSession) {
    return (
      <Shell>
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {invitedEmail
              ? `To finish setting up ${invitedEmail}, please open the invitation link from your email again — it can only be used once.`
              : 'Your invitation link is invalid or has expired. Please open the most recent invitation email, or ask for a new invitation.'}
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Go to sign in
          </a>
        </div>
      </Shell>
    )
  }

  if (mismatchedAccount) {
    return (
      <Shell>
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            This invitation is for <span className="font-semibold text-neutral-900">{invitedEmail}</span>, but you&apos;re
            currently signed in as <span className="font-semibold text-neutral-900">{sessionEmail}</span>.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Sign out & set up {invitedEmail}
            </button>
            <button
              type="button"
              onClick={() => router.replace('/app/dashboard')}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Keep using {sessionEmail}
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Signing out will return you to sign-in; open the invitation link from {invitedEmail}&apos;s inbox to continue.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-600">
          Welcome to Inspire2Live! Choose a password to finish setting up
          {sessionEmail ? <> your account (<span className="font-medium text-neutral-800">{sessionEmail}</span>)</> : ' your account'}.
        </p>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="new-password">
            Password <span className="font-normal text-neutral-400">(min. 8 characters)</span>
          </label>
          <input
            id="new-password"
            type={inputType}
            name="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type={inputType}
            name="confirm-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-300"
            />
            Show password
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-300"
            />
            Remember me
          </label>
        </div>

        {status && (
          <p className={`rounded-lg px-3 py-2 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {status.msg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Set password & continue'}
        </button>

        <p className="text-center text-xs text-neutral-400">
          Not {sessionEmail ?? 'you'}?{' '}
          <button type="button" onClick={handleSignOut} className="text-orange-600 underline-offset-2 hover:underline">
            Sign out
          </button>
        </p>
      </form>
    </Shell>
  )
}
