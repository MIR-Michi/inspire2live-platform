'use client'

/**
 * network/ui/person-actions.tsx — the two things you can do to a person.
 *
 * The People screen was read-only: four record types gathered into one list
 * with no way to correct it or to act on it. These are the two actions the list
 * was missing, and they are opposites — one ends the platform's interest in
 * somebody, the other begins it.
 *
 * Both are deliberately quiet. They sit in the card's footer as text rather
 * than as buttons, because a directory is for reading and a row of controls on
 * every line would turn forty people into eighty decisions.
 */

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { addPersonToCrm, deletePerson } from '@/modules/network/domain/actions'
import type { PersonOrigin } from '@/modules/network/domain/types'

const LINK = 'text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50'
const FIELD = 'rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs'

export function PersonActions({
  personId,
  fullName,
  origin,
  crmContactId,
  personTypes,
}: {
  personId: string
  fullName: string
  /** Only an externally-sourced record is guaranteed to hold no way to reach them. */
  origin: PersonOrigin
  /** Set once they are in the CRM; the card links there instead of offering to add. */
  crmContactId: string | null
  /**
   * The CRM's own categories, handed down as data rather than imported: this is
   * a client component, and `@/modules/contacts` reaches server-only code.
   */
  personTypes: ReadonlyArray<{ value: string; label: string }>
}) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'crm'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const [personType, setPersonType] = useState<string>('researcher')
  const [email, setEmail] = useState('')

  function reset() {
    setMode('idle')
    setError(null)
    setConfirm(null)
  }

  function add() {
    startTransition(async () => {
      setError(null)
      const result = await addPersonToCrm(personId, { personType, email: email.trim() || null })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMode('idle')
      setMessage(
        result.data?.created
          ? 'Added to the CRM.'
          : 'They were already in the CRM — linked to that contact.',
      )
    })
  }

  function remove(confirmed: boolean) {
    startTransition(async () => {
      setError(null)
      const result = await deletePerson(personId, { confirmed })
      if (!result.ok) {
        setError(result.error)
        setConfirm(null)
        return
      }
      if (result.data?.confirm) {
        setConfirm(result.data.confirm)
        return
      }
      // The row is gone; the list re-renders without it.
      setConfirm(null)
    })
  }

  if (confirm) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-red-900">
        <span className="text-right">{confirm}</span>
        <button
          type="button"
          onClick={() => remove(true)}
          disabled={pending}
          className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Remove
        </button>
        <button type="button" onClick={reset} className={`${LINK} text-neutral-600`}>
          Keep
        </button>
      </div>
    )
  }

  if (mode === 'crm') {
    return (
      <div className="w-full space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3">
        {error && (
          <p role="alert" className="text-xs text-red-800">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={personType}
            onChange={(e) => setPersonType(e.target.value)}
            aria-label={`Contact type for ${fullName}`}
            className={FIELD}
          >
            {personTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address (optional)"
            aria-label={`Email address for ${fullName}`}
            className={`${FIELD} min-w-[14rem] flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add to CRM'}
          </button>
          <button type="button" onClick={reset} className={`${LINK} text-neutral-600`}>
            Cancel
          </button>
        </div>
        {origin === 'external' && (
          <p data-copy className="text-[11px] text-neutral-500">
            This record was built from published work, so it holds no way to reach them — an address
            here is one you know, not one the platform found. Their role, organisation, topics and
            every source behind them come across either way.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {error && (
        <span role="alert" className="text-xs text-red-800">
          {error}
        </span>
      )}
      {message && <span className="text-xs text-emerald-800">{message}</span>}

      {crmContactId ? (
        <Link href="/app/comms/crm/people" className={`${LINK} text-violet-700`}>
          In the CRM
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setMode('crm')}
          disabled={pending}
          className={`${LINK} text-neutral-600 hover:text-neutral-900`}
        >
          Add to CRM
        </button>
      )}

      <button
        type="button"
        onClick={() => remove(false)}
        disabled={pending}
        className={`${LINK} text-red-700`}
      >
        {pending ? 'Working…' : 'Remove'}
      </button>
    </div>
  )
}
