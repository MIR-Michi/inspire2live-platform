import Link from 'next/link'
import { addCampusDecisionItem, startCampusMeeting, updateCampusDecisionItem } from '@/app/app/comms/campus-log/actions'
import { addAgendaItem } from '@/app/app/comms/dashboard/actions'
import { deleteIntakeItem, markIntakeReviewed } from '@/app/app/comms/intake/actions'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { AgendaAddForm } from '@/components/comms/agenda-add-form'
import { AgendaItemList } from '@/components/comms/agenda-item-list'
import { TaskCreateForm } from '@/components/comms/task-create-form'
import { CampusMeetingChecklist } from '@/components/comms/campus-meeting-checklist'
import { MeetingTranscriptPanel } from '@/components/comms/meeting-transcript-panel'
import { CampusBriefingPanel } from '@/components/comms/campus-briefing-panel'
import { loadCampusMeetingTasks, loadCampusSessionAgenda, loadCommsTeamMembers } from '@/lib/comms-dashboard-data'
import { loadCampusSessionTranscript } from '@/lib/comms-meeting-transcripts'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import type { CampusBriefing } from '@/lib/ai/campus-briefing'
import { normalizeRole } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'

async function markReviewedAction(formData: FormData) {
  'use server'
  await markIntakeReviewed(undefined, formData)
}

async function deleteIntakeAction(formData: FormData) {
  'use server'
  await deleteIntakeItem(undefined, formData)
}

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

// The campus team meets on the last Wednesday of the month — the natural default
// date when starting this month's meeting from the briefing workspace.
function lastWednesdayOf(year: string, month: string) {
  const date = new Date(Number(year), Number(month), 0)
  while (date.getDay() !== 3) date.setDate(date.getDate() - 1)
  return dateOnly(date)
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  // Intl.format throws "Invalid time value" on a bad date — guard against it.
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

function typeLabel(value: string) {
  return value.replaceAll('_', ' ')
}

const TABS = ['Briefing', 'Field newsfeed', 'WhatsApp'] as const
type IncomingTab = (typeof TABS)[number]

function tabKey(value: string | undefined): IncomingTab {
  return TABS.find((s) => s.toLowerCase() === value?.toLowerCase()) ?? 'Briefing'
}

function sourceLinkFor(item: { source_url?: string | null; raw_content: string }) {
  if (item.source_url) return item.source_url
  return (item.raw_content ?? '').match(/https?:\/\/[^\s)]+/i)?.[0] ?? null
}

function parseDecisionItem(value: string) {
  const parts = value.split('|').map((part) => part.trim())
  const decision = parts[0]?.replace(/^Decision:\s*/i, '').trim() || value
  const owner = parts.find((part) => /^Owner:/i.test(part))?.replace(/^Owner:\s*/i, '').trim() || 'Unassigned'
  return { decision, owner }
}

type CampusMonthPageProps = {
  params: Promise<{ year: string; month: string }>
  searchParams?: Promise<{ source?: string }>
}

export default async function CampusMonthPage(props: CampusMonthPageProps) {
  // Render inside a guard so a single bad row / failed query degrades to a
  // visible message instead of 500-ing the whole route (and showing the
  // generic "unexpected response from the server" boundary).
  try {
    return await CampusMonthView(props)
  } catch (error) {
    console.error('[campus month page] render failed', error)
    const message = error instanceof Error ? error.message : String(error)
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-amber-900">This month&apos;s campus workspace couldn&apos;t load</h1>
          <p className="mt-1 text-sm text-amber-800">Other pages are unaffected. Technical detail:</p>
          <p className="mt-3 break-words rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-amber-900">{message.slice(0, 400)}</p>
        </div>
      </div>
    )
  }
}

