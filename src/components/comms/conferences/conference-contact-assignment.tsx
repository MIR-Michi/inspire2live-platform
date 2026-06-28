'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignConferenceContact,
  getConferenceContacts,
  searchConferenceContacts,
  type AssignedConferenceContact,
  type ConferenceContactOption,
} from '@/app/app/comms/conferences/actions'

export function ConferenceContactAssignment({ conferenceId, conferenceName }: { conferenceId: string; conferenceName: string }) {
  const router = useRouter()
  const [assigned, setAssigned] = useState<AssignedConferenceContact[]>([])
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ConferenceContactOption[]>([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappId, setWhatsappId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const showOptions = query.trim().length >= 2 && options.length > 0

  const loadAssigned = useCallback(async () => {
    const result = await getConferenceContacts(conferenceId)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setAssigned(result.contacts)
  }, [conferenceId])

  useEffect(() => {
    void loadAssigned()
  }, [loadAssigned])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) return

    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      void searchConferenceContacts(text)
        .then((result) => {
          if (cancelled) return
          if (!result.ok) {
            setError(result.message)
            return
          }
          setOptions(result.contacts)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const updateQuery = (value: string) => {
    setQuery(value)
    if (value.trim().length < 2) setOptions([])
  }

  const assignExisting = (contact: ConferenceContactOption) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await assignConferenceContact({ conferenceId, contactId: contact.id })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setQuery('')
      setOptions([])
      setMessage(result.message)
      await loadAssigned()
      router.refresh()
    })
  }

  const addAndAssign = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await assignConferenceContact({ conferenceId, firstName, lastName, email, whatsappId })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setFirstName('')
      setLastName('')
      setEmail('')
      setWhatsappId('')
      setQuery('')
      setOptions([])
      setMessage(result.message)
      await loadAssigned()
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Registered attendees</p>
          <p className="mt-0.5 text-sm text-neutral-600">Assign Inspire2Live contacts from the CRM for {conferenceName}.</p>
        </div>
        {pending && <span className="text-xs font-semibold text-violet-700">Saving...</span>}
      </div>

      {assigned.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {assigned.map((contact) => (
            <li key={contact.assignmentId} className="rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-800">{contact.fullName}</p>
                  <p className="text-xs text-neutral-500">{contact.meta ?? contact.email ?? 'CRM contact'}</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">{contact.notificationStatus}</span>
              </div>
              {contact.notificationDetail && <p className="mt-1 text-xs text-neutral-500">{contact.notificationDetail}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-3">
        <label className="block text-xs font-semibold text-neutral-500">
          Search CRM contact
          <input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Type a name from the CRM..."
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-violet-400 focus:outline-none"
          />
        </label>

        {loading && <p className="text-xs text-neutral-500">Searching CRM...</p>}
        {showOptions && (
          <ul className="space-y-1.5">
            {options.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-800">{contact.fullName}</p>
                  <p className="truncate text-xs text-neutral-500">{contact.meta ?? contact.email ?? 'CRM contact'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => assignExisting(contact)}
                  disabled={pending}
                  className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  Assign
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-dashed border-violet-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add new CRM contact</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
            <input value={whatsappId} onChange={(event) => setWhatsappId(event.target.value)} placeholder="WhatsApp id or phone (optional)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
          </div>
          <button
            type="button"
            onClick={addAndAssign}
            disabled={pending}
            className="mt-2 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
          >
            Add contact and assign
          </button>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-neutral-600">{message}</p>}
      </div>
    </section>
  )
}
