'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { generateGuestToken, type GenerateTokenState } from '@/app/app/comms/conferences/guest-token-actions'

type AssignedContact = {
  contactId: string
  contactName: string
  contactEmail: string | null
  contactPhone: string | null
}

const initial: GenerateTokenState = { ok: false }

export function ConferenceGuestLink({
  conferenceId,
  conferenceName,
  contacts,
}: {
  conferenceId: string
  conferenceName: string
  contacts: AssignedContact[]
}) {
  const [state, action, pending] = useActionState<GenerateTokenState, FormData>(generateGuestToken, initial)
  const [open, setOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState(contacts[0]?.contactId ?? '__manual__')
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [sendWhatsapp, setSendWhatsapp] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [copied, setCopied] = useState(false)

  const selected = contacts.find((c) => c.contactId === selectedContactId)
  const isManual = selectedContactId === '__manual__'

  const copyUrl = () => {
    if (!state.url) return
    void navigator.clipboard.writeText(state.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-orange-700">Guest invite</span>
          <span className="mt-0.5 block text-sm font-semibold text-neutral-900">Invite guest to submit attendance</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-neutral-600">
            Send a personal form link by email, WhatsApp, or both.
          </span>
        </span>
        <span className="rounded-full border border-orange-200 bg-white px-2 py-0.5 text-xs font-semibold text-orange-700">
          {open ? 'Hide' : 'Open'}
        </span>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/app/comms/conferences/submissions"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Review submitted forms
        </Link>
      </div>

      {open && (
        <div className="mt-3 border-t border-orange-100 pt-3">
          {state.ok && state.url ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <p className="mb-1 text-xs font-semibold text-green-700">Invite link created</p>
                <p className="break-all font-mono text-xs text-green-800">{state.url}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyUrl}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(state.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-green-200 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                >
                  Share in WhatsApp
                </a>
              </div>
              {state.sends && state.sends.length > 0 && (
                <ul className="space-y-1">
                  {state.sends.map((r) => (
                    <li key={r.channel} className={`text-xs ${r.ok ? 'text-green-700' : 'text-red-600'}`}>
                      {r.ok ? 'Sent' : 'Failed'} via {r.channel}{r.ok ? '' : `: ${r.error ?? 'Unknown error'}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <form action={action} className="space-y-3">
              <input type="hidden" name="conferenceId" value={conferenceId} />
              <input type="hidden" name="conferenceName" value={conferenceName} />

              {contacts.length > 0 && (
                <label className="block text-xs font-semibold text-neutral-500">
                  Invite
                  <select
                    name="_contactSelector"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-orange-400 focus:outline-none"
                  >
                    {contacts.map((c) => (
                      <option key={c.contactId} value={c.contactId}>{c.contactName}</option>
                    ))}
                    <option value="__manual__">Enter manually...</option>
                  </select>
                </label>
              )}

              {!isManual && selected ? (
                <>
                  <input type="hidden" name="contactId" value={selected.contactId} />
                  <input type="hidden" name="contactName" value={selected.contactName} />
                  <input type="hidden" name="contactEmail" value={selected.contactEmail ?? ''} />
                  <input type="hidden" name="contactPhone" value={selected.contactPhone ?? ''} />
                  <div className="rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm">
                    <p className="font-semibold text-neutral-800">{selected.contactName}</p>
                    <p className="text-xs text-neutral-500">
                      {[selected.contactEmail, selected.contactPhone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    name="contactName"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Guest full name"
                    required
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                  <input
                    name="contactEmail"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Email for invite"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                  <input
                    name="contactPhone"
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="WhatsApp / phone for invite"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-neutral-500">Delivery method</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    name="sendEmail"
                    value="true"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-orange-600"
                  />
                  Email
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    name="sendWhatsapp"
                    value="true"
                    checked={sendWhatsapp}
                    onChange={(e) => setSendWhatsapp(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-orange-600"
                  />
                  WhatsApp
                </label>
              </div>

              {state.error && (
                <p className="text-xs text-red-600">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {pending ? 'Sending...' : 'Create invite and send'}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
