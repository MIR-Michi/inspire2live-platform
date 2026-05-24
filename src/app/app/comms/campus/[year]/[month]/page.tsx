import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function monthBounds(year: string, month: string) {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const safeYear = Number.isFinite(numericYear) ? numericYear : new Date().getFullYear()
  const safeMonth = Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12 ? numericMonth : new Date().getMonth() + 1
  const start = new Date(safeYear, safeMonth - 1, 1)
  const end = new Date(safeYear, safeMonth, 1)
  return { start, end }
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date)
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function typeLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function categoryFor(value: string) {
  if (value === 'article_share') return 'Articles and research'
  if (value === 'media_request') return 'Media'
  if (value === 'member_intro') return 'Members'
  return 'Other incoming'
}

const FILTERS = ['All', 'Articles', 'Media', 'LinkedIn', 'Sessions', 'Members', 'Social']

export default async function CampusMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const { year, month } = await params
  const { start, end } = monthBounds(year, month)
  const startDate = dateOnly(start)
  const endDate = dateOnly(end)
  const supabase = await createClient()

  const [{ data: intakeItems }, { data: sessions }, { data: members }] = await Promise.all([
    supabase
      .from('intake_items')
      .select('id, sender_name, content_type, raw_content, status, captured_at')
      .gte('captured_at', start.toISOString())
      .lt('captured_at', end.toISOString())
      .order('captured_at', { ascending: false }),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary, action_items_for_publication')
      .gte('session_date', startDate)
      .lt('session_date', endDate)
      .order('session_date', { ascending: false }),
    supabase
      .from('campus_members')
      .select('id, name, country, organisation, date_welcomed, notes')
      .gte('date_welcomed', startDate)
      .lt('date_welcomed', endDate)
      .order('date_welcomed', { ascending: false }),
  ])

  const incomingItems = intakeItems ?? []
  const groupedIncoming = incomingItems.reduce<Record<string, typeof incomingItems>>((groups, item) => {
    const category = categoryFor(item.content_type)
    groups[category] = [...(groups[category] ?? []), item]
    return groups
  }, {})

  const meetingTitle = `${formatMonth(start)} meeting`
  const primarySession = sessions?.[0]
  const agendaItems = [
    ...(primarySession?.action_items_for_publication ?? []),
    ...incomingItems.slice(0, 3).map((item) => item.raw_content.slice(0, 96)),
  ].filter(Boolean)
  const decisions = (sessions ?? []).flatMap((session) => session.summary ? [session.summary] : [])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="grid gap-3 border-b border-neutral-200 pb-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <Link href="/app/comms/campus" className="rounded-lg border border-blue-900 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
          &lt;- Campus
        </Link>
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-neutral-900">{meetingTitle}</h1>
          <p className="text-sm text-neutral-500">
            {primarySession?.theme || 'Last Wednesday of the month'} - briefing workspace
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="#raw-feed" className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
            View raw feed
          </a>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Saved</span>
        </div>
      </header>

      <div className="grid min-h-[720px] overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border-r border-neutral-200">
          <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Incoming this month</h2>
              <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white">{incomingItems.length}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((filter, index) => (
                <span
                  key={filter}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${index === 0 ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white text-neutral-950'}`}
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>

          <div id="raw-feed" className="max-h-[680px] space-y-5 overflow-y-auto px-5 py-4">
            {Object.entries(groupedIncoming).map(([category, items]) => (
              <section key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">{category}</h3>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{items.length}</span>
                </div>
                {items.map((item) => (
                  <article key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{typeLabel(item.content_type)}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{item.status}</span>
                      </div>
                      <p className="text-xs font-medium text-neutral-500">{item.sender_name} - {formatDate(item.captured_at)}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-950">{item.raw_content.slice(0, 90)}</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">{item.raw_content}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white">Route</span>
                        <span className="rounded-lg bg-blue-900 px-3 py-1 text-xs font-semibold text-white">+ Agenda</span>
                        <span className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">+ Summary</span>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ))}

            {incomingItems.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                No incoming feed items captured for this month.
              </p>
            )}
          </div>
        </section>

        <aside className="bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Meeting briefing</h2>
            <div className="flex gap-2">
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">Export</span>
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Share to Teams</span>
            </div>
          </div>

          <div className="max-h-[680px] space-y-4 overflow-y-auto px-5 py-4">
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">What happened this month</h3>
                <span className="text-xs font-bold uppercase text-blue-900">Edit</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-900">
                {primarySession?.summary ||
                  incomingItems.slice(0, 3).map((item) => `${item.sender_name} shared ${typeLabel(item.content_type)}`).join('. ') ||
                  'Briefing summary will be built from routed intake, session notes, and member welcomes.'}
              </p>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">What happened - {formatMonth(start)}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {incomingItems.length + (members?.length ?? 0)} items
                </span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {incomingItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    {item.sender_name} shared {typeLabel(item.content_type)} - {item.raw_content.slice(0, 88)}
                  </li>
                ))}
                {(members ?? []).slice(0, 3).map((member) => (
                  <li key={member.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    Welcome {member.name}{member.country ? ` from ${member.country}` : ''}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">Agenda</h3>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{agendaItems.length} items</span>
              </div>
              <ol className="divide-y divide-neutral-100">
                {agendaItems.slice(0, 6).map((item, index) => (
                  <li key={`${item}-${index}`} className="grid grid-cols-[24px_1fr] gap-3 px-4 py-3 text-sm leading-5 text-neutral-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-900">Decisions</h3>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{decisions.length} decisions</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {decisions.slice(0, 5).map((decision, index) => (
                  <li key={`${decision}-${index}`} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    {decision}
                  </li>
                ))}
                {decisions.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-neutral-500">No decisions captured yet.</li>
                )}
              </ul>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
