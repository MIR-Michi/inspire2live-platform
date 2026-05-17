'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
          msg: 'Your reset link is invalid or expired. Please request a new one from the login page.',
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
        msg: 'Could not update password. Your link may have expired. Please request a new reset email.',
      })
      setLoading(false)
      return
    }

    setStatus({ type: 'success', msg: 'Password updated. Redirecting to sign in…' })
    setLoading(false)

    setTimeout(() => {
      router.replace('/login?reset=success')
    }, 900)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-600 text-sm font-bold text-white">
            I2L
          </span>
          <span className="text-base font-semibold text-neutral-900">Set new password</span>
        </div>

        {checkingSession ? (
          <p className="text-sm text-neutral-500">Checking reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
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
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                name="confirm-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                placeholder="••••••••"
                autoComplete="new-password"
              />
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
              {loading ? 'Updating…' : 'Update password'}
            </button>

            <p className="text-center text-xs text-neutral-400">
              Need a fresh link?{' '}
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
