'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import {
  sendGenericGuestInvites,
  type GenericGuestInviteState,
} from '@/app/app/comms/conferences/guest-token-actions'
import {
  searchConferenceContacts,
  type ConferenceContactOption,
} from '@/app/app/comms/conferences/actions'

type DraftGuest = {
  localId: string
  contactId?: string
  fullName: string
  email: string | null
  whatsappId: string | null
  addToCrm?: boolean
}

const initialState: GenericGuestInviteState = { ok: false }

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ConferenceGuestBulkInvite() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<GenericGuestInviteState, FormData>(sendGenericGuestInvites, initialState)
  const [recipients, setRecipients] = useState<DraftGuest[]>([])
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ConferenceContactOption[]>([])
  const [searching, setSearching] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newWhatsapp, setNewWhatsapp] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendWhatsapp, setSendWhatsapp] = useState(false)

  // Cache results per query so backspacing/retyping a term already searched is
  // instant instead of re-hitting the server on every keystroke.
  const cacheRef = useRef<Map<string, ConferenceContactOption[]>>(new Map())

  const trimmedQuery = query.trim()
  const visibleOptions = trimmedQuery.length < 2 ? [] : options

  useEffect(() => {
    const text = query.trim()
    let cancelled = false
    const timer = setTimeout(() => {
      if (text.length < 2) {
        setOptions([])
        setSearching(false)
        return
      }

      const cached = cacheRef.current.get(text)
      if (cached) {
        setOptions(cached)
        setSearching(false)
        return
      }

      setSearching(true)
      void searchConferenceContacts(text)
        .then((result) => {
          const contacts = result.ok ? result.contacts : []
          cacheRef.current.set(text, contacts)
          if (cancelled) return
          setOptions(contacts)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const payload = useMemo(
    () => JSON.stringify(recipients.map((guest) => ({
      contactId: guest.contactId ?? null,
      fullName: guest.fullName,
      email: guest.email,
      whatsappId: guest.whatsappId,
      addToCrm: guest.addToCrm ?? false,
    }))),
    [recipients]
  )

  const addExisting = (contact: ConferenceContactOption) => {
    if (recipients.some((guest) => guest.contactId === contact.id)) return
    setRecipients((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        contactId: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        whatsappId: contact.whatsappId,
      },
    ])
    setQuery('')
    setOptions([])
  }

  const addNew = () => {
    const fullName = newName.trim()
    const email = newEmail.trim()
    const whatsappId = newWhatsapp.trim()
    if (!fullName || (!email && !whatsappId)) return
    setRecipients((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        fullName,
        email: email || null,
        whatsappId: whatsappId || null,
        addToCrm: true,
      },
    ])
    setNewName('')
    setNewEmail('')
    setNewWhatsapp('')
  }

  const removeGuest = (localId: string) => {
    setRecipients((prev) => prev.filter((guest) => guest.localId !== localId))
  }

  const canSend = recipients.length > 0 && (sendEmail || sendWhatsapp)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
      >
        Invite guests to submit attendance
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,560px)] rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Guest attendance</p>
              <h2 className="mt-0.5 text-base font-semibold text-neutral-900">Send generic form links</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Guests receive a personal link. Their first step is to select the conference they attended.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-neutral-400 hover:text-neutral-700">
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-500">
                Find CRM guest
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type a name or email from CRM..."
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-orange-400 focus:outline-none"
                />
              </label>
              {searching && trimmedQuery.length >= 2 && <p className="text-xs text-neutral-500">Searching CRM...</p>}
              {visibleOptions.length > 0 && (
                <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                  {visibleOptions.map((contact) => (
                    <li key={contact.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-800">{contact.fullName}</p>
                        <p className="truncate text-xs text-neutral-500">{contact.meta ?? contact.email ?? 'CRM contact'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addExisting(contact)}
                        className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Not in CRM yet</p>
              <div className="mt-2 space-y-2">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
                <input
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
                <input
                  value={newWhatsapp}
                  onChange={(event) => setNewWhatsapp(event.target.value)}
                  placeholder="WhatsApp / phone"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={addNew}
                disabled={!newName.trim() || (!newEmail.trim() && !newWhatsapp.trim())}
                className="mt-2 rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
              >
                Add to CRM and invite list
              </button>
            </div>
          </div>

          <form action={action} className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
            <input type="hidden" name="guests" value={payload} />
            <input type="hidden" name="sendEmail" value={sendEmail ? 'true' : 'false'} />
            <input type="hidden" name="sendWhatsapp" value={sendWhatsapp ? 'true' : 'false'} />

            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs font-semibold text-neutral-500">Send via</p>
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="h-4 w-4 rounded accent-orange-600" />
                Email
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={sendWhatsapp} onChange={(event) => setSendWhatsapp(event.target.checked)} className="h-4 w-4 rounded accent-orange-600" />
                WhatsApp
              </label>
              <Link href="/app/comms/conferences/submissions" className="ml-auto text-xs font-semibold text-neutral-500 hover:text-orange-700">
                Review submitted forms
              </Link>
            </div>

            {recipients.length > 0 ? (
              <ul className="max-h-36 space-y-1.5 overflow-y-auto">
                {recipients.map((guest) => (
                  <li key={guest.localId} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-800">{guest.fullName}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {[guest.email, guest.whatsappId, guest.addToCrm ? 'new CRM contact' : 'CRM contact'].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeGuest(guest.localId)} className="text-xs font-semibold text-neutral-400 hover:text-red-600">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-sm text-neutral-400">
                Add one or more guests before sending.
              </p>
            )}

            {state.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
            {state.results && state.results.length > 0 && (
              <ul className="space-y-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                {state.results.map((result, index) => (
                  <li key={`${result.name}-${index}`} className={result.ok ? 'text-xs text-green-700' : 'text-xs text-red-600'}>
                    {result.name}: {result.ok ? 'Invite sent' : result.error ?? 'Invite failed'}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              disabled={pending || !canSend}
              className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? 'Sending invites...' : `Send ${recipients.length || ''} invite${recipients.length === 1 ? '' : 's'}`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
