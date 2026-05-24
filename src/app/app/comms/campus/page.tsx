import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

export default async function CommsCampusPage() {
  const supabase = await createClient()
  const [{ data: sessions }, { data: intakeItems }, { data: members }] = await Promise.all([
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary')
      .order('session_date', { ascending: false })
      .limit(12),
    supabase
      .from('intake_items')
      .select('id, status, captured_at')
      .neq('status', 'dismissed')
      .order('captured_at', { ascending: false })
      .limit(80),
    supabase
      .from('campus_members')
      .select('id, name, country, date_welcomed')
      .order('date_welcomed', { ascending: false })
      .limit(40),
  ])

  const monthKeys = new Set<string>([currentMonthKey()])
  for (const session of sessions ?? []) monthKeys.add(monthKey(session.session_date))
  for (const item of intakeItems ?? []) monthKeys.add(monthKey(item.captured_at))
  for (const member of members ?? []) {
    if (member.date_welcomed) monthKeys.add(monthKey(member.date_welcomed))
  }

  const cards = Array.from(monthKeys)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 8)
    .map((key) => {
      const sessionCount = (sessions ?? []).filter((session) => monthKey(session.session_date) === key).length
      const intakeCount = (intakeItems ?? []).filter((item) => monthKey(item.captured_at) === key).length
      const unreviewedCount = (intakeItems ?? []).filter((item) => monthKey(item.captured_at) === key && item.status === 'unreviewed').length
      const memberCount = (members ?? []).filter((member) => member.date_welcomed && monthKey(member.date_welcomed) === key).length
      const latestSession = (sessions ?? []).find((session) => monthKey(session.session_date) === key)
      const [year, month] = key.split('-')
      return { key, year, month, sessionCount, intakeCount, unreviewedCount, memberCount, latestSession }
    })

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">World Campus</p>
          <h2 className="text-2xl font-semibold text-neutral-900">Campus monthly meetings</h2>
          <p className="max-w-3xl text-sm text-neutral-600">
            Prepare monthly briefings from sessions, welcomes, and intake signals while keeping the raw feed read-only and traceable.
          </p>
        </div>
        <Link href="/app/comms/campus-log" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Open legacy log
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={`/app/comms/campus/${card.year}/${card.month}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Meeting month</p>
                <h3 className="mt-1 text-xl font-semibold text-neutral-950">{formatMonth(card.key)}</h3>
              </div>
              {card.unreviewedCount > 0 && (
                <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
                  {card.unreviewedCount} unreviewed
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-neutral-50 px-3 py-2">
                <p className="text-lg font-bold text-neutral-950">{card.sessionCount}</p>
                <p className="text-[11px] text-neutral-500">sessions</p>
              </div>
              <div className="rounded-xl bg-neutral-50 px-3 py-2">
                <p className="text-lg font-bold text-neutral-950">{card.intakeCount}</p>
                <p className="text-[11px] text-neutral-500">feed items</p>
              </div>
              <div className="rounded-xl bg-neutral-50 px-3 py-2">
                <p className="text-lg font-bold text-neutral-950">{card.memberCount}</p>
                <p className="text-[11px] text-neutral-500">welcomes</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              {card.latestSession?.theme || 'Open the month workspace to prepare briefing notes, agenda points, decisions, and raw-feed review.'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
