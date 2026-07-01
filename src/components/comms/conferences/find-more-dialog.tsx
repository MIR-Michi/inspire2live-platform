'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConferenceGuestBulkInvite } from '@/components/comms/conferences/conference-guest-bulk-invite'
import {
  addDiscoveredConferences,
  findMoreConferences,
  type DiscoverMoreCriteria,
} from '@/app/app/comms/conferences/actions'
import type { ConferenceRegion } from '@/lib/conference-types'
import type { DiscoveredConference } from '@/lib/ai/conferences'

const REGION_OPTIONS: Array<{ value: ConferenceRegion | 'all'; label: string }> = [
  { value: 'all', label: 'All regions' },
  { value: 'europe', label: 'Europe' },
  { value: 'north_america', label: 'North America' },
  { value: 'latin_america', label: 'Latin America' },
  { value: 'asia_pacific', label: 'Asia-Pacific' },
  { value: 'middle_east_africa', label: 'Middle East & Africa' },
  { value: 'global', label: 'Global / Virtual' },
]

const COUNTRY_OPTIONS: Record<Exclude<ConferenceRegion, 'global'>, string[]> = {
  europe: ['Austria', 'Belgium', 'Czech Republic', 'Denmark', 'Finland', 'France', 'Germany', 'Greece', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'],
  north_america: ['Canada', 'Mexico', 'United States'],
  latin_america: ['Argentina', 'Brazil', 'Chile', 'Colombia', 'Costa Rica', 'Mexico', 'Peru', 'Uruguay'],
  asia_pacific: ['Australia', 'China', 'Hong Kong', 'India', 'Indonesia', 'Japan', 'Malaysia', 'New Zealand', 'Singapore', 'South Korea', 'Taiwan', 'Thailand'],
  middle_east_africa: ['Egypt', 'Ghana', 'Israel', 'Jordan', 'Kenya', 'Morocco', 'Nigeria', 'Qatar', 'Saudi Arabia', 'South Africa', 'Turkey', 'United Arab Emirates'],
}

function countryOptions(region: ConferenceRegion | 'all'): string[] {
  if (region !== 'all' && region !== 'global') return COUNTRY_OPTIONS[region]
  return [...new Set(Object.values(COUNTRY_OPTIONS).flat())].sort((a, b) => a.localeCompare(b))
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates to be confirmed'
  const fmt = (value: string) => {
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) return ''
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms))
  }
  const startText = fmt(start)
  if (!startText) return 'Dates to be confirmed'
  if (!end || end === start) return startText
  const endText = fmt(end)
  return endText ? `${startText} - ${endText}` : startText
}

function progressMessage(elapsed: number): string {
  if (elapsed < 3) return 'Preparing targeted query and excluding already saved conferences.'
  if (elapsed < 10) return 'Searching official society calendars and conference pages.'
  if (elapsed < 20) return 'Checking country and regional conference directories.'
  if (elapsed < 35) return 'Validating dates, URLs, regions, and duplicate keys.'
  return 'Waiting for the final AI response. You can stop waiting and keep working.'
}