async function CampusMonthView({ params, searchParams }: CampusMonthPageProps) {
  const { year, month } = await params
  const selectedTab = tabKey((await searchParams)?.source)
  const { start, end } = monthBounds(year, month)
  const startDate = dateOnly(start)
  const endDate = dateOnly(end)
  const supabase = await createClient()

  const [{ data: whatsappData }, { data: newsfeedData }, { data: sessions }, { data: members }] = await Promise.all([
    supabase
      .from('intake_items')
      .select('id, sender_name, content_type, raw_content, source_url, status, captured_at')
      .eq('channel', 'campus')
      .gte('captured_at', start.toISOString())
      .lt('captured_at', end.toISOString())
      .order('captured_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('news_feed_items')
      .select('id, headline, summary, category, region, source_url, source_name, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('campus_sessions')
      .select('id, session_date, theme, summary, action_items_for_publication, decisions_for_publication')
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

  type NewsfeedItem = {
    id: string; headline: string; summary: string | null; category: string | null
    region: string | null; source_url: string | null; source_name: string | null
    published_at: string | null; created_at: string | null
  }
  const whatsappItems = whatsappData ?? []
  const newsfeedItems: NewsfeedItem[] = (newsfeedData ?? []) as NewsfeedItem[]
  const meetingTitle = `${formatMonth(start)} meeting`
  const returnPath = `/app/comms/campus/${year}/${month}`

  const primarySession = sessions?.[0]

  // Structured agenda for this monthly meeting — same framework as the weekly
  // comms meeting: shared agenda items (owner + drag order + meeting notes) with
  // assignable, linkable tasks. Loaded only when a session exists to attach to.
  const [campusAgenda, teamMembers, meetingTasks, transcript] = primarySession
    ? await Promise.all([
        loadCampusSessionAgenda(supabase, primarySession.id),
        loadCommsTeamMembers(supabase),
        loadCampusMeetingTasks(supabase, primarySession.id),
        loadCampusSessionTranscript(supabase, primarySession.id),
      ])
    : [[], [], [], null]
  const transcriptOwners = teamMembers.map((member) => ({ id: member.id, label: member.label }))
  const aiEnabled = isAiEnabled()
  const completedMeetingTasks = meetingTasks.filter((task) => task.status === 'completed').length
  const campusAgendaOptions = primarySession
    ? campusAgenda.map((item) => ({ id: item.id, label: item.title, meetingDate: primarySession.session_date }))
    : []
  const monthLastWednesday = lastWednesdayOf(year, month)

  const decisions = (primarySession?.decisions_for_publication?.length
    ? primarySession.decisions_for_publication
    : (sessions ?? []).flatMap((session) => session.summary ? [`Decision: ${session.summary} | Owner: Session summary`] : []))

  // Audience briefing (presenter/topic background) + admin flag for regeneration.
  // briefing* columns are not in the generated Database types yet.
  let briefing: CampusBriefing | null = null
  let briefingGeneratedAt: string | null = null
  let briefingPresenter = ''
  if (primarySession) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: briefingRow } = await (supabase as any)
      .from('campus_sessions')
      .select('briefing, briefing_generated_at, briefing_presenter')
      .eq('id', primarySession.id)
      .maybeSingle()
    briefing = (briefingRow?.briefing as CampusBriefing | null) ?? null
    briefingGeneratedAt = (briefingRow?.briefing_generated_at as string | null) ?? null
    briefingPresenter = (briefingRow?.briefing_presenter as string | null) ?? ''
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = normalizeRole(profileRow?.role) === 'PlatformAdmin'
  }

  return (
    <div className="space-y-4">
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
          <Link href="/app/comms/intake" className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
            View raw feed
          </Link>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Saved</span>
        </div>
      </header>

      <div className="grid min-h-[720px] overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-[7fr_3fr]">
        <section className="border-neutral-200 lg:order-last lg:border-l">
          <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Incoming</h2>
              {selectedTab !== 'Briefing' && (
                <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {selectedTab === 'Field newsfeed' ? newsfeedItems.length : whatsappItems.length}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TABS.map((source) => {
                const isActive = selectedTab === source
                const href = `${returnPath}?source=${encodeURIComponent(source)}#raw-feed`
                return (
                  <Link
                    key={source}
                    href={href}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100'}`}
                  >
                    {source}
                  </Link>
                )
              })}
            </div>
          </div>

          <div id="raw-feed" className="scroll-mt-24 max-h-[680px] space-y-3 overflow-y-auto px-5 py-4">
            {selectedTab === 'Briefing' && (
              <CampusBriefingPanel
                sessionId={primarySession?.id ?? null}
                returnPath={returnPath}
                briefing={briefing}
                generatedAt={briefingGeneratedAt}
                defaultPresenter={briefingPresenter}
                defaultTopic={primarySession?.theme ?? ''}
                isAdmin={isAdmin}
                aiEnabled={aiEnabled}
              />
            )}

            {selectedTab === 'Field newsfeed' && (
              <>
                {newsfeedItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.category && (
                          <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{item.category}</span>
                        )}
                        {item.region && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{item.region}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-neutral-500">
                        {item.source_name ?? ''}{item.published_at ? ` · ${formatDate(item.published_at)}` : ''}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-950">{item.headline}</p>
                      {item.summary && (
                        <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">{item.summary}</p>
                      )}
                      {item.source_url && (
                        <div className="mt-3">
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                          >
                            Open link
                          </a>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {newsfeedItems.length === 0 && (
                  <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                    No field newsfeed items yet.
                  </p>
                )}
              </>
            )}

            {selectedTab === 'WhatsApp' && (
              <>
                {whatsappItems.map((item) => {
                  const sourceLink = sourceLinkFor(item)
                  return (
                    <article key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{typeLabel(item.content_type)}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{item.status}</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-500">{item.sender_name} · {formatDate(item.captured_at)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-semibold text-neutral-950">{(item.raw_content ?? '').slice(0, 90)}</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-5 text-neutral-600">{item.raw_content}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.status === 'unreviewed' && (
                            <form action={markReviewedAction}>
                              <input type="hidden" name="intake_item_id" value={item.id} />
                              <input type="hidden" name="return_path" value={returnPath} />
                              <button type="submit" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                Review
                              </button>
                            </form>
                          )}
                          {primarySession && (
                            <form action={addAgendaItem}>
                              <input type="hidden" name="campus_session_id" value={primarySession.id} />
                              <input type="hidden" name="meeting_date" value={primarySession.session_date} />
                              <input type="hidden" name="title" value={(item.raw_content ?? '').slice(0, 160)} />
                              <button type="submit" className="rounded-lg bg-blue-900 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800">
                                + Agenda
                              </button>
                            </form>
                          )}
                          {sourceLink && (
                            <a
                              href={sourceLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                            >
                              Open link
                            </a>
                          )}
                          <form action={deleteIntakeAction}>
                            <input type="hidden" name="intake_item_id" value={item.id} />
                            <input type="hidden" name="return_path" value={returnPath} />
                            <button type="submit" className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </article>
                  )
                })}
                {whatsappItems.length === 0 && (
                  <p className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
                    No WhatsApp messages from the campus group this month.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="bg-white lg:order-first">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
            <h2 className="text-base font-semibold text-neutral-900">Meeting details</h2>
            <div className="flex gap-2">
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">Export</span>
              <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">Share to Teams</span>
            </div>
          </div>

          <div className="max-h-[680px] space-y-4 overflow-y-auto px-5 py-4">
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">What happened this month</h3>
                {primarySession && (
                  <Link
                    href={`/app/comms/campus-log/sessions/${primarySession.id}`}
                    className="text-xs font-bold uppercase text-blue-900 hover:underline"
                  >
                    Edit
                  </Link>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-900">
                {primarySession?.summary ||
                  whatsappItems.slice(0, 3).map((item) => `${item.sender_name} shared ${typeLabel(item.content_type)}`).join('. ') ||
                  'Briefing summary will be built from routed intake, session notes, and member welcomes.'}
              </p>
            </section>

            <CollapsibleCard
              title={`What happened - ${formatMonth(start)}`}
              storageKey="campus-happened"
              bodyClassName="px-0 pb-0"
              actions={
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {whatsappItems.length + (members?.length ?? 0)} items
                </span>
              }
            >
              <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
                {whatsappItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    {item.sender_name} shared {typeLabel(item.content_type)} - {(item.raw_content ?? '').slice(0, 88)}
                  </li>
                ))}
                {(members ?? []).slice(0, 3).map((member) => (
                  <li key={member.id} className="px-4 py-3 text-sm leading-5 text-neutral-700">
                    Welcome {member.name}{member.country ? ` from ${member.country}` : ''}
                  </li>
                ))}
              </ul>
            </CollapsibleCard>

            {primarySession && (
              <CollapsibleCard
                title="Meeting checklist"
                storageKey="campus-checklist"
                bodyClassName="px-0 pb-0"
                actions={
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {completedMeetingTasks}/{meetingTasks.length} done
                  </span>
                }
              >
                <CampusMeetingChecklist tasks={meetingTasks} teamMembers={teamMembers} />
                <p className="px-4 py-3 text-[11px] text-neutral-500">
                  Standard tasks for every campus meeting. Reassign an owner or update status; each
                  task also appears on its owner&apos;s personal dashboard.
                </p>
              </CollapsibleCard>
            )}

            {primarySession && (
              <CollapsibleCard
                title="Meeting transcript & AI summary"
                storageKey="campus-transcript"
                bodyClassName="px-0 pb-0"
                actions={
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                    {transcript?.summary ? 'Summary ready' : transcript ? 'Transcript uploaded' : 'No transcript'}
                  </span>
                }
              >
                <div className="border-t border-neutral-200 px-4 py-3">
                  <MeetingTranscriptPanel
                    context={{ kind: 'campus', campusSessionId: primarySession.id }}
                    transcript={transcript}
                    owners={transcriptOwners}
                    aiEnabled={aiEnabled}
                  />
                </div>
              </CollapsibleCard>
            )}

            <CollapsibleCard
              title="Agenda & tasks"
              storageKey="campus-agenda"
              bodyClassName="px-0 pb-0"
              actions={
                primarySession ? (
                  <TaskCreateForm teamMembers={teamMembers} agendaItems={campusAgendaOptions} />
                ) : (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                    {campusAgenda.length} items
                  </span>
                )
              }
            >
              {primarySession ? (
                <div className="space-y-3 border-t border-neutral-200 px-4 py-3">
                  {campusAgenda.length > 0 ? (
                    <AgendaItemList items={campusAgenda} />
                  ) : (
                    <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
                      No agenda topics yet. Add the first one for this meeting, or use “+ Agenda” on an incoming item.
                    </p>
                  )}
                  <AgendaAddForm meetingDate={primarySession.session_date} campusSessionId={primarySession.id} />
                  <p className="text-[11px] text-neutral-500">
                    Use “+ New task” to assign action items to a comms team member and link them to an agenda topic.
                  </p>
                </div>
              ) : (
                <div className="border-t border-neutral-200 px-4 py-4">
                  <p className="text-sm text-neutral-600">
                    No campus meeting exists for this month yet. Create one to start its agenda.
                  </p>
                  <form action={startCampusMeeting} className="mt-3">
                    <input type="hidden" name="return_path" value={returnPath} />
                    <input type="hidden" name="session_date" value={monthLastWednesday} />
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Create this month&apos;s meeting
                    </button>
                  </form>
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard
              title="Decisions"
              storageKey="campus-decisions"
              bodyClassName="px-0 pb-0"
              actions={<span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{decisions.length} decisions</span>}
            >
              <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
                {decisions.slice(0, 5).map((decision, index) => {
                  const parsedDecision = parseDecisionItem(decision)
                  return (
                    <li key={`${decision}-${index}`} className="px-4 py-3">
                      <p className="text-sm leading-5 text-neutral-800">{parsedDecision.decision}</p>
                      <p className="mt-1 text-xs font-medium text-neutral-500">Decided by: {parsedDecision.owner}</p>
                      {primarySession && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-700">Edit decision</summary>
                          <form action={updateCampusDecisionItem} className="mt-2 grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                            <input type="hidden" name="session_id" value={primarySession.id} />
                            <input type="hidden" name="decision_index" value={String(index)} />
                            <input type="hidden" name="return_path" value={returnPath} />
                            <textarea
                              name="decision_item"
                              rows={3}
                              defaultValue={parsedDecision.decision}
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                            />
                            <input
                              name="decision_owner"
                              defaultValue={parsedDecision.owner}
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                            />
                            <button type="submit" className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                              Save decision
                            </button>
                          </form>
                        </details>
                      )}
                    </li>
                  )
                })}
                {decisions.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-neutral-500">No decisions captured yet.</li>
                )}
              </ul>
              {primarySession && (
                <form action={addCampusDecisionItem} className="grid gap-3 border-t border-neutral-200 p-4">
                  <input type="hidden" name="session_id" value={primarySession.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <textarea
                    name="decision_item"
                    rows={3}
                    required
                    placeholder="Add one decision point"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <input
                    name="decision_owner"
                    required
                    placeholder="Who decided"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    Add decision
                  </button>
                </form>
              )}
            </CollapsibleCard>
          </div>
        </aside>
      </div>
    </div>
  )
}
