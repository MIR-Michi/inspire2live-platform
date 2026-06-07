import Link from 'next/link'
import { EventCreateForm } from '@/components/comms/event-create-form'
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

const EVENT_FILTERS: Array<{ key: 'all' | EventStage; label: string }> = [
  { key: 'all', label: 'All stages' },
  { key: 'announced', label: 'Announced' },
  { key: 'attending', label: 'Attending' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'post_event', label: 'Post-event' },
  { key: 'archived', label: 'Archived' },
]

const EVENT_SCOPE_FILTERS: Array<{ key: 'all' | 'i2l' | 'networking' | 'past'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'i2l', label: 'I2L own' },
  { key: 'networking', label: 'Networking' },
  { key: 'past', label: 'Past' },
]

function formatDateRange(startDate: string, endDate: string | null) {
  const formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
  if (!endDate || endDate === startDate) return formatter.format(new Date(startDate))
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`
}

function formatLocation(city: string | null, country: string | null) {
  return [city, country].filter(Boolean).join(', ') || 'Location TBD'
}

export function EventsPipelineShell({
  events,
  stageFilter,
  scopeFilter,
  eventTypeFilter,
  eventTypes,
  initiatives,
  people,
  title = 'Event pipeline',
  eyebrow = 'Full routing',
  description = 'Track I2L-owned productions separately from external attendance while keeping congress links visible.',
  recordLabel = 'records',
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
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">{eyebrow}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              {events.length} {recordLabel}
            </span>
          </div>
          <p className="text-sm text-neutral-600">{description}</p>
        </div>
      </header>

      <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-base font-semibold text-neutral-900">
          Create event
        </summary>
        <EventCreateForm initiatives={initiatives} people={people} />
      </details>

      {showScopeFilters && (
        <nav className="flex flex-wrap gap-2" aria-label="Event ownership filters">
          {EVENT_SCOPE_FILTERS.map((item) => {
            const isActive = item.key === scopeFilter
            return (
              <Link
                key={item.key}
                href={item.key === 'all' ? basePath : `${basePath}?scope=${item.key}`}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                  isActive ? 'bg-orange-100 text-orange-800' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Event stage filters">
        {EVENT_FILTERS.map((item) => {
          const isActive = item.key === stageFilter
          const params = new URLSearchParams()
          if (showScopeFilters && scopeFilter !== 'all') params.set('scope', scopeFilter)
          if (item.key !== 'all') params.set('stage', item.key)
          if (showEventTypeFilters && eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter)
          const href = params.size > 0 ? `${basePath}?${params.toString()}` : basePath
          return (
            <Link
              key={item.key}
              href={href}
              className={[
                'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                isActive ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {showEventTypeFilters && eventTypes.length > 0 && (
        <nav className="flex flex-wrap gap-2" aria-label="Event type filters">
          <Link
            href={scopeFilter === 'all' ? basePath : `${basePath}?scope=${scopeFilter}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${eventTypeFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
          >
            All types
          </Link>
          {eventTypes.map((eventType) => (
            <Link
              key={eventType}
              href={`${basePath}?${new URLSearchParams([
                ...(scopeFilter === 'all' ? [] : [['scope', scopeFilter]]),
                ['event_type', eventType],
              ]).toString()}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${eventTypeFilter === eventType ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
            >
              {getEventTypeLabel(eventType)}
            </Link>
          ))}
        </nav>
      )}

      <div className="space-y-4">
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

          return (
            <article key={event.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={EVENT_STAGE_META[event.stage as EventStage]?.label ?? event.stage} tone={EVENT_STAGE_META[event.stage as EventStage]?.tone ?? 'neutral'} />
                    <StatusBadge label={getEventTypeLabel(event.event_type)} tone="blue" />
                    <StatusBadge label={effectiveOwned ? 'I2L own' : 'Networking'} tone={effectiveOwned ? 'green' : 'neutral'} />
                    {event.is_annual_congress && <StatusBadge label="Annual Congress" tone="violet" />}
                  </div>
                  <div>
                    <Link href={`/app/comms/events/${event.id}`} className="text-lg font-semibold text-neutral-900 hover:text-orange-700">
                      {event.name}
                    </Link>
                    <p className="text-sm text-neutral-500">{formatDateRange(event.start_date, event.end_date)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-700">
                      {formatLocation(event.location_city, event.location_country)}
                    </span>
                    {event.organiser && (
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-700">
                        {setup.organiserLabel}: {event.organiser}
                      </span>
                    )}
                    {event.ownerLabel && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                        Owner: {event.ownerLabel}
                      </span>
                    )}
                    {setup.attendeeChipPrefix && event.representativeLabels.map((rep) => (
                      <span key={rep} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                        {setup.attendeeChipPrefix}: {rep}
                      </span>
                    ))}
                    {setup.attendeeEmptyLabel && event.representativeLabels.length === 0 && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                        {setup.attendeeEmptyLabel}
                      </span>
                    )}
                    {setup.attendanceKindLabel && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                        Kind: {formatTokenLabel(event.attendance_kind)}
                      </span>
                    )}
                    {event.initiativeLabels.map((initiative) => (
                      <span key={initiative} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-700">
                        {initiative}
                      </span>
                    ))}
                    {event.push_to_group_calendar && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                        Group calendar
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {event.event_website_url && (
                    <a
                      href={event.event_website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
                    >
                      {setup.websiteLabel}
                    </a>
                  )}
                  <Link
                    href={`/app/comms/events/${event.id}`}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    Open detail
                  </Link>
                </div>
              </div>

              {(event.event_image_url || event.presentation_summary || event.presentation_asset_url) && (
                <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
                  {event.event_image_url && (
                    <div
                      aria-label="Event image"
                      className="h-28 w-full rounded-xl border border-neutral-200 bg-cover bg-center"
                      style={{ backgroundImage: `url(${event.event_image_url})` }}
                    />
                  )}
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{setup.summaryLabel}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-neutral-700">
                      {event.presentation_summary || (setup.attendanceKindLabel && event.attendance_kind === 'presenter' ? 'Presenter summary still needed.' : 'No summary captured yet.')}
                    </p>
                    {event.presentation_asset_url && (
                      <a href={event.presentation_asset_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-900">
                        Open {setup.assetLabel.toLowerCase()}
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {event.outputs.map((output) => (
                  <div key={output.label} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{output.label}</p>
                    <p className={`mt-1 text-sm font-semibold ${output.done ? 'text-emerald-700' : 'text-neutral-500'}`}>
                      {output.done ? 'Done' : 'Pending'}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
