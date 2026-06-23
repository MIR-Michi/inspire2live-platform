import Link from 'next/link'
import { EventCreateForm } from '@/components/comms/event-create-form'
import { NavSelect, type NavSelectOption } from '@/components/comms/nav-select'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  formatTokenLabel,
  getEventSetupContent,
  getEventTypeLabel,
  isI2LOwnedEvent,
} from '@/lib/comms-events'
import { EVENT_STAGE_META, type EventStage } from '@/lib/comms-workflow'

type EventCard = {
  id: string
  name: string
  event_type: string
  start_date: string
  end_date: string | null
  location_city: string | null
  location_country: string | null
  organiser: string | null
  ownerLabel: string | null
  stage: string
  is_annual_congress: boolean
  is_i2l_organised: boolean
  attendance_kind: string
  presentation_summary: string | null
  presentation_asset_url: string | null
  event_image_url: string | null
  event_website_url: string | null
  push_to_group_calendar: boolean
  initiativeLabels: string[]
  representativeLabels: string[]
  outputs: Array<{ label: string; done: boolean }>
}

type Option = { id: string; label: string }

const SCOPE_FILTERS: Array<{ key: 'all' | 'i2l' | 'networking' | 'past'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'i2l', label: 'I2L own' },
  { key: 'networking', label: 'Networking' },
  { key: 'past', label: 'Past' },
]

const STAGE_FILTERS: Array<{ key: 'all' | EventStage; label: string }> = [
  { key: 'all', label: 'All stages' },
  { key: 'announced', label: 'Announced' },
  { key: 'attending', label: 'Attending' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'post_event', label: 'Post-event' },
  { key: 'archived', label: 'Archived' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value)
  )
}

function formatDateRange(startDate: string, endDate: string | null) {
  if (!endDate || endDate === startDate) return formatDate(startDate)
  const startFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(startDate)
  )
  return `${startFmt} – ${formatDate(endDate)}`
}

function OutputDots({ outputs }: { outputs: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Output status">
      {outputs.map((output) => (
        <span
          key={output.label}
          title={`${output.label}: ${output.done ? 'done' : 'pending'}`}
          className={`h-2 w-2 rounded-full ${output.done ? 'bg-emerald-500' : 'bg-neutral-200'}`}
        />
      ))}
    </div>
  )
}

