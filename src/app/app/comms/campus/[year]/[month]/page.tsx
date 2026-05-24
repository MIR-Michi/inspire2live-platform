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

export default async function CampusMonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const { year, month } = await params
  const { start, end } = monthBounds(year, month)
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
      .select('id, session_date, theme, summary')
      .gte('session_date', start.toISOString().slice(0, 10))
      .lt('session_date', end.toISOString().slice(0, 10))
      .order('session_date', { ascending: false }),
    supabase
      .from('campus_members')
      .select('id, name, country, organisation, date_welcomed, notes')
      .gte('date_welcomed', start.toISOString().slice(0, 10))
      .lt('date_welcomed', end.toISOString().slice(0, 10))
      .order('date_welcomed', { ascending: false }),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/app/comms/campus" className="inline-flex items-center text-sm font-semibold text-orange-700 hover:text-orange-800">
        Back to Campus
      </Link>

      <header className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">World Campus month</p>
        <h2 className="mt-2 text-3xl font-semibold text-neutral-950">{formatMonth(start)}</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          A two-column workspace for monthly briefing preparation. Raw intake is visible in-page for traceability and does not trigger external publishing.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900">Briefing document</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Draft briefing notes from sessions, welcomes, and current-month intake before moving items into planner or library workflows.
            </p>
          </div>

          {(sessions ?? []).map((session) => (
            <article key={session.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">{session.session_date}</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950">{session.theme || 'Campus session'}</h4>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{session.summary || 'Summary not captured yet.'}</p>
            </article>
          ))}

          {(members ?? []).map((member) => (
            <article key={member.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green-700">Welcome</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950">{member.name}</h4>
              <p className="mt-1 text-sm text-neutral-500">{[member.organisation, member.country].filter(Boolean).join(', ') || 'No organisation or country recorded'}</p>
              {member.notes && <p className="mt-2 text-sm leading-6 text-neutral-600">{member.notes}</p>}
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-5 text-white shadow-sm">
            <h3 className="text-lg font-semibold">Raw feed traceability</h3>
            <p className="mt-1 text-sm text-neutral-300">
              {intakeItems?.length ?? 0} intake item{(intakeItems?.length ?? 0) === 1 ? '' : 's'} captured this month.
            </p>
          </div>

          {(intakeItems ?? []).map((item) => (
            <details key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                {item.sender_name} · {item.content_type.replace('_', ' ')}
              </summary>
              <p className="mt-2 text-xs text-neutral-500">{item.status} · {new Date(item.captured_at).toLocaleString('en-GB')}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{item.raw_content}</p>
            </details>
          ))}
        </aside>
      </div>
    </div>
  )
}

