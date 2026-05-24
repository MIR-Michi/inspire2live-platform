import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const TABS = [
  { key: 'events', label: 'By event' },
  { key: 'topics', label: 'By topic' },
  { key: 'people', label: 'People' },
  { key: 'general', label: 'General' },
] as const

function matchesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

export default async function CommsLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeTab = TABS.some((tab) => tab.key === params.tab) ? params.tab! : 'events'
  const query = params.q?.trim().toLowerCase() ?? ''
  const supabase = await createClient()

  const [{ data: assets }, { data: eventsWithOwnership, error: eventsWithOwnershipError }, { data: members }, { data: calendarEntries }] = await Promise.all([
    supabase
      .from('media_assets')
      .select('id, title, asset_type, rights_status, tags, event_id, session_id, created_at')
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('events')
      .select('id, name, event_type, start_date, is_annual_congress, is_i2l_organised')
      .order('start_date', { ascending: false })
      .limit(40),
    supabase
      .from('campus_members')
      .select('id, name, country, organisation, role_description, date_welcomed')
      .order('name')
      .limit(80),
    supabase
      .from('content_calendar')
      .select('id, title, status, tags, channels, source_event_id, scheduled_at')
      .neq('status', 'draft')
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .limit(80),
  ])
  let events = eventsWithOwnership
  if (eventsWithOwnershipError) {
    const { data: fallbackEvents } = await supabase
      .from('events')
      .select('id, name, event_type, start_date, is_annual_congress')
      .order('start_date', { ascending: false })
      .limit(40)
    events = (fallbackEvents ?? []).map((event) => ({ ...event, is_i2l_organised: false }))
  }

  const eventMap = new Map((events ?? []).map((event) => [event.id, event.name]))
  const visibleAssets = (assets ?? []).filter((asset) =>
    matchesQuery([asset.title, asset.asset_type, asset.rights_status, ...(asset.tags ?? []), asset.event_id ? eventMap.get(asset.event_id) : null], query)
  )
  const visibleEntries = (calendarEntries ?? []).filter((entry) =>
    matchesQuery([entry.title, entry.status, ...(entry.tags ?? []), ...(entry.channels ?? []), entry.source_event_id ? eventMap.get(entry.source_event_id) : null], query)
  )
  const visibleEvents = (events ?? []).filter((event) =>
    matchesQuery([event.name, event.event_type], query)
  )
  const visibleMembers = (members ?? []).filter((member) =>
    matchesQuery([member.name, member.country, member.organisation, member.role_description], query)
  )

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Library</p>
          <h2 className="text-2xl font-semibold text-neutral-900">Routed content and media</h2>
          <p className="max-w-3xl text-sm text-neutral-600">
            Search reviewed calendar content, approved media records, events, and people. Unreviewed intake remains in the intake queue.
          </p>
        </div>
        <Link href="/app/comms/media" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Open media tools
        </Link>
      </header>

      <form className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="tab" value={activeTab} />
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Search library</span>
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search assets, keywords, events, people, or channels"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
      </form>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/app/comms/library?tab=${tab.key}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${activeTab === tab.key ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'events' && (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleEvents.map((event) => (
            <Link key={event.id} href={`/app/comms/events/${event.id}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-orange-300">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">{event.event_type}</p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950">{event.name}</h3>
              <p className="mt-2 text-sm text-neutral-500">{event.start_date} · {event.is_annual_congress || event.is_i2l_organised ? 'I2L own' : 'Networking'}</p>
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...visibleAssets, ...visibleEntries].map((item) => (
            <article key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{'asset_type' in item ? item.asset_type : item.status}</p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950">{item.title}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'people' && (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleMembers.map((member) => (
            <article key={member.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-950">{member.name}</h3>
              <p className="mt-1 text-sm text-neutral-500">{[member.organisation, member.country].filter(Boolean).join(', ') || 'No organisation or country recorded'}</p>
              {member.role_description && <p className="mt-3 text-sm leading-6 text-neutral-600">{member.role_description}</p>}
            </article>
          ))}
        </div>
      )}

      {activeTab === 'general' && (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleAssets.map((asset) => (
            <article key={asset.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">{asset.rights_status}</p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950">{asset.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{asset.event_id ? eventMap.get(asset.event_id) ?? 'Linked event' : 'General library item'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