export function EventsPipelineShell({
  events,
  stageFilter,
  scopeFilter,
  eventTypeFilter,
  eventTypes,
  initiatives,
  people,
  title = 'Events',
  eyebrow,
  recordLabel = 'events',
  basePath = '/app/comms/events',
  showScopeFilters = true,
  showEventTypeFilters = true,
}: {
  events: EventCard[]
  stageFilter: 'all' | EventStage
  scopeFilter: 'all' | 'i2l' | 'networking' | 'past'
  eventTypeFilter: string
  eventTypes: string[]
  initiatives: Option[]
  people: Option[]
  title?: string
  eyebrow?: string
  description?: string
  recordLabel?: string
  basePath?: string
  showScopeFilters?: boolean
  showEventTypeFilters?: boolean
}) {
  function buildHref(overrides: {
    scope?: string
    stage?: string
    event_type?: string
  }) {
    const params = new URLSearchParams()
    const resolvedScope = overrides.scope !== undefined ? overrides.scope : scopeFilter
    const resolvedStage = overrides.stage !== undefined ? overrides.stage : stageFilter
    const resolvedType = overrides.event_type !== undefined ? overrides.event_type : eventTypeFilter
    if (resolvedScope !== 'all') params.set('scope', resolvedScope)
    if (resolvedStage !== 'all') params.set('stage', resolvedStage)
    if (resolvedType !== 'all') params.set('event_type', resolvedType)
    return params.size > 0 ? `${basePath}?${params}` : basePath
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">{eyebrow}</p>
          )}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-sm font-semibold text-orange-700">
              {events.length} {recordLabel}
            </span>
          </div>
        </div>

        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            <span className="text-base leading-none">+</span> Add event
          </summary>
          <div className="absolute right-0 top-full z-40 mt-2 w-[min(680px,95vw)] rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-neutral-900">New event</h3>
            <EventCreateForm initiatives={initiatives} people={people} />
          </div>
        </details>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        {showScopeFilters && (
          <NavSelect
            label="Scope"
            value={scopeFilter}
            options={SCOPE_FILTERS.map<NavSelectOption>((item) => ({
              value: item.key,
              label: item.label,
              href: buildHref({ scope: item.key, stage: 'all' }),
            }))}
          />
        )}

        {showScopeFilters && showEventTypeFilters && eventTypes.length > 1 && (
          <NavSelect
            label="Type"
            value={eventTypeFilter}
            options={[
              { value: 'all', label: 'All types', href: buildHref({ event_type: 'all' }) },
              ...eventTypes.map<NavSelectOption>((et) => ({
                value: et,
                label: getEventTypeLabel(et),
                href: buildHref({ event_type: et }),
              })),
            ]}
          />
        )}

        <NavSelect
          label="Stage"
          value={stageFilter}
          options={STAGE_FILTERS.map<NavSelectOption>((item) => ({
            value: item.key,
            label: item.label,
            href: buildHref({ stage: item.key }),
          }))}
        />
      </div>

      {events.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-neutral-700">No events match this filter.</p>
          <p className="mt-1 text-sm text-neutral-400">Try a different stage or scope.</p>
        </div>
      )}

      <ul className="space-y-2">
        {events.map((event) => {
          const effectiveOwned = isI2LOwnedEvent({
            eventType: event.event_type,
            isI2lOrganised: event.is_i2l_organised,
            isAnnualCongress: event.is_annual_congress,
          })
          const setup = getEventSetupContent({
            eventType: event.event_type,
            isI2lOrganised: effectiveOwned,
            isAnnualCongress: event.is_annual_congress,
          })
          const stageMeta = EVENT_STAGE_META[event.stage as EventStage]
          const location = [event.location_city, event.location_country].filter(Boolean).join(', ')

          // Secondary context line: who owns or attends
          let involvementLine: string | null = null
          if (effectiveOwned && event.ownerLabel) {
            involvementLine = `Owner: ${event.ownerLabel}`
          } else if (!effectiveOwned && event.representativeLabels.length > 0) {
            const names = event.representativeLabels.join(', ')
            const role = formatTokenLabel(event.attendance_kind)
            involvementLine = `${role}: ${names}`
          } else if (!effectiveOwned && setup.attendeeEmptyLabel) {
            involvementLine = 'No I2L attendees assigned yet'
          }

          return (
            <li key={event.id}>
              <article className="group flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-neutral-300 hover:shadow">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stageMeta && (
                      <StatusBadge label={stageMeta.label} tone={stageMeta.tone} />
                    )}
                    <StatusBadge label={getEventTypeLabel(event.event_type)} tone="blue" />
                    {effectiveOwned && (
                      <StatusBadge label="I2L own" tone="green" />
                    )}
                    {event.is_annual_congress && (
                      <StatusBadge label="Congress" tone="violet" />
                    )}
                  </div>

                  <Link
                    href={`${basePath}/${event.id}`}
                    className="block text-[15px] font-semibold leading-snug text-neutral-900 hover:text-orange-700"
                  >
                    {event.name}
                  </Link>

                  <p className="text-xs text-neutral-500">
                    {formatDateRange(event.start_date, event.end_date)}
                    {location && <> · {location}</>}
                    {event.organiser && !effectiveOwned && <> · {event.organiser}</>}
                  </p>

                  {involvementLine && (
                    <p className="text-xs font-medium text-neutral-600">{involvementLine}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                  <Link
                    href={`${basePath}/${event.id}`}
                    className="text-xs font-semibold text-neutral-400 hover:text-orange-700"
                    aria-label={`Open ${event.name}`}
                  >
                    Open →
                  </Link>
                  <OutputDots outputs={event.outputs} />
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
