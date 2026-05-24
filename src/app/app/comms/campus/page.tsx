import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCampusSession } from '@/app/app/comms/campus-log/actions'

function monthKey(value: string) {
  return value.slice(0, 7)
}

function formatMonth(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function lastWednesdayLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month, 0)
  while (date.getDay() !== 3) date.setDate(date.getDate() - 1)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

function formatMeetingTitle(key: string) {
  return `${formatMonth(key)} - ${lastWednesdayLabel(key)}`
}

function formatMemberMeta(member: { organisation: string | null; country: string | null; date_welcomed: string | null }) {
  const parts = [member.organisation, member.country].filter(Boolean)
  if (member.date_welcomed) {
    parts.push(`Welcomed ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(member.date_welcomed))}`)
  }
  return parts.join(' - ') || 'Campus member'
}

export default async function CommsCampusPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeTab = params.tab === 'members' ? 'members' : 'meetings'
  const supabase = await createClient()
  const [{ data: sessions }, { data: intakeItems }, { data: members }] = await Promise.all([
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary')
      .order('session_date', { ascending: false })
      .limit(12),
    supabase
      .from('intake_items')
      .select('id, status, content_type, captured_at, raw_content')
      .neq('status', 'dismissed')
      .order('captured_at', { ascending: false })
      .limit(100),
    supabase
      .from('campus_members')
      .select('id, name, country, organisation, role_description, date_welcomed')
      .order('date_welcomed', { ascending: false })
      .order('name')
      .limit(80),
  ])

  const monthKeys = new Set<string>([currentMonthKey()])
  for (const session of sessions ?? []) monthKeys.add(monthKey(session.session_date))
  for (const item of intakeItems ?? []) monthKeys.add(monthKey(item.captured_at))
  for (const member of members ?? []) {
    if (member.date_welcomed) monthKeys.add(monthKey(member.date_welcomed))
  }

  const currentKey = currentMonthKey()
  const cards = Array.from(monthKeys)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 8)
    .map((key) => {
      const monthSessions = (sessions ?? []).filter((session) => monthKey(session.session_date) === key)
      const monthIntake = (intakeItems ?? []).filter((item) => monthKey(item.captured_at) === key)
      const unreviewedCount = monthIntake.filter((item) => item.status === 'unreviewed').length
      const articleCount = monthIntake.filter((item) => item.content_type === 'article_share').length
      const mediaCount = monthIntake.filter((item) => item.content_type === 'media_asset').length
      const memberCount = (members ?? []).filter((member) => member.date_welcomed && monthKey(member.date_welcomed) === key).length
      const latestSession = monthSessions[0]
      const [year, month] = key.split('-')
      return {
        key,
        year,
        month,
        monthSessions,
        intakeCount: monthIntake.length,
        unreviewedCount,
        articleCount,
        mediaCount,
        memberCount,
        latestSession,
      }
    })

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Campus</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Saved</span>
          <details className="relative">
            <summary className="list-none rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
              + New meeting
            </summary>
            <form action={createCampusSession} className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Meeting date</span>
                <input type="date" name="session_date" required className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Theme</span>
                <input name="theme" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Summary</span>
                <textarea name="summary" rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </label>
              <button type="submit" className="w-full rounded-lg bg-neutral-950 px-3 py-2 text-sm font-semibold text-white">
                Create meeting
              </button>
            </form>
          </details>
        </div>
      </header>

      <nav className="flex gap-4 border-b border-neutral-200">
        <Link
          href="/app/comms/campus"
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'meetings' ? 'border-orange-600 text-orange-700' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
        >
          Monthly meetings
        </Link>
        <Link
          href="/app/comms/campus?tab=members"
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'members' ? 'border-orange-600 text-orange-700' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
        >
          Members
        </Link>
      </nav>

      {activeTab === 'meetings' ? (
        <div className="space-y-4">
          {cards.map((card) => {
            const isCurrent = card.key === currentKey
            const isPast = card.key < currentKey
            return (
              <Link
                key={card.key}
                href={`/app/comms/campus/${card.year}/${card.month}`}
                className={[
                  'block overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-orange-300',
                  isCurrent ? 'border-blue-900 ring-1 ring-blue-900' : 'border-neutral-200',
                ].join(' ')}
              >
                <div className={isCurrent ? 'bg-blue-900 px-5 py-4 text-white' : 'bg-neutral-50 px-5 py-4 text-neutral-900'}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isCurrent ? 'text-blue-200' : 'text-neutral-400'}`}>
                        {isPast ? 'Past meeting' : 'Next meeting'}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">{formatMeetingTitle(card.key)}</h2>
                    </div>
                    {card.unreviewedCount > 0 ? (
                      <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
                        {card.unreviewedCount} incoming items
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {isPast ? 'Completed' : 'Ready'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <p className="text-sm leading-5 text-neutral-700">
                    {card.latestSession?.summary ||
                      card.latestSession?.theme ||
                      'Agenda building in progress from current-month intake, welcomes, and campus session notes.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">{card.articleCount} articles</span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">{card.mediaCount} media</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">{card.monthSessions.length} sessions</span>
                    <span className="pl-2 font-semibold text-blue-900">Open -&gt;</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {(members ?? []).map((member) => (
            <Link
              key={member.id}
              href={`/app/comms/campus-log/members/${member.id}`}
              className="block rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm hover:border-orange-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{member.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{formatMemberMeta(member)}</p>
                </div>
                <span className="text-sm font-semibold text-blue-900">Open -&gt;</span>
              </div>
              {member.role_description && <p className="mt-3 text-sm leading-6 text-neutral-600">{member.role_description}</p>}
            </Link>
          ))}
          {(members ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
              No campus members are recorded yet.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
