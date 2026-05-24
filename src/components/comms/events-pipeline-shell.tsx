import Link from 'next/link'
import { createEvent } from '@/app/app/comms/events/actions'
import { StatusBadge } from '@/components/ui/status-badge'
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
  stage: string
  is_annual_congress: boolean
  is_i2l_organised: boolean
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
}: {
  events: EventCard[]
  stageFilter: 'all' | EventStage
  scopeFilter: 'all' | 'i2l' | 'networking' | 'past'
  eventTypeFilter: string
  eventTypes: string[]
  initiatives: Option[]
}) {
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Full routing</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">Event pipeline</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              {events.length} records
            </span>
          </div>
          <p className="text-sm text-neutral-600">
            Track I2L-organised events separately from networking attendance while keeping congress links visible.
          </p>
        </div>
      </header>

      <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-base font-semibold text-neutral-900">
          Create event
        </summary>
        <form action={createEvent} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-neutral-800">Event name</span>
            <input name="name" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Event type</span>
            <select name="event_type" defaultValue="conference" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              {['conference', 'workshop', 'congress', 'symposium', 'webinar', 'other'].map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Start date</span>
            <input type="date" name="start_date" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">End date</span>
            <input type="date" name="end_date" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Organiser</span>
            <input name="organiser" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">City</span>
            <input name="location_city" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Country</span>
            <input name="location_country" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-900">
            <input type="checkbox" name="is_annual_congress" value="true" />
            Annual Congress event
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            <input type="checkbox" name="is_i2l_organised" value="true" />
            I2L-organised event
          </label>

          {initiatives.length > 0 && (
            <div className="md:col-span-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-800">Reference initiatives</p>
              <p className="mt-1 text-xs text-neutral-500">
                Linkage happens on the detail page, but these are the current initiatives available for follow-up.
              </p>
            </div>
          )}

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-neutral-800">Notes</span>
            <textarea name="notes" rows={4} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700">
              Create event
            </button>
          </div>
        </form>
      </details>

      <nav className="flex flex-wrap gap-2" aria-label="Event ownership filters">
        {EVENT_SCOPE_FILTERS.map((item) => {
          const isActive = item.key === scopeFilter
          return (
            <Link
              key={item.key}
              href={item.key === 'all' ? '/app/comms/events' : `/app/comms/events?scope=${item.key}`}
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

      <nav className="flex flex-wrap gap-2" aria-label="Event stage filters">
        {EVENT_FILTERS.map((item) => {
          const isActive = item.key === stageFilter
          return (
            <Link
              key={item.key}
              href={item.key === 'all' ? `/app/comms/events?scope=${scopeFilter}` : `/app/comms/events?scope=${scopeFilter}&stage=${item.key}`}
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

      {eventTypes.length > 0 && (
        <nav className="flex flex-wrap gap-2" aria-label="Event type filters">
          <Link
            href={`/app/comms/events?scope=${scopeFilter}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${eventTypeFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
          >
            All types
          </Link>
          {eventTypes.map((eventType) => (
            <Link
              key={eventType}
              href={`/app/comms/events?scope=${scopeFilter}&event_type=${eventType}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${eventTypeFilter === eventType ? 'bg-blue-100 text-blue-800' : 'border border-neutral-200 bg-white text-neutral-700'}`}
            >
              {eventType}
            </Link>
          ))}
        </nav>
      )}

      <div className="space-y-4">
        {events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={EVENT_STAGE_META[event.stage as EventStage]?.label ?? event.stage} tone={EVENT_STAGE_META[event.stage as EventStage]?.tone ?? 'neutral'} />
                  <StatusBadge label={event.event_type} tone="blue" />
                  <StatusBadge label={event.is_i2l_organised || event.is_annual_congress ? 'I2L own' : 'Networking'} tone={event.is_i2l_organised || event.is_annual_congress ? 'green' : 'neutral'} />
                  {event.is_annual_congress && <StatusBadge label="Annual Congress" tone="violet" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{event.name}</h3>
                  <p className="text-sm text-neutral-500">{formatDateRange(event.start_date, event.end_date)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-700">
                    {formatLocation(event.location_city, event.location_country)}
                  </span>
                  {event.organiser && (
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-700">
                      Organiser: {event.organiser}
                    </span>
                  )}
                  {event.representativeLabels.map((rep) => (
                    <span key={rep} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                      Rep: {rep}
                    </span>
                  ))}
                  {event.initiativeLabels.map((initiative) => (
                    <span key={initiative} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-700">
                      {initiative}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={`/app/comms/events/${event.id}`}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
              >
                Open detail
              </Link>
            </div>

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
        ))}
      </div>
    </section>
  )
}
