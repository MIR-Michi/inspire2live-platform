'use client'

import { useState, useTransition } from 'react'
import { updateEmailAddress } from '@/app/app/profile/actions'

/**
 * Profile email section: shows the account's current email address and lets the
 * user change it. Changing sends a confirmation link to the new address
 * (Supabase secure email change); the address only updates once confirmed.
 */
export function EmailSettings({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set('email', email)
    startTransition(async () => {
      const result = await updateEmailAddress(formData)
      if (result.ok) {
        setMessage({ ok: true, text: result.message })
        setEmail('')
      } else {
        setMessage({ ok: false, text: result.error })
      }
    })
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-700">Email address</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Current: <span className="font-medium text-neutral-800">{currentEmail}</span>
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setMessage(null) }}
          placeholder="new.email@example.com"
          autoComplete="email"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={pending || email.trim() === ''}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Change email'}
        </button>
      </form>

      {message && (
        <p className={`mt-2 text-xs ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
