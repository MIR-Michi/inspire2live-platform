'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Password setup screen for invited users.
 *
 * Reached from the invitation confirmation link (via /auth/callback?next=/setup-password).
 * The invitee already has an active session at this point but no password, so we
 * collect one here — entered twice, with a show/hide toggle and a "remember on
 * this device" preference — before handing off to the role-based onboarding flow.
 */
export default function SetupPasswordPage() {
  const router = useRouter()

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
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (!session) {
        setStatus({
          type: 'error',
          msg: 'Your invitation link is invalid or expired. Please ask for a new invitation.',
        })
      }

      setCheckingSession(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [])

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
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus({
        type: 'error',
        msg: 'Could not set your password. Your invitation link may have expired. Please ask for a new invitation.',
      })
      setLoading(false)
      return
    }

    // Persist the "keep me signed in" preference so the sign-in screen can honour
    // it next time the session needs re-establishing.
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

        {checkingSession ? (
          <p className="text-sm text-neutral-500">Checking your invitation…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-neutral-600">
              Welcome to Inspire2Live! Choose a password to finish setting up your account.
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
              disabled={loading || checkingSession}
              className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Set password & continue'}
            </button>

            <p className="text-center text-xs text-neutral-400">
              Trouble with your invitation?{' '}
              <a href="/login" className="text-orange-600 underline-offset-2 hover:underline">
                Return to sign in
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
