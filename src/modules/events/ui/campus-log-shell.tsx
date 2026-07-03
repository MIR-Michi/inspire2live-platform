'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FounderBadge } from '@/components/comms/founder-badge'
import { createCampusSession } from '@/app/app/comms/campus-log/actions'

type SessionCard = {
  id: string
  session_date: string
  theme: string | null
  summary: string | null
  participatingHubLabels: string[]
}

type MemberCard = {
  id: string
  name: string
  country: string | null
  organisation: string | null
  role_description: string | null
  date_welcomed: string | null
  welcomed_by_peter: boolean
  last_channel_activity: string | null
}

type Option = {
  id: string
  label: string
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function CampusLogShell({
  tab,
  sessions,
  members,
  hubs,
  initiatives,
}: {
  tab: 'sessions' | 'members'
  sessions: SessionCard[]
  members: MemberCard[]
  hubs: Option[]
  initiatives: Option[]
}) {
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')

  const countries = useMemo(
    () => Array.from(new Set(members.map((member) => member.country).filter(Boolean))).sort(),
    [members]
  )

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter((member) => {
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        (member.organisation ?? '').toLowerCase().includes(query) ||
        (member.role_description ?? '').toLowerCase().includes(query)

      const matchesCountry = countryFilter === 'all' || member.country === countryFilter
      return matchesSearch && matchesCountry
    })
  }, [countryFilter, members, search])

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">World Campus</p>
        <h2 className="text-2xl font-semibold text-neutral-900">Campus log</h2>
        <p className="text-sm text-neutral-600">
          Replace buried message threads with a searchable record of sessions, welcomes, and community follow-up.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/app/comms/campus-log?tab=sessions"
          className={[
            'rounded-full px-3 py-1.5 text-sm font-semibold transition',
            tab === 'sessions'
              ? 'bg-neutral-900 text-white'
              : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
          ].join(' ')}
        >
          Sessions
        </Link>
        <Link
          href="/app/comms/campus-log?tab=members"
          className={[
            'rounded-full px-3 py-1.5 text-sm font-semibold transition',
            tab === 'members'
              ? 'bg-neutral-900 text-white'
              : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
          ].join(' ')}
        >
          Members
        </Link>
      </nav>

      {tab === 'sessions' ? (
        <div className="space-y-5">
          <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none text-base font-semibold text-neutral-900">
              Create World Campus session
            </summary>
            <form action={createCampusSession} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Session date</span>
                <input type="date" name="session_date" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Theme</span>
                <input name="theme" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>

              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-neutral-800">Summary</span>
                <textarea name="summary" rows={4} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </label>

              {hubs.length > 0 && (
                <fieldset className="space-y-2 md:col-span-2">
                  <legend className="text-sm font-semibold text-neutral-800">Participating hubs</legend>
                  <div className="grid gap-2 md:grid-cols-3">
                    {hubs.map((hub) => (
                      <label key={hub.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                        <input type="checkbox" name="participating_hub_ids" value={hub.id} />
                        {hub.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {initiatives.length > 0 && (
                <fieldset className="space-y-2 md:col-span-2">
                  <legend className="text-sm font-semibold text-neutral-800">Related initiatives</legend>
                  <div className="grid gap-2 md:grid-cols-2">
                    {initiatives.slice(0, 8).map((initiative) => (
                      <label key={initiative.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                        <input type="checkbox" name="initiative_ids" value={initiative.id} />
                        {initiative.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
                  Create session
                </button>
              </div>
            </form>
          </details>

          <div className="space-y-4">
            {sessions.map((session) => (
              <article key={session.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">
                      {formatDate(session.session_date)}
                    </p>
                    <h3 className="text-lg font-semibold text-neutral-900">{session.theme || 'World Campus session'}</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {session.participatingHubLabels.map((hub) => (
                        <span key={hub} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                          {hub}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-neutral-600">
                      {session.summary || 'Summary still needs to be captured.'}
                    </p>
                  </div>
                  <Link
                    href={`/app/comms/campus-log/sessions/${session.id}`}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    Open detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px]">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-neutral-800">Search members</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, organisation, or role"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-neutral-800">Country</span>
              <select
                value={countryFilter}
                onChange={(event) => setCountryFilter(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="all">All countries</option>
                {countries.map((country) => (
                  <option key={country} value={country ?? ''}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4">
            {filteredMembers.map((member) => (
              <article key={member.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {member.welcomed_by_peter && <FounderBadge label="Welcomed by Peter" />}
                      {member.country && (
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                          {member.country}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{member.name}</h3>
                      <p className="text-sm text-neutral-500">
                        {[member.organisation, member.role_description].filter(Boolean).join(' · ') || 'Role details still to be refined'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                      <span>Date welcomed: {formatDate(member.date_welcomed)}</span>
                      <span>Last channel activity: {formatDate(member.last_channel_activity)}</span>
                    </div>
                  </div>
                  <Link
                    href={`/app/comms/campus-log/members/${member.id}`}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    Open detail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
