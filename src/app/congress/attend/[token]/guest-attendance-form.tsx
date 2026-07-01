'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ConferenceSuggestion = {
  id: string
  name: string
  location: string | null
  start_date: string | null
  end_date: string | null
}

type PrefillData = {
  valid: boolean
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  conferenceId: string | null
  conferenceName: string | null
}

type WorkspaceCheck = {
  submissions: Array<{ id: string }>
}

export function GuestAttendanceForm({ token }: { token: string }) {
  const router = useRouter()
  const [prefill, setPrefill] = useState<PrefillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [org, setOrg] = useState('')
  const [role, setRole] = useState('attendee')
  const [notes, setNotes] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)

  // Conference picker
  const [confQuery, setConfQuery] = useState('')
  const [confId, setConfId] = useState<string | null>(null)
  const [confName, setConfName] = useState('')
  const [confStart, setConfStart] = useState('')
  const [confEnd, setConfEnd] = useState('')
  const [confLocation, setConfLocation] = useState('')
  const [suggestions, setSuggestions] = useState<ConferenceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingConf, setSearchingConf] = useState(false)
  const [confLocked, setConfLocked] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confInputRef = useRef<HTMLInputElement>(null)

  // On mount: validate token AND check if there's already a submission (returning visitor).
  useEffect(() => {
    void Promise.all([
      fetch(`/api/congress-guest/validate?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch(`/api/congress-guest/workspace?token=${encodeURIComponent(token)}`).then((r) => r.ok ? r.json() : null),
    ]).then(([prefillData, workspaceData]: [PrefillData, WorkspaceCheck | null]) => {
      if (!prefillData.valid) {
        setExpired(true)
        setLoading(false)
        return
      }

      // Returning visitor: already submitted → go directly to workspace.
      if (workspaceData && workspaceData.submissions?.length > 0) {
        router.replace(`/congress/attend/${token}/workspace`)
        return
      }

      setPrefill(prefillData)
      setName(prefillData.contactName ?? '')
      setEmail(prefillData.contactEmail ?? '')
      setPhone(prefillData.contactPhone ?? '')
      if (prefillData.conferenceName) {
        setConfName(prefillData.conferenceName)
        setConfQuery(prefillData.conferenceName)
        setConfId(prefillData.conferenceId)
        setConfLocked(true)
      }
      setLoading(false)
    }).catch(() => {
      setExpired(true)
      setLoading(false)
    })
  }, [token, router])

  const searchConferences = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); return }
    setSearchingConf(true)
    void fetch(`/api/congress-guest/conferences?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: ConferenceSuggestion[]) => {
        setSuggestions(data ?? [])
        setShowSuggestions(true)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSearchingConf(false))
  }, [])

  const handleConfInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setConfQuery(q)
    setConfName(q)
    setConfId(null)
    setConfLocked(false)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchConferences(q), 250)
  }

  const selectConference = (s: ConferenceSuggestion) => {
    setConfId(s.id)
    setConfName(s.name)
    setConfQuery(s.name)
    setConfLocation(s.location ?? '')
    setConfStart(s.start_date ?? '')
    setConfEnd(s.end_date ?? '')
    setConfLocked(true)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const clearConference = () => {
    setConfId(null)
    setConfName('')
    setConfQuery('')
    setConfLocation('')
    setConfStart('')
    setConfEnd('')
    setConfLocked(false)
    setSuggestions([])
    setTimeout(() => confInputRef.current?.focus(), 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !confName.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/congress-guest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          submitterName: name.trim(),
          submitterEmail: email.trim() || null,
          submitterPhone: phone.trim() || null,
          submitterOrg: org.trim() || null,
          conferenceId: confId,
          conferenceName: confName.trim(),
          conferenceStart: confStart || null,
          conferenceEnd: confEnd || null,
          conferenceLocation: confLocation.trim() || null,
          role,
          notes: notes.trim() || null,
          isRegistered,
        }),
      })
      const data = await res.json() as { ok?: boolean; submissionId?: string; error?: string }
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        // Redirect to workspace — don't just show a thank-you dead end.
        router.push(`/congress/attend/${token}/workspace`)
      }
    } catch {
      setSubmitError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      </Shell>
    )
  }

  if (expired) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mb-4 text-4xl">🔗</div>
          <h1 className="mb-2 text-xl font-semibold text-neutral-900">This link has expired</h1>
          <p className="text-sm text-neutral-500">
            This link is no longer valid. Please ask your Inspire2Live contact to send you a new one.
          </p>
        </div>
      </Shell>
    )
  }

  const isConferenceFromDB = !!confId && confLocked

  return (
    <Shell>
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">Inspire2Live</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Conference attendance</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Let us know which conference you&apos;re attending. Takes less than a minute.
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
          {/* Your details */}
          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Your details</p>

            <Field label="Your name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                autoComplete="name"
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </Field>

            <Field label="Phone / WhatsApp">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+31 6 …"
                autoComplete="tel"
              />
            </Field>

            <Field label="Organisation">
              <Input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Your organisation or hospital"
                autoComplete="organization"
              />
            </Field>
          </section>

          {/* Conference */}
          <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Conference</p>

            <Field label="Conference name" required>
              <div className="relative">
                {confLocked ? (
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <span className="flex-1 text-sm font-medium text-neutral-900">{confName}</span>
                    {!prefill?.conferenceName && (
                      <button
                        type="button"
                        onClick={clearConference}
                        className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600"
                      >
                        Change
                      </button>
                    )}
                    {isConferenceFromDB && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        Found
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      ref={confInputRef}
                      type="text"
                      value={confQuery}
                      onChange={handleConfInput}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Type to search conferences…"
                      required
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    {searchingConf && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner small />
                      </div>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                        {suggestions.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onMouseDown={() => selectConference(s)}
                              className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-orange-50"
                            >
                              <span className="text-sm font-semibold text-neutral-900">{s.name}</span>
                              {(s.location || s.start_date) && (
                                <span className="text-xs text-neutral-500">
                                  {[s.location, s.start_date ? new Date(s.start_date).getFullYear() : null]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                        <li className="border-t border-neutral-100">
                          <button
                            type="button"
                            onMouseDown={() => {
                              setConfId(null)
                              setConfLocked(true)
                              setShowSuggestions(false)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-neutral-50"
                          >
                            <span className="text-xs font-semibold text-orange-600">+ Add &ldquo;{confQuery}&rdquo; as a new conference</span>
                          </button>
                        </li>
                      </ul>
                    )}
                    {!showSuggestions && confQuery.length >= 2 && !searchingConf && suggestions.length === 0 && (
                      <div className="mt-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                        <p className="mb-1 text-xs text-neutral-500">No match found.</p>
                        <button
                          type="button"
                          onClick={() => { setConfId(null); setConfLocked(true) }}
                          className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                        >
                          + Add &ldquo;{confQuery}&rdquo; as a new conference
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Field>

            {/* Extra conference details for manually-added ones */}
            {confLocked && !isConferenceFromDB && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date">
                    <Input type="date" value={confStart} onChange={(e) => setConfStart(e.target.value)} />
                  </Field>
                  <Field label="End date">
                    <Input type="date" value={confEnd} onChange={(e) => setConfEnd(e.target.value)} />
                  </Field>
                </div>
                <Field label="Location">
                  <Input
                    value={confLocation}
                    onChange={(e) => setConfLocation(e.target.value)}
                    placeholder="City, Country"
                  />
                </Field>
              </div>
            )}

            <Field label="Your role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="attendee">Attendee</option>
                <option value="speaker">Speaker</option>
                <option value="panelist">Panelist</option>
                <option value="organizer">Organizer</option>
                <option value="other">Other</option>
              </select>
            </Field>

            {/* Registration checkbox */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <input
                type="checkbox"
                checked={isRegistered}
                onChange={(e) => setIsRegistered(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-orange-600"
              />
              <div>
                <p className="text-sm font-semibold text-neutral-900">I am already registered for this conference</p>
                <p className="text-xs text-neutral-500">
                  This moves the conference to &ldquo;Registered&rdquo; in the I2L planning pipeline.
                </p>
              </div>
            </label>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else we should know?"
                rows={3}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </Field>
          </section>

          {submitError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !confName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? <><Spinner small white /> Sending…</> : 'Send attendance report →'}
          </button>

          <p className="text-center text-xs text-neutral-400">
            This form is for Inspire2Live contacts only. Your data is handled securely and never shared.
          </p>
        </form>
      </div>
    </Shell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <header className="border-b border-orange-100 bg-white/80 px-4 py-3 backdrop-blur">
        <p className="text-sm font-bold tracking-wide text-orange-700">Inspire2Live</p>
      </header>
      <main>{children}</main>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-neutral-600">
        {label}
        {required && <span className="ml-0.5 text-orange-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
    />
  )
}

function Spinner({ small, white }: { small?: boolean; white?: boolean }) {
  const size = small ? 'h-4 w-4' : 'h-8 w-8'
  const color = white ? 'border-white/40 border-t-white' : 'border-neutral-200 border-t-orange-500'
  return (
    <span
      className={`${size} animate-spin rounded-full border-2 ${color}`}
      role="status"
      aria-label="Loading"
    />
  )
}
