'use client'

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
    <section className="rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Send attendance form</p>
          <p className="mt-0.5 text-sm text-neutral-600">
            Generate a personal magic link for a contact to report their attendance.
          </p>
        </div>
      </div>

      {state.ok && state.url ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
            <p className="mb-1 text-xs font-semibold text-green-700">Link generated!</p>
            <p className="break-all font-mono text-xs text-green-800">{state.url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(state.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-green-200 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              Open in WhatsApp
            </a>
          </div>
          {state.sends && state.sends.length > 0 && (
            <ul className="space-y-1">
              {state.sends.map((r) => (
                <li key={r.channel} className={`text-xs ${r.ok ? 'text-green-700' : 'text-red-600'}`}>
                  {r.ok ? '✓' : '✕'} {r.channel}: {r.ok ? 'Sent' : (r.error ?? 'Failed')}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="conferenceId" value={conferenceId} />
          <input type="hidden" name="conferenceName" value={conferenceName} />

          {/* Contact selector */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-500">
                Send to
                <select
                  name="_contactSelector"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-orange-400 focus:outline-none"
                >
                  {contacts.map((c) => (
                    <option key={c.contactId} value={c.contactId}>{c.contactName}</option>
                  ))}
                  <option value="__manual__">Enter manually…</option>
                </select>
              </label>
            </div>
          )}

          {/* Hidden or visible contact fields */}
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
                placeholder="Full name"
                required
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
              <input
                name="contactEmail"
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
              <input
                name="contactPhone"
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="WhatsApp / phone (optional)"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
            </div>
          )}

          {/* Delivery channels */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-neutral-500">Send via</p>
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
          </div>

          {state.error && (
            <p className="text-xs text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? 'Generating…' : 'Generate & send link'}
          </button>
        </form>
      )}
    </section>
  )
}