export function FindMoreDialog({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [criteria, setCriteria] = useState<DiscoverMoreCriteria>({ region: 'all', country: '', keywords: '' })
  const [results, setResults] = useState<DiscoveredConference[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const searchRunRef = useRef(0)
  const [isSaving, startSave] = useTransition()

  const countries = useMemo(() => countryOptions(criteria.region ?? 'all'), [criteria.region])
  const busy = searching || isSaving
  const selectedResults = results.filter((conf) => selected.has(conf.dedupeKey))

  useEffect(() => {
    if (!searching) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [searching])

  const updateCriteria = (patch: Partial<DiscoverMoreCriteria>) => {
    setCriteria((prev) => ({ ...prev, ...patch }))
  }

  const stopSearch = () => {
    searchRunRef.current += 1
    setSearching(false)
    setElapsed(0)
    setMessage('Search stopped. Any late result from the cancelled request will be ignored.')
  }

  const search = () => {
    const runId = searchRunRef.current + 1
    searchRunRef.current = runId
    setError(null)
    setMessage(null)
    setResults([])
    setSelected(new Set())
    setElapsed(0)
    setSearching(true)

    void findMoreConferences(criteria)
      .then((result) => {
        if (searchRunRef.current !== runId) return
        if (!result.ok) {
          setError(result.message)
          return
        }
        setResults(result.conferences)
        setSelected(new Set(result.conferences.map((conf) => conf.dedupeKey)))
        setMessage(`${result.message} ${result.candidateCount} candidates checked; ${result.validatedCount} valid.`)
      })
      .catch((err) => {
        if (searchRunRef.current !== runId) return
        setError(err instanceof Error ? err.message : 'Targeted conference search failed.')
      })
      .finally(() => {
        if (searchRunRef.current !== runId) return
        setSearching(false)
      })
  }

  const save = (items: DiscoveredConference[]) => {
    if (items.length === 0) return
    setError(null)
    startSave(async () => {
      const result = await addDiscoveredConferences(items)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setMessage(result.message)
      setResults((prev) => prev.filter((conf) => !items.some((item) => item.dedupeKey === conf.dedupeKey)))
      setSelected((prev) => {
        const next = new Set(prev)
        for (const item of items) next.delete(item.dedupeKey)
        return next
      })
      router.refresh()
    })
  }

  return (
    <>
      <ConferenceGuestBulkInvite />
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!aiEnabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Find more
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 px-4 py-6" role="dialog" aria-modal="true" aria-label="Find more conferences">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Find more conferences</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Search for additional oncology conferences by region, country, and custom keywords.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-sm font-semibold text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                Close
              </button>
            </div>

            <div className="grid gap-3 border-b border-neutral-200 px-5 py-4 md:grid-cols-[180px_220px_minmax(0,1fr)_auto]">
              <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
                Region
                <select
                  value={criteria.region ?? 'all'}
                  onChange={(e) => updateCriteria({ region: e.target.value as ConferenceRegion | 'all', country: '' })}
                  disabled={searching}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm font-semibold text-neutral-800 focus:border-orange-400 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
                Country
                <select
                  value={criteria.country ?? ''}
                  onChange={(e) => updateCriteria({ country: e.target.value })}
                  disabled={searching || criteria.region === 'global'}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm font-semibold text-neutral-800 focus:border-orange-400 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">Any country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
                Keywords
                <input
                  value={criteria.keywords ?? ''}
                  onChange={(e) => updateCriteria({ keywords: e.target.value })}
                  disabled={searching}
                  placeholder="e.g. breast cancer, advocacy, radiotherapy"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-orange-400 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={search}
                  disabled={busy || !aiEnabled}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
                {searching && (
                  <button
                    type="button"
                    onClick={stopSearch}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {searching && (
                <div className="mb-3 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-300 border-t-orange-700" aria-hidden="true" />
                    Focused AI search running ({elapsed}s)
                  </div>
                  <p className="mt-1 text-orange-700">{progressMessage(elapsed)}</p>
                </div>
              )}
              {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {message && <p className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{message}</p>}

              {results.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-700">{results.length} candidate{results.length === 1 ? '' : 's'} ready to add</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelected(new Set(results.map((conf) => conf.dedupeKey)))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                        Select all
                      </button>
                      <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                        Clear
                      </button>
                      <button type="button" onClick={() => save(selectedResults)} disabled={busy || selectedResults.length === 0} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                        Add selected ({selectedResults.length})
                      </button>
                      <button type="button" onClick={() => save(results)} disabled={busy} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-60">
                        Add all
                      </button>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {results.map((conf) => {
                      const checked = selected.has(conf.dedupeKey)
                      return (
                        <li key={conf.dedupeKey} className="rounded-xl border border-neutral-200 p-3">
                          <div className="flex gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(conf.dedupeKey)
                                  else next.delete(conf.dedupeKey)
                                  return next
                                })
                              }}
                              className="mt-1 h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">{conf.region}</span>
                                {conf.mainFocus && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{conf.mainFocus}</span>}
                              </div>
                              <p className="mt-1 text-sm font-semibold text-neutral-900">{conf.name}</p>
                              <p className="mt-0.5 text-xs text-neutral-500">{formatDateRange(conf.startDate, conf.endDate)}{conf.location ? ` · ${conf.location}` : ''}</p>
                              {conf.summary && <p className="mt-1 text-sm text-neutral-600">{conf.summary}</p>}
                              <div className="mt-2 flex flex-wrap gap-3">
                                {conf.websiteUrl && <a href={conf.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-orange-700 hover:underline">Official website ↗</a>}
                                {conf.sourceUrl && conf.sourceUrl !== conf.websiteUrl && <a href={conf.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-neutral-500 hover:text-orange-700 hover:underline">Source ↗</a>}
                              </div>
                            </div>
                            <button type="button" onClick={() => save([conf])} disabled={busy} className="self-start rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-60">
                              Add
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-neutral-700">No targeted results loaded yet.</p>
                  <p className="mt-1 text-sm text-neutral-400">Choose criteria and run a search to review candidates before adding them.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
