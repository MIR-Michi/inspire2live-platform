'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { useConferenceRun } from '@/components/comms/use-conference-run'
import { FindMoreDialog } from '@/components/comms/conferences/find-more-dialog'
import {
  CONFERENCE_STAGE_LABELS,
  CONFERENCE_STAGES,
  filterConferences,
  partitionConferences,
  type ConferenceFilters,
  type ConferenceStage,
  type ConferenceTab,
  type ConferencesData,
  type ConferenceView,
} from '@/lib/comms-conferences'
import type { ConferenceRunStatus } from '@/lib/ai/conference-run'
import type { ConferenceDetail } from '@/lib/ai/conferences'
import {
  addConferenceToShortlist,
  enrichConferenceDetail,
  removeConferenceFromPipeline,
  setConferenceStage,
} from '@/app/app/comms/conferences/actions'

const FORMAT_LABELS: Record<string, string> = { in_person: 'In person', virtual: 'Virtual', hybrid: 'Hybrid' }
const BACKGROUND_DETAIL_LIMIT = 120
const BACKGROUND_DETAIL_CONCURRENCY = 2

const STAGE_TONES: Record<ConferenceStage, StatusTone> = {
  intended: 'blue',
  registered: 'violet',
  ongoing: 'amber',
  follow_up: 'green',
  archived: 'neutral',
}

const TABS: Array<{ key: ConferenceTab; label: string }> = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'intended', label: CONFERENCE_STAGE_LABELS.intended },
  { key: 'registered', label: CONFERENCE_STAGE_LABELS.registered },
  { key: 'ongoing', label: CONFERENCE_STAGE_LABELS.ongoing },
  { key: 'follow_up', label: CONFERENCE_STAGE_LABELS.follow_up },
  { key: 'archived', label: CONFERENCE_STAGE_LABELS.archived },
]

type DetailState = { status: 'idle' | 'loading' | 'ready' | 'error'; detail?: ConferenceDetail; message?: string }

function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (value: string, withYear = true) => {
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) return ''
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(ms))
  }
  if (!start) return 'Dates to be confirmed'
  const startFmt = fmt(start, !end || end === start)
  if (!startFmt) return 'Dates to be confirmed'
  if (!end || end === start) return startFmt
  const endFmt = fmt(end)
  return endFmt ? `${startFmt} – ${endFmt}` : startFmt
}

function detailPrefetchRank(conf: ConferenceView): number {
  const start = conf.startDate ? Date.parse(conf.startDate) : Number.MAX_SAFE_INTEGER
  const normalizedStart = Number.isNaN(start) ? Number.MAX_SAFE_INTEGER : start
  return normalizedStart - conf.relevance * 60 * 60 * 1000
}

function optionLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function ConferencesShell({
  data,
  initialStatus,
  aiEnabled,
  canRefreshCache,
}: {
  data: ConferencesData
  initialStatus: ConferenceRunStatus | null
  aiEnabled: boolean
  canRefreshCache: boolean
}) {
  const [tab, setTab] = useState<ConferenceTab>('upcoming')
  const [filters, setFilters] = useState<ConferenceFilters>({ region: 'all', focus: 'all', format: 'all', search: '' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, DetailState>>(() => {
    // Seed from any detail already cached on the row.
    const seed: Record<string, DetailState> = {}
    for (const conf of data.conferences) {
      if (conf.detailStatus === 'ready' && conf.detail) seed[conf.id] = { status: 'ready', detail: conf.detail }
    }
    return seed
  })
  const detailsRef = useRef(details)
  const backgroundQueuedRef = useRef<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const run = useConferenceRun(initialStatus)

  const partitions = useMemo(() => partitionConferences(data.conferences), [data.conferences])
  const filteredUpcoming = useMemo(() => filterConferences(partitions.upcoming, filters), [partitions.upcoming, filters])

  const visible: ConferenceView[] = tab === 'upcoming' ? filteredUpcoming : partitions[tab]
  const selected = useMemo(() => data.conferences.find((c) => c.id === selectedId) ?? null, [data.conferences, selectedId])

  const setDetailState = useCallback((id: string, state: DetailState) => {
    setDetails((prev) => {
      const next = { ...prev, [id]: state }
      detailsRef.current = next
      return next
    })
  }, [])

  const loadDetail = useCallback(
    async (conf: ConferenceView, refresh = false) => {
      const current = detailsRef.current[conf.id]
      if (!refresh && (current?.status === 'ready' || current?.status === 'loading')) return
      setDetailState(conf.id, { status: 'loading' })
      const result = await enrichConferenceDetail(conf.id, { refresh })
      setDetailState(
        conf.id,
        result.ok
          ? { status: 'ready', detail: result.detail }
          : { status: 'error', message: result.message }
      )
    },
    [setDetailState]
  )

  useEffect(() => {
    detailsRef.current = details
  }, [details])

  useEffect(() => {
    if (!aiEnabled) return
    let cancelled = false
    const queue = data.conferences
      .filter((conf) => conf.detailStatus !== 'ready' || !conf.detail)
      .filter((conf) => !backgroundQueuedRef.current.has(conf.id))
      .sort((a, b) => detailPrefetchRank(a) - detailPrefetchRank(b))
      .slice(0, BACKGROUND_DETAIL_LIMIT)

    if (queue.length === 0) return
    for (const conf of queue) backgroundQueuedRef.current.add(conf.id)

    async function worker() {
      while (!cancelled) {
        const conf = queue.shift()
        if (!conf) return
        try {
          await loadDetail(conf)
        } catch (error) {
          console.error('[conferences] background detail prefetch failed', error)
        }
      }
    }

    void Promise.all(Array.from({ length: Math.min(BACKGROUND_DETAIL_CONCURRENCY, queue.length) }, () => worker()))
    return () => {
      cancelled = true
    }
  }, [aiEnabled, data.conferences, loadDetail])

  const handleSelect = useCallback(
    (conf: ConferenceView) => {
      setSelectedId(conf.id)
      if (aiEnabled) void loadDetail(conf)
    },
    [aiEnabled, loadDetail]
  )

  const handleShortlist = (conf: ConferenceView) => {
    startTransition(async () => {
      await addConferenceToShortlist(conf.id)
    })
  }
  const handleStage = (conf: ConferenceView, stage: ConferenceStage) => {
    startTransition(async () => {
      await setConferenceStage(conf.id, stage)
    })
  }
  const handleRemove = (conf: ConferenceView) => {
    startTransition(async () => {
      await removeConferenceFromPipeline(conf.id)
    })
  }

  return (
    <section className="flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Conferences</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Oncology conferences</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Saved oncology conference cache, refreshed nightly in the background. Shortlist the ones worth attending and track them through to follow-up.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <FindMoreDialog aiEnabled={aiEnabled} />
          {canRefreshCache && <RefreshControl run={run} aiEnabled={aiEnabled} />}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map(({ key, label }) => {
          const count = partitions[key].length
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'relative -mb-px rounded-t-lg px-4 py-2 text-sm font-semibold transition',
                active ? 'border border-b-white border-neutral-200 bg-white text-orange-700' : 'text-neutral-500 hover:text-neutral-800',
              ].join(' ')}
            >
              {label}
              <span className={['ml-2 rounded-full px-1.5 py-0.5 text-[11px]', active ? 'bg-orange-50 text-orange-700' : 'bg-neutral-100 text-neutral-500'].join(' ')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'upcoming' && (
        <FiltersBar data={data} conferences={partitions.upcoming} filters={filters} onChange={setFilters} resultCount={filteredUpcoming.length} />
      )}

      {/* Master-detail */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-h-[360px] pr-1 lg:h-full lg:min-h-0 lg:overflow-y-scroll">
          {visible.length === 0 ? (
            <EmptyState tab={tab} aiEnabled={aiEnabled} canRefreshCache={canRefreshCache} run={run} />
          ) : (
            <ul className="space-y-2">
              {visible.map((conf) => (
                <li key={conf.id}>
                  <ConferenceListItem conf={conf} active={conf.id === selectedId} onSelect={() => handleSelect(conf)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-[360px] lg:h-full lg:min-h-0 lg:overflow-y-scroll">
          <ConferenceDetailPane
            conf={selected}
            detail={selected ? details[selected.id] : undefined}
            aiEnabled={aiEnabled}
            pending={pending}
            onShortlist={handleShortlist}
            onStage={handleStage}
            onRemove={handleRemove}
            onRetryDetail={(conf) => void loadDetail(conf, true)}
          />
        </div>
      </div>
    </section>
  )
}

function RefreshControl({ run, aiEnabled }: { run: ReturnType<typeof useConferenceRun>; aiEnabled: boolean }) {
  if (!aiEnabled) {
    return <p className="text-xs text-neutral-400">AI discovery is disabled for this environment.</p>
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void run.start()}
        disabled={run.busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {run.running ? `Refreshing cache… ${run.elapsed}s` : run.starting ? 'Starting…' : 'Refresh cache'}
      </button>
      {run.running && <p className="text-xs text-neutral-400">Updating saved results in the background; the current list remains available.</p>}
      {!run.running && run.message && (
        <p className={['max-w-xs text-right text-xs', run.status === 'error' ? 'text-red-600' : 'text-neutral-500'].join(' ')}>{run.message}</p>
      )}
    </div>
  )
}

function FiltersBar({
  data,
  conferences,
  filters,
  onChange,
  resultCount,
}: {
  data: ConferencesData
  conferences: ConferenceView[]
  filters: ConferenceFilters
  onChange: (next: ConferenceFilters) => void
  resultCount: number
}) {
  const set = (patch: Partial<ConferenceFilters>) => onChange({ ...filters, ...patch })
  const regionLabels = useMemo(() => new Map(data.regions.map((r) => [r.value, r.label])), [data.regions])

  const regionOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const conf of filterConferences(conferences, { ...filters, region: 'all' })) {
      counts.set(conf.region, (counts.get(conf.region) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => (regionLabels.get(a[0] as never) ?? a[0]).localeCompare(regionLabels.get(b[0] as never) ?? b[0]))
      .map(([value, count]) => ({ value, label: `${regionLabels.get(value as never) ?? optionLabel(value)} (${count})` }))
  }, [conferences, filters, regionLabels])

  const focusOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const conf of filterConferences(conferences, { ...filters, focus: 'all' })) {
      if (!conf.mainFocus) continue
      counts.set(conf.mainFocus, (counts.get(conf.mainFocus) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: `${value} (${count})` }))
  }, [conferences, filters])

  const formatOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const conf of filterConferences(conferences, { ...filters, format: 'all' })) {
      counts.set(conf.format, (counts.get(conf.format) ?? 0) + 1)
    }
    return Object.entries(FORMAT_LABELS)
      .filter(([value]) => (counts.get(value) ?? 0) > 0)
      .map(([value, label]) => ({ value, label: `${label} (${counts.get(value) ?? 0})` }))
  }, [conferences, filters])

  useEffect(() => {
    const patch: Partial<ConferenceFilters> = {}
    if (filters.region && filters.region !== 'all' && !regionOptions.some((opt) => opt.value === filters.region)) patch.region = 'all'
    if (filters.focus && filters.focus !== 'all' && !focusOptions.some((opt) => opt.value === filters.focus)) patch.focus = 'all'
    if (filters.format && filters.format !== 'all' && !formatOptions.some((opt) => opt.value === filters.format)) patch.format = 'all'
    if (Object.keys(patch).length > 0) onChange({ ...filters, ...patch })
  }, [filters, focusOptions, formatOptions, onChange, regionOptions])

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <input
        type="search"
        value={filters.search ?? ''}
        onChange={(e) => set({ search: e.target.value })}
        placeholder="Search conferences…"
        className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
      />
      <Select
        label="Region"
        value={filters.region ?? 'all'}
        onChange={(v) => set({ region: v })}
        options={[{ value: 'all', label: 'All regions' }, ...regionOptions]}
      />
      {focusOptions.length > 0 && (
        <Select
          label="Focus"
          value={filters.focus ?? 'all'}
          onChange={(v) => set({ focus: v })}
          options={[{ value: 'all', label: 'All focuses' }, ...focusOptions]}
        />
      )}
      <Select
        label="Format"
        value={filters.format ?? 'all'}
        onChange={(v) => set({ format: v })}
        options={[{ value: 'all', label: 'Any format' }, ...formatOptions]}
      />
      <span className="ml-auto text-xs font-medium text-neutral-400">{resultCount} shown</span>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-semibold text-neutral-800 focus:border-orange-400 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ConferenceListItem({ conf, active, onSelect }: { conf: ConferenceView; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:border-neutral-300 hover:shadow',
        active ? 'border-orange-300 ring-1 ring-orange-200' : 'border-neutral-200',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={conf.regionLabel} tone="neutral" />
        {conf.mainFocus && <StatusBadge label={conf.mainFocus} tone="blue" />}
        {conf.tracking && <StatusBadge label={CONFERENCE_STAGE_LABELS[conf.tracking.stage]} tone={STAGE_TONES[conf.tracking.stage]} />}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-900">{conf.name}</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {formatDateRange(conf.startDate, conf.endDate)}
        {conf.location && <> · {conf.location}</>}
      </p>
    </button>
  )
}

function ConferenceDetailPane({
  conf,
  detail,
  aiEnabled,
  pending,
  onShortlist,
  onStage,
  onRemove,
  onRetryDetail,
}: {
  conf: ConferenceView | null
  detail: DetailState | undefined
  aiEnabled: boolean
  pending: boolean
  onShortlist: (conf: ConferenceView) => void
  onStage: (conf: ConferenceView, stage: ConferenceStage) => void
  onRemove: (conf: ConferenceView) => void
  onRetryDetail: (conf: ConferenceView) => void
}) {
  if (!conf) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">Select a conference to see the details.</p>
      </div>
    )
  }

  const d = detail?.detail
  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge label={conf.regionLabel} tone="neutral" />
          {conf.mainFocus && <StatusBadge label={conf.mainFocus} tone="blue" />}
          <StatusBadge label={FORMAT_LABELS[conf.format] ?? conf.format} tone="neutral" />
          {conf.tracking && <StatusBadge label={CONFERENCE_STAGE_LABELS[conf.tracking.stage]} tone={STAGE_TONES[conf.tracking.stage]} />}
        </div>
        <h2 className="text-lg font-semibold leading-snug text-neutral-900">{conf.name}</h2>
        <p className="text-sm text-neutral-500">
          {formatDateRange(conf.startDate, conf.endDate)}
          {conf.location && <> · {conf.location}</>}
          {conf.organizer && <> · {conf.organizer}</>}
        </p>
        <div className="flex flex-wrap gap-3">
          {conf.websiteUrl && (
            <a href={conf.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-orange-700 hover:underline">
              Official website ↗
            </a>
          )}
          {conf.sourceUrl && conf.sourceUrl !== conf.websiteUrl && (
            <a href={conf.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-neutral-500 hover:text-orange-700 hover:underline">
              Source ↗
            </a>
          )}
        </div>
      </div>

      {/* Pipeline actions */}
      <div className="flex flex-wrap items-center gap-2 border-y border-neutral-100 py-3">
        {!conf.tracking ? (
          <button
            type="button"
            onClick={() => onShortlist(conf)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
          >
            + Add to shortlist
          </button>
        ) : (
          <>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
              Stage
              <select
                value={conf.tracking.stage}
                onChange={(e) => onStage(conf, e.target.value as ConferenceStage)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-semibold text-neutral-800 focus:border-orange-400 focus:outline-none"
              >
                {CONFERENCE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {CONFERENCE_STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => onRemove(conf)} disabled={pending} className="text-xs font-semibold text-neutral-400 hover:text-red-600 disabled:opacity-60">
              Remove
            </button>
          </>
        )}
      </div>

      {conf.summary && <p className="text-sm leading-relaxed text-neutral-700">{conf.summary}</p>}

      {/* AI-enriched detail */}
      {!aiEnabled ? null : detail?.status === 'loading' ? (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
          <Spinner /> Gathering details…
        </div>
      ) : detail?.status === 'error' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <p>{detail.message ?? 'Could not gather more details.'}</p>
          <button type="button" onClick={() => onRetryDetail(conf)} className="mt-1 text-xs font-semibold text-amber-900 underline">
            Try again
          </button>
        </div>
      ) : d ? (
        <DetailBody detail={d} onRefresh={() => onRetryDetail(conf)} />
      ) : null}
    </div>
  )
}

function DetailBody({ detail, onRefresh }: { detail: ConferenceDetail; onRefresh: () => void }) {
  const hasRegistrationCosts = Boolean(
    detail.registration ||
      detail.registrationDeadline ||
      detail.earlyBirdDeadline ||
      detail.earlyBirdFees ||
      detail.regularDeadline ||
      detail.regularFees ||
      detail.fees
  )

  return (
    <div className="space-y-3 text-sm">
      {detail.overview && <p className="leading-relaxed text-neutral-700">{detail.overview}</p>}

      {detail.whyRelevant && (
        <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Why it matters for Inspire2Live</p>
          <p className="mt-0.5 text-sm text-neutral-700">{detail.whyRelevant}</p>
        </div>
      )}

      {detail.facts.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {detail.facts.map((fact, i) => (
            <div key={`${fact.label}-${i}`} className="flex flex-col">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{fact.label}</dt>
              <dd className="text-sm text-neutral-700">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {detail.keyTopics.length > 0 && (
        <Section title="Key topics">
          <div className="flex flex-wrap gap-1.5">
            {detail.keyTopics.map((topic) => (
              <span key={topic} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
                {topic}
              </span>
            ))}
          </div>
        </Section>
      )}

      {detail.notableSpeakers.length > 0 && (
        <Section title="Notable speakers">
          <p className="text-sm text-neutral-700">{detail.notableSpeakers.join(', ')}</p>
        </Section>
      )}

      {detail.audience && <Section title="Audience"><p className="text-sm text-neutral-700">{detail.audience}</p></Section>}

      {hasRegistrationCosts && (
        <Section title="Registration & costs">
          <div className="space-y-1.5">
            {detail.earlyBirdDeadline && <p className="text-sm text-neutral-700"><span className="font-semibold">Early-bird deadline:</span> {detail.earlyBirdDeadline}</p>}
            {detail.earlyBirdFees && <p className="text-sm text-neutral-700"><span className="font-semibold">Early-bird fees:</span> {detail.earlyBirdFees}</p>}
            {detail.regularDeadline && <p className="text-sm text-neutral-700"><span className="font-semibold">Regular deadline:</span> {detail.regularDeadline}</p>}
            {detail.regularFees && <p className="text-sm text-neutral-700"><span className="font-semibold">Regular fees:</span> {detail.regularFees}</p>}
            {detail.registrationDeadline && <p className="text-sm text-neutral-700"><span className="font-semibold">Registration deadline:</span> {detail.registrationDeadline}</p>}
            {detail.fees && <p className="text-sm text-neutral-700"><span className="font-semibold">Other fees:</span> {detail.fees}</p>}
            {detail.registration && <p className="text-sm text-neutral-700">{detail.registration}</p>}
          </div>
        </Section>
      )}

      {detail.links.length > 0 && (
        <Section title="Links">
          <ul className="space-y-0.5">
            {detail.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-orange-700 hover:underline">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button type="button" onClick={onRefresh} className="text-xs font-semibold text-neutral-400 hover:text-orange-700">
        ↻ Refresh details
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{title}</p>
      {children}
    </div>
  )
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-orange-500" aria-hidden="true" />
}

function EmptyState({
  tab,
  aiEnabled,
  canRefreshCache,
  run,
}: {
  tab: ConferenceTab
  aiEnabled: boolean
  canRefreshCache: boolean
  run: ReturnType<typeof useConferenceRun>
}) {
  if (tab === 'upcoming') {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-semibold text-neutral-700">No upcoming conferences saved yet.</p>
        <p className="mt-1 text-sm text-neutral-400">
          {aiEnabled ? 'Start a background cache refresh to collect upcoming oncology conferences.' : 'AI discovery is disabled for this environment.'}
        </p>
        {aiEnabled && canRefreshCache && (
          <button
            type="button"
            onClick={() => void run.start()}
            disabled={run.busy}
            className="mt-3 inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {run.running ? `Refreshing cache… ${run.elapsed}s` : 'Refresh cache'}
          </button>
        )}
      </div>
    )
  }
  const messages: Record<Exclude<ConferenceTab, 'upcoming'>, string> = {
    intended: 'Nothing marked as intended yet. Add conferences you intend to visit from the Upcoming tab.',
    registered: 'No registered conferences. Move an intended conference to Registered to start tracking it.',
    ongoing: 'No conferences are ongoing right now.',
    follow_up: 'No conferences awaiting follow-up.',
    archived: 'No archived conferences yet.',
  }
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <p className="text-sm text-neutral-400">{messages[tab as Exclude<ConferenceTab, 'upcoming'>]}</p>
    </div>
  )
}
