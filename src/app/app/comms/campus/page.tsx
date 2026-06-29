import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCampusSession } from '@/app/app/comms/campus-log/actions'
import { PresenterAvatar } from '@/components/comms/presenter-avatar'

function monthKey(value: string) {
  return value.slice(0, 7)
}

function formatMonth(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
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

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatMemberMeta(member: { organisation: string | null; country: string | null; date_welcomed: string | null }) {
  const parts = [member.organisation, member.country].filter(Boolean)
  if (member.date_welcomed) {
    parts.push(`Welcomed ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(member.date_welcomed))}`)
  }
  return parts.join(' - ') || 'Campus member'
}

type Meeting = {
  id: string
  key: string
  year: string
  month: string
  date: string
  title: string
  description: string | null
  presenterName: string | null
  presenterAvatarUrl: string | null
  unreviewed: number
  openTasks: number
}

const SMALL_TILE_LIMIT = 6

function truncate(text: string, max = 180) {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

export default async function CommsCampusPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; show?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeTab = params.tab === 'members' ? 'members' : 'meetings'
  const showAll = params.show === 'all'
  const supabase = await createClient()
  const [{ data: sessions }, { data: intakeItems }, { data: members }] = await Promise.all([
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary')
      // Match the meeting-detail page's primary-session pick (session_date desc,
      // then created_at asc) so the overview shows the same session's content.
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(24),
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

  // Presenter info lives in migration-00105 columns that aren't in the generated
  // types yet; fetch separately and tolerate a not-yet-applied migration.
  const presenterById = new Map<string, { name: string | null; avatar: string | null }>()
  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: presenterRows } = await (supabase as any)
      .from('campus_sessions')
      .select('id, presenter_name, presenter_avatar_url')
      .in('id', sessionIds)
    for (const row of (presenterRows ?? []) as Array<{ id: string; presenter_name: string | null; presenter_avatar_url: string | null }>) {
      presenterById.set(row.id, { name: row.presenter_name ?? null, avatar: row.presenter_avatar_url ?? null })
    }
  }

  // Open checklist tasks per session (not completed / skipped). comms_tasks isn't
  // in the generated types, so this goes through an untyped client.
  const openTasksById = new Map<string, number>()
  if (sessionIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: taskRows } = await (supabase as any)
      .from('comms_tasks')
      .select('campus_session_id, status')
      .in('campus_session_id', sessionIds)
    for (const row of (taskRows ?? []) as Array<{ campus_session_id: string | null; status: string | null }>) {
      if (!row.campus_session_id) continue
      if (row.status === 'completed' || row.status === 'skipped') continue
      openTasksById.set(row.campus_session_id, (openTasksById.get(row.campus_session_id) ?? 0) + 1)
    }
  }

  // One meeting per month (most recent session of the month wins on tie).
  const byMonth = new Map<string, Meeting>()
  for (const session of sessions ?? []) {
    const key = monthKey(session.session_date)
    if (byMonth.has(key)) continue
    const [year, month] = key.split('-')
    const monthIntake = (intakeItems ?? []).filter((item) => monthKey(item.captured_at) === key)
    const presenter = presenterById.get(session.id)
    byMonth.set(key, {
      id: session.id,
      key,
      year,
      month,
      date: session.session_date,
      title: formatMeetingTitle(key),
      description: session.summary || session.theme || null,
      presenterName: presenter?.name ?? null,
      presenterAvatarUrl: presenter?.avatar ?? null,
      unreviewed: monthIntake.filter((item) => item.status === 'unreviewed').length,
      openTasks: openTasksById.get(session.id) ?? 0,
    })
  }

  const meetings = Array.from(byMonth.values()) // session_date desc
  const today = dateOnly(new Date())
  const upcoming = meetings.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = meetings.filter((m) => m.date < today) // already desc
  const nextMeeting = upcoming[0] ?? null
  const previousMeeting = past[0] ?? null
  const olderMeetings = past.slice(1)
  const smallTiles = showAll ? olderMeetings : olderMeetings.slice(0, SMALL_TILE_LIMIT)
  const hasMore = olderMeetings.length > SMALL_TILE_LIMIT

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
        <div className="space-y-6">
          {/* Dominant tiles: previous + next */}
          {previousMeeting || nextMeeting ? (
            <div className="grid gap-4 md:grid-cols-2">
              {previousMeeting && <BigMeetingTile meeting={previousMeeting} label="Last meeting" tone="past" />}
              {nextMeeting && <BigMeetingTile meeting={nextMeeting} label="Next meeting" tone="next" />}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
              No campus meetings yet. Use “+ New meeting” to create the first one.
            </p>
          )}

          {/* Smaller tiles: older previous meetings */}
          {smallTiles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Previous meetings</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {smallTiles.map((meeting, index) => (
                  <SmallMeetingTile key={meeting.key} meeting={meeting} index={index} />
                ))}
              </div>
              {hasMore && !showAll && (
                <div className="pt-1">
                  <Link
                    href="/app/comms/campus?show=all"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:text-orange-800"
                  >
                    Show all meetings &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
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

function BigMeetingTile({ meeting, label, tone }: { meeting: Meeting; label: string; tone: 'past' | 'next' }) {
  const isNext = tone === 'next'
  return (
    <Link
      href={`/app/comms/campus/${meeting.year}/${meeting.month}`}
      className={[
        'flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 animate-fade-up hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.995]',
        isNext ? 'border-blue-900 ring-1 ring-blue-900/40' : 'border-neutral-200',
      ].join(' ')}
    >
      <div className={isNext ? 'bg-blue-900 px-5 py-3 text-white' : 'bg-neutral-50 px-5 py-3 text-neutral-900'}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isNext ? 'text-blue-200' : 'text-neutral-400'}`}>
            {label}
          </p>
          {meeting.unreviewed > 0 ? (
            <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
              {meeting.unreviewed} incoming
            </span>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isNext ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
              {isNext ? 'Ready' : 'Completed'}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 px-5 py-4">
        <PresenterAvatar
          src={meeting.presenterAvatarUrl}
          name={meeting.presenterName}
          className="h-20 w-20 shrink-0"
          rounded="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-neutral-900">{meeting.title}</h3>
          <p className="mt-0.5 text-sm font-medium text-blue-900">
            {meeting.presenterName || 'Presenter to be announced'}
          </p>
          <p className="mt-2 text-sm leading-5 text-neutral-600">
            {meeting.description
              ? truncate(meeting.description)
              : 'Agenda building in progress from this month’s intake, welcomes, and session notes.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-4">
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
          {meeting.openTasks} open {meeting.openTasks === 1 ? 'task' : 'tasks'}
        </span>
        <span className="text-sm font-semibold text-blue-900">Open -&gt;</span>
      </div>
    </Link>
  )
}

function SmallMeetingTile({ meeting, index }: { meeting: Meeting; index: number }) {
  return (
    <Link
      href={`/app/comms/campus/${meeting.year}/${meeting.month}`}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 animate-fade-up hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md active:translate-y-0"
    >
      <PresenterAvatar
        src={meeting.presenterAvatarUrl}
        name={meeting.presenterName}
        className="h-12 w-12 shrink-0"
        rounded="rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{formatMonth(meeting.key)}</p>
        <p className="truncate text-xs text-neutral-500">{meeting.presenterName || lastWednesdayLabel(meeting.key)}</p>
        <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
          {meeting.openTasks} open {meeting.openTasks === 1 ? 'task' : 'tasks'}
        </p>
      </div>
    </Link>
  )
}
